import { z } from 'zod';

const invitationCodePattern = /^[a-z0-9]{4,16}$/i;

export const accessCodeSchema = z
  .string()
  .trim()
  .min(1, 'Código de convite obrigatório')
  .regex(/^(?:[A-Z0-9]{4,16}|[A-Z0-9]{4}-[A-Z0-9]{4})$/i, 'Usa o código do convite, sem aspas (ex: 92C46B28 ou ABCD-1234)');

export function hasInviteCodeInSearch(search: string): boolean {
  const code = new URLSearchParams(search).get('ref')?.trim() ?? '';
  return invitationCodePattern.test(code);
}

export function createRegisterSchema(invitationLink: boolean) {
  return z.object({
    accessCode: accessCodeSchema,
    displayName: z.string(),
    username: z.string(),
    email: z.string().email('Please enter a valid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
  }).superRefine((values, context) => {
    if (invitationLink) return;

    if (values.displayName.trim().length < 2) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['displayName'], message: 'Name must be at least 2 characters' });
    }
    if (values.username.trim().length < 3 || values.username.length > 20 || !/^[a-zA-Z0-9_]+$/.test(values.username)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['username'], message: 'Username must be 3–20 letters, numbers, or underscores' });
    }
  });
}

export type RegisterFormValues = z.infer<ReturnType<typeof createRegisterSchema>>;

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
