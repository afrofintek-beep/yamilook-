/** Single, authenticated profile source for the author's own posts only. */
export function chooseAuthorAvatarUrl(
  postAuthorId: string,
  publicAvatar: string | null,
  viewerId?: string,
  viewerProfile?: { id: string; avatar_url: string | null } | null,
): string | null {
  if (viewerId === postAuthorId && viewerProfile?.id === postAuthorId) {
    return viewerProfile.avatar_url;
  }
  return publicAvatar;
}
