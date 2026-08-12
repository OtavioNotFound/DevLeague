import { Injectable } from '@nestjs/common';

@Injectable()
export class AlphaPolicyService {
  readonly termsVersion = process.env.ALPHA_TERMS_VERSION ?? 'v0.1-alpha';
  readonly privacyVersion = process.env.ALPHA_PRIVACY_VERSION ?? 'v0.1-alpha';
  readonly requireVerifiedEmail = process.env.REQUIRE_VERIFIED_EMAIL === 'true';
}
