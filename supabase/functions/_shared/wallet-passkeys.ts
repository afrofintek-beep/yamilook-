import {
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
  type WebAuthnCredential,
} from 'npm:@simplewebauthn/server@13.2.2';

// The caller loads the challenge and holder's active credential from server storage.
// Consume the challenge atomically before granting access or executing a debit.
export function verifyWalletUnlock(
  response: AuthenticationResponseJSON,
  expectedChallenge: string,
  credential: WebAuthnCredential,
  expectedOrigin: string,
  expectedRelyingParty: string,
) {
  return verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin,
    expectedRPID: expectedRelyingParty,
    credential,
    requireUserVerification: true,
  });
}

export function verifyWalletRegistration(
  response: RegistrationResponseJSON,
  expectedChallenge: string,
  expectedOrigin: string,
  expectedRelyingParty: string,
) {
  return verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin,
    expectedRPID: expectedRelyingParty,
    requireUserVerification: true,
  });
}
