/** Read every authorized page, including when the API caps pages below our request. */
export async function loadAdminPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  while (true) {
    const { data, error } = await fetchPage(rows.length, rows.length + 99);
    if (error) throw error;
    if (!data?.length) return rows;
    rows.push(...data);
  }
}

export function matchesAdminUser(
  user: { display_name?: string | null; username?: string | null; email?: string | null },
  search: string,
): boolean {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  // A leading @ denotes a handle; @ inside an email remains significant.
  if (query.startsWith('@')) {
    const handle = query.slice(1);
    return !handle || (user.username ?? '').toLowerCase().includes(handle);
  }
  return [user.display_name, user.username, user.email]
    .some(value => value?.toLowerCase().includes(query));
}
