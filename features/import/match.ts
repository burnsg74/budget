export type MatchableAccount = {
  id: string;
  name: string;
  archived: boolean;
};

export function suggestMatch(
  description: string,
  accounts: MatchableAccount[],
  importAccountId: string,
): string | null {
  const haystack = description.toLowerCase();
  const matches = accounts
    .filter((account) => {
      const name = account.name.trim();
      return (
        !account.archived &&
        account.id !== importAccountId &&
        name.length >= 3 &&
        haystack.includes(name.toLowerCase())
      );
    })
    .sort(
      (a, b) => b.name.trim().length - a.name.trim().length || a.name.localeCompare(b.name),
    );

  return matches[0]?.id ?? null;
}
