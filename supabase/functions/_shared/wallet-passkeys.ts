import {
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
  type WebAuthnCredential,
} from 'npm:@simplewebauthn/server@13.2.2';

const walletOrigin = ['https://yamilook.com', 'https://www.yamilook.com'];
const relyingParty = 'yamilook.com';

// The caller loads the challenge and holder's active credential from server storage.
// Consume the challenge atomically before granting access or executing a debit.
export function verifyWalletUnlock(
  response: AuthenticationResponseJSON,
  expectedChallenge: string,
  credential: WebAuthnCredential,
) {
  return verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: walletOrigin,
    expectedRPID: relyingParty,
    credential,
    requireUserVerification: true,
  });
}

export function verifyWalletRegistration(
  response: RegistrationResponseJSON,
  expectedChallenge: string,
) {
  return verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: walletOrigin,
    expectedRPID: relyingParty,
    requireUserVerification: true,
  });
}
