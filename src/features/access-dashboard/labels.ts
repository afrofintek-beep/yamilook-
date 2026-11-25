import type { FeatureKey } from './api';
import type { AccessDashboardCopy } from './copy';

export function featureLabel(feature: FeatureKey, copy: AccessDashboardCopy): string {
  return ({ google_maps: copy.featureGoogleMaps, maguela: copy.featureMaguela, wallet: copy.featureWallet, business_registration: copy.featureBusiness })[feature];
}

export function accessReasonLabel(reason: string, copy: AccessDashboardCopy): string {
  return ({
    inactive_account: copy.reasonInactive, admin: copy.reasonAdmin, disabled: copy.reasonDisabled,
    not_started: copy.reasonNotStarted, expired: copy.reasonExpired, admins_only: copy.reasonAdminsOnly,
    explicit_deny: copy.reasonDeny, explicit_allow: copy.reasonAllow, all: copy.reasonAll,
    business_invitation: copy.reasonBusinessInvitation, criteria: copy.reasonCriteria,
    no_match: copy.reasonNoMatch, account_not_found: copy.reasonAccountNotFound,
  } as Record<string, string>)[reason] || copy.reasonUnavailable;
}

export function auditActionLabel(action: string, copy: AccessDashboardCopy): string {
  return ({
    legacy_import: copy.actionImport,
    policy: copy.actionPolicy, policy_saved: copy.actionPolicy, save_policy: copy.actionPolicy,
    allow: copy.actionAllow, override_allow: copy.actionAllow, deny: copy.actionDeny, override_deny: copy.actionDeny,
    inherit: copy.actionInherit, override_inherit: copy.actionInherit,
    group_created: copy.actionGroup, create_group: copy.actionGroup,
    member_added: copy.actionMemberAdded, group_member_added: copy.actionMemberAdded,
    member_removed: copy.actionMemberRemoved, group_member_removed: copy.actionMemberRemoved,
  } as Record<string, string>)[action] || copy.action;
}
