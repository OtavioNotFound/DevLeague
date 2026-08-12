import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { StoreRuleError, UserStore, type InternalUser } from '@devleague/persistence';
import type { AuthPrincipal } from '../auth/auth-principal.js';
import { DatabaseService } from '../database/database.service.js';
import { AlphaPolicyService } from './alpha-policy.service.js';

export interface MeResponse {
  readonly id: string;
  readonly username: string;
  readonly status: InternalUser['status'];
  readonly rating: number;
  readonly stats: {
    readonly peakRating: number;
    readonly games: number;
    readonly wins: number;
    readonly losses: number;
    readonly draws: number;
  };
  readonly activeMatchId: string | null;
  readonly consents: {
    readonly termsVersion: string | null;
    readonly privacyVersion: string | null;
    readonly over18: boolean;
  };
  readonly eligibility: {
    readonly eligible: boolean;
    readonly reasons: readonly EligibilityReason[];
  };
}

export type EligibilityReason =
  | 'ACCOUNT_NOT_ACTIVE'
  | 'TERMS_NOT_ACCEPTED'
  | 'PRIVACY_NOT_ACCEPTED'
  | 'EMAIL_NOT_VERIFIED';

@Injectable()
export class UsersService {
  constructor(
    private readonly database: DatabaseService,
    private readonly policy: AlphaPolicyService
  ) {}

  get policyVersions(): { readonly termsVersion: string; readonly privacyVersion: string } {
    return {
      termsVersion: this.policy.termsVersion,
      privacyVersion: this.policy.privacyVersion
    };
  }

  async bootstrap(principal: AuthPrincipal, username: string): Promise<MeResponse> {
    try {
      const user = await this.store.bootstrap({ authSubject: principal.subject, username });
      return toMeResponse(user, principal.emailVerified, this.policy);
    } catch (error: unknown) {
      if (error instanceof StoreRuleError && error.code === 'USERNAME_TAKEN') {
        throw new ConflictException({ code: 'USERNAME_TAKEN', field: 'username' });
      }
      throw error;
    }
  }

  async getMe(principal: AuthPrincipal): Promise<MeResponse> {
    const user = await this.store.findByAuthSubject(principal.subject);
    if (!user) throw new NotFoundException({ code: 'USER_NOT_BOOTSTRAPPED' });
    return toMeResponse(user, principal.emailVerified, this.policy);
  }

  async requireEligible(principal: AuthPrincipal): Promise<MeResponse> {
    const me = await this.getMe(principal);
    if (!me.eligibility.eligible) {
      throw new ForbiddenException({
        code: 'ALPHA_NOT_ELIGIBLE',
        reasons: me.eligibility.reasons
      });
    }
    return me;
  }

  async recordConsents(principal: AuthPrincipal): Promise<MeResponse> {
    try {
      const user = await this.store.recordAlphaConsents({
        authSubject: principal.subject,
        termsVersion: this.policy.termsVersion,
        privacyVersion: this.policy.privacyVersion,
        source: 'WEB'
      });
      return toMeResponse(user, principal.emailVerified, this.policy);
    } catch (error: unknown) {
      if (error instanceof StoreRuleError && error.code === 'USER_NOT_BOOTSTRAPPED') {
        throw new NotFoundException({ code: 'USER_NOT_BOOTSTRAPPED' });
      }
      throw error;
    }
  }

  private get store(): UserStore {
    return new UserStore(this.database.connection);
  }
}

export function toMeResponse(
  user: InternalUser,
  emailVerified: boolean,
  policy: Pick<AlphaPolicyService, 'termsVersion' | 'privacyVersion' | 'requireVerifiedEmail'>
): MeResponse {
  const reasons: EligibilityReason[] = [];
  if (user.status !== 'ACTIVE') reasons.push('ACCOUNT_NOT_ACTIVE');
  if (user.acceptedTermsVersion !== policy.termsVersion) reasons.push('TERMS_NOT_ACCEPTED');
  if (user.acceptedPrivacyVersion !== policy.privacyVersion) reasons.push('PRIVACY_NOT_ACCEPTED');
  if (policy.requireVerifiedEmail && !emailVerified) reasons.push('EMAIL_NOT_VERIFIED');

  return {
    id: user.id,
    username: user.username,
    status: user.status,
    rating: user.currentRating,
    stats: {
      peakRating: user.peakRating,
      games: user.games,
      wins: user.wins,
      losses: user.losses,
      draws: user.draws
    },
    activeMatchId: user.activeMatchId,
    consents: {
      termsVersion: user.acceptedTermsVersion,
      privacyVersion: user.acceptedPrivacyVersion,
      over18: user.acceptedTermsVersion !== null && user.acceptedPrivacyVersion !== null
    },
    eligibility: { eligible: reasons.length === 0, reasons }
  };
}
