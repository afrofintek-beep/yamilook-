export type SignupDetails = {
  email: string;
  password: string;
  displayName: string;
  username: string;
  usernameAvailable: boolean | null;
  invitationLink: boolean;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const invitationCodePattern = /^[a-z0-9]{4,16}$/i;
const passwordRequirements = [/.{8,}/, /[A-Z]/, /[a-z]/, /[0-9]/];

export function hasInviteCodeInSearch(search: string): boolean {
  const code = new URLSearchParams(search).get('ref')?.trim() ?? '';
  return invitationCodePattern.test(code);
}

export function isInvitationRegistrationValid(details: SignupDetails): boolean {
  const emailValid = emailPattern.test(details.email.trim());
  const passwordValid = passwordRequirements.every((pattern) => pattern.test(details.password));
  const profileValid = details.displayName.trim().length >= 2
    && details.username.trim().length >= 3
    && details.usernameAvailable !== false;

  return emailValid && passwordValid && (details.invitationLink || profileValid);
}

export function buildInvitationSignupMetadata(
  invitationLink: boolean,
  code: string,
  displayName: string,
  username: string
): { access_code: string; display_name?: string; username?: string } {
  if (invitationLink) return { access_code: code.trim().toUpperCase() };

  return {
    access_code: code.trim().toUpperCase(),
    display_name: displayName.trim(),
    username: username.trim().toLowerCase(),
  };
}
