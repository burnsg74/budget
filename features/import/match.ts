export type MatchableAccount = {
  id: number;
  matchText: string;
  archived: boolean;
};

export type ProposedAccount = {
  key: string;
  name: string;
  matchText: string;
  type: "income" | "other";
};

export function suggestMatch(
  description: string,
  accounts: MatchableAccount[],
  importAccountId: number,
): number | null {
  const haystack = description.toLowerCase();
  const matches = accounts
    .filter((account) => {
      const text = account.matchText.trim();
      return (
        !account.archived &&
        account.id !== importAccountId &&
        text.length >= 3 &&
        haystack.includes(text.toLowerCase())
      );
    })
    .sort(
      (a, b) =>
        b.matchText.trim().length - a.matchText.trim().length ||
        a.matchText.localeCompare(b.matchText),
    );

  return matches[0]?.id ?? null;
}

export function proposeAccount(description: string, amountCents: number): ProposedAccount {
  const trimmed = description.trim().slice(0, 500);

  return {
    key: trimmed.toLowerCase(),
    name: trimmed.replace(/\s+/g, " ").slice(0, 80),
    matchText: trimmed,
    type: amountCents > 0 ? "income" : "other",
  };
}
