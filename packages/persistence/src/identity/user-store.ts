import { randomUUID } from 'node:crypto';
import type { Database } from '../postgres/database.js';
import { StoreRuleError } from '../postgres/store-errors.js';

export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED';

export interface InternalUser {
  readonly id: string;
  readonly authSubject: string;
  readonly status: UserStatus;
  readonly username: string;
  readonly currentRating: number;
  readonly peakRating: number;
  readonly games: number;
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
  readonly activeMatchId: string | null;
  readonly acceptedTermsVersion: string | null;
  readonly acceptedPrivacyVersion: string | null;
}

interface UserRow {
  id: string;
  authSubject: string;
  status: UserStatus;
  username: string;
  currentRating: number;
  peakRating: number;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  activeMatchId: string | null;
  acceptedTermsVersion: string | null;
  acceptedPrivacyVersion: string | null;
}

export class UserStore {
  constructor(private readonly database: Database) {}

  async bootstrap(input: {
    readonly authSubject: string;
    readonly username: string;
  }): Promise<InternalUser> {
    const usernameNormalized = input.username.toLowerCase();

    try {
      return await this.database.begin(async (transaction) => {
        const [existing] = await transaction<UserRow[]>`
          select u.id, u.auth_subject, u.status, p.username, r.current_rating,
                 r.peak_rating, r.games, r.wins, r.losses, r.draws,
                 ae.match_id as active_match_id,
                 latest_terms.document_version as accepted_terms_version,
                 latest_privacy.document_version as accepted_privacy_version
          from devleague.app_user u
          join devleague.profile p on p.user_id = u.id
          join devleague.rating_account r on r.user_id = u.id
          left join devleague.active_engagement ae on ae.user_id = u.id
          left join lateral (
            select cr.document_version
            from devleague.consent_record cr
            where cr.user_id = u.id and cr.document_type = 'TERMS'
            order by cr.accepted_at desc, cr.id desc limit 1
          ) latest_terms on true
          left join lateral (
            select cr.document_version
            from devleague.consent_record cr
            where cr.user_id = u.id and cr.document_type = 'PRIVACY'
            order by cr.accepted_at desc, cr.id desc limit 1
          ) latest_privacy on true
          where u.auth_subject = ${input.authSubject}
        `;
        if (existing) return existing;

        const userId = randomUUID();
        await transaction`
          insert into devleague.app_user (id, auth_subject)
          values (${userId}, ${input.authSubject})
        `;
        await transaction`
          insert into devleague.profile (user_id, username, username_normalized)
          values (${userId}, ${input.username}, ${usernameNormalized})
        `;
        await transaction`
          insert into devleague.rating_account (
            user_id, current_rating, peak_rating, algorithm_version
          ) values (${userId}, 1200, 1200, 'elo-v1')
        `;

        const [created] = await transaction<UserRow[]>`
          select u.id, u.auth_subject, u.status, p.username, r.current_rating,
                 r.peak_rating, r.games, r.wins, r.losses, r.draws,
                 ae.match_id as active_match_id,
                 null::text as accepted_terms_version,
                 null::text as accepted_privacy_version
          from devleague.app_user u
          join devleague.profile p on p.user_id = u.id
          join devleague.rating_account r on r.user_id = u.id
          left join devleague.active_engagement ae on ae.user_id = u.id
          where u.id = ${userId}
        `;
        if (!created) throw new Error('Bootstrapped user could not be read back.');
        return created;
      });
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        const concurrentlyCreated = await this.findByAuthSubject(input.authSubject);
        if (concurrentlyCreated) return concurrentlyCreated;
        throw new StoreRuleError('USERNAME_TAKEN', 'The username is already in use.');
      }
      throw error;
    }
  }

  async findByAuthSubject(authSubject: string): Promise<InternalUser | null> {
    const [user] = await this.database<UserRow[]>`
      select u.id, u.auth_subject, u.status, p.username, r.current_rating,
             r.peak_rating, r.games, r.wins, r.losses, r.draws,
             ae.match_id as active_match_id,
             latest_terms.document_version as accepted_terms_version,
             latest_privacy.document_version as accepted_privacy_version
      from devleague.app_user u
      join devleague.profile p on p.user_id = u.id
      join devleague.rating_account r on r.user_id = u.id
      left join devleague.active_engagement ae on ae.user_id = u.id
      left join lateral (
        select cr.document_version
        from devleague.consent_record cr
        where cr.user_id = u.id and cr.document_type = 'TERMS'
        order by cr.accepted_at desc, cr.id desc limit 1
      ) latest_terms on true
      left join lateral (
        select cr.document_version
        from devleague.consent_record cr
        where cr.user_id = u.id and cr.document_type = 'PRIVACY'
        order by cr.accepted_at desc, cr.id desc limit 1
      ) latest_privacy on true
      where u.auth_subject = ${authSubject}
    `;
    return user ?? null;
  }

  async recordAlphaConsents(input: {
    readonly authSubject: string;
    readonly termsVersion: string;
    readonly privacyVersion: string;
    readonly source: 'WEB' | 'ASSISTED_ALPHA';
  }): Promise<InternalUser> {
    return this.database.begin(async (transaction) => {
      const [user] = await transaction<{ id: string }[]>`
        select id from devleague.app_user
        where auth_subject = ${input.authSubject}
        for update
      `;
      if (!user) throw new StoreRuleError('USER_NOT_BOOTSTRAPPED', 'User must be bootstrapped.');

      await transaction`
        insert into devleague.consent_record (
          id, user_id, document_type, document_version, age_declaration, source
        ) values
          (${randomUUID()}, ${user.id}, 'TERMS', ${input.termsVersion}, 'OVER_18', ${input.source}),
          (${randomUUID()}, ${user.id}, 'PRIVACY', ${input.privacyVersion}, 'OVER_18', ${input.source})
        on conflict (user_id, document_type, document_version) do nothing
      `;

      const [updated] = await transaction<UserRow[]>`
        select u.id, u.auth_subject, u.status, p.username, r.current_rating,
               r.peak_rating, r.games, r.wins, r.losses, r.draws,
               ae.match_id as active_match_id,
               latest_terms.document_version as accepted_terms_version,
               latest_privacy.document_version as accepted_privacy_version
        from devleague.app_user u
        join devleague.profile p on p.user_id = u.id
        join devleague.rating_account r on r.user_id = u.id
        left join devleague.active_engagement ae on ae.user_id = u.id
        left join lateral (
          select cr.document_version
          from devleague.consent_record cr
          where cr.user_id = u.id and cr.document_type = 'TERMS'
          order by cr.accepted_at desc, cr.id desc limit 1
        ) latest_terms on true
        left join lateral (
          select cr.document_version
          from devleague.consent_record cr
          where cr.user_id = u.id and cr.document_type = 'PRIVACY'
          order by cr.accepted_at desc, cr.id desc limit 1
        ) latest_privacy on true
        where u.id = ${user.id}
      `;
      if (!updated) throw new Error('Consented user could not be read back.');
      return updated;
    });
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
