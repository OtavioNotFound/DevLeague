import { describe, expect, it } from 'vitest';
import type { InternalUser } from '@devleague/persistence';
import { toMeResponse } from './users.service.js';

const activeUser: InternalUser = {
  id: 'user-1',
  authSubject: 'subject-1',
  status: 'ACTIVE',
  username: 'AlphaUser',
  currentRating: 1200,
  activeMatchId: null,
  acceptedTermsVersion: 'v0.1-alpha',
  acceptedPrivacyVersion: 'v0.1-alpha'
};

const policy = {
  termsVersion: 'v0.1-alpha',
  privacyVersion: 'v0.1-alpha',
  requireVerifiedEmail: true
};

describe('alpha eligibility', () => {
  it('RF-AUTH-003 allows an active adult with current consents and verified email', () => {
    expect(toMeResponse(activeUser, true, policy).eligibility).toEqual({
      eligible: true,
      reasons: []
    });
  });

  it('RF-AUTH-004 returns stable reasons for every unmet gate', () => {
    const response = toMeResponse({
      ...activeUser,
      status: 'SUSPENDED',
      acceptedTermsVersion: 'old',
      acceptedPrivacyVersion: null
    }, false, policy);

    expect(response.eligibility).toEqual({
      eligible: false,
      reasons: [
        'ACCOUNT_NOT_ACTIVE',
        'TERMS_NOT_ACCEPTED',
        'PRIVACY_NOT_ACCEPTED',
        'EMAIL_NOT_VERIFIED'
      ]
    });
  });
});
