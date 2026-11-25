export const adminAreaKeys = ["admin_campaigns", "admin_trusted_invites", "admin_creators", "admin_monetization", "admin_addresses", "admin_certifications", "admin_payouts", "admin_test_data"] as const;
export type AdminArea = typeof adminAreaKeys[number];
export const adminAreaPaths: Record<AdminArea, string> = {
  admin_campaigns: '/admin/campanhas', admin_trusted_invites: '/admin/convites-confianca',
  admin_creators: '/admin/applications', admin_monetization: '/admin/monetization',
  admin_addresses: '/admin/enderecos', admin_certifications: '/admin/afroloc-certifications',
  admin_payouts: '/admin/payouts', admin_test_data: '/admin/ferramentas',
};
export const isAdminArea = (value: string): value is AdminArea => adminAreaKeys.includes(value as AdminArea);
