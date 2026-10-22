import {
  buildInvitationSignupMetadata,
  createRegisterSchema,
  hasInviteCodeInSearch,
} from './invitation-registration';

const base = {
  accessCode: 'AB12CD34',
  displayName: '',
  username: '',
  email: 'guest@example.com',
  password: 'StrongPass1',
};

describe('invitation registration', () => {
  it('recognizes the existing ?ref= invitation link format', () => {
    expect(hasInviteCodeInSearch('?ref=AB12CD34')).toBe(true);
    expect(hasInviteCodeInSearch('?ref=bad%20code')).toBe(false);
    expect(hasInviteCodeInSearch('?other=AB12CD34')).toBe(false);
  });

  it('accepts invited users with only code, email, and a strong password', () => {
    expect(createRegisterSchema(true).safeParse(base).success).toBe(true);
  });

  it('still requires profile fields when signup has no invitation link', () => {
    expect(createRegisterSchema(false).safeParse(base).success).toBe(false);
    expect(createRegisterSchema(false).safeParse({
      ...base,
      displayName: 'Guest User',
      username: 'guest_user',
    }).success).toBe(true);
  });

  it('rejects email or password that fails authentication requirements', () => {
    expect(createRegisterSchema(true).safeParse({ ...base, email: 'not-an-email' }).success).toBe(false);
    expect(createRegisterSchema(true).safeParse({ ...base, password: 'weak' }).success).toBe(false);
  });

  it('sends only the invitation code for the simplified path', () => {
    expect(buildInvitationSignupMetadata(true, ' ab12cd34 ', '', '')).toEqual({
      access_code: 'AB12CD34',
    });
  });

  it('retains profile metadata for the existing registration path', () => {
    expect(buildInvitationSignupMetadata(false, ' ab12cd34 ', ' Guest User ', 'Guest_User')).toEqual({
      access_code: 'AB12CD34',
      display_name: 'Guest User',
      username: 'guest_user',
    });
  });
});
