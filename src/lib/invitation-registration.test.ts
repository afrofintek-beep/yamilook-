import {
  buildInvitationSignupMetadata,
  hasInviteCodeInSearch,
  isInvitationRegistrationValid,
} from './invitation-registration';

const base = {
  email: 'guest@example.com',
  password: 'StrongPass1',
  displayName: '',
  username: '',
  usernameAvailable: null,
  invitationLink: true,
};

describe('invitation registration shortcut', () => {
  it('recognizes the existing ?ref= invitation link format', () => {
    expect(hasInviteCodeInSearch('?ref=AB12CD34')).toBe(true);
    expect(hasInviteCodeInSearch('?ref=bad%20code')).toBe(false);
    expect(hasInviteCodeInSearch('?other=AB12CD34')).toBe(false);
  });

  it('allows a valid invitation link with only email and a strong password', () => {
    expect(isInvitationRegistrationValid(base)).toBe(true);
  });

  it('still rejects invalid email and weak passwords for invited users', () => {
    expect(isInvitationRegistrationValid({ ...base, email: 'not-an-email' })).toBe(false);
    expect(isInvitationRegistrationValid({ ...base, password: 'weak' })).toBe(false);
  });

  it('keeps the existing profile requirements when no invitation link is present', () => {
    expect(isInvitationRegistrationValid({ ...base, invitationLink: false })).toBe(false);
    expect(isInvitationRegistrationValid({
      ...base,
      invitationLink: false,
      displayName: 'Guest User',
      username: 'guest_user',
      usernameAvailable: true,
    })).toBe(true);
  });

  it('sends only the code for invited accounts, leaving profile completion optional', () => {
    expect(buildInvitationSignupMetadata(true, ' ab12cd34 ', '', '')).toEqual({
      access_code: 'AB12CD34',
    });
  });

  it('preserves name and username metadata for the existing registration path', () => {
    expect(buildInvitationSignupMetadata(false, ' ab12cd34 ', ' Guest User ', 'Guest_User')).toEqual({
      access_code: 'AB12CD34',
      display_name: 'Guest User',
      username: 'guest_user',
    });
  });
});
