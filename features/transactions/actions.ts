"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAccount, getTransactionAccountId, updateTransactionMatch } from "../../lib/accounts";
import { parseId } from "../../lib/ids";

export async function saveTransactionMatch(formData: FormData) {
  const transactionId = parseId(String(formData.get("transactionId") ?? ""));
  const matchedValue = String(formData.get("matchedAccountId") ?? "");
  const requested = String(formData.get("returnTo") ?? "/transactions");
  const returnTo = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/transactions";

  if (transactionId === null) {
    redirect(returnTo);
  }

  const transaction = await getTransactionAccountId(transactionId);

  if (!transaction) {
    redirect(returnTo);
  }

  let matchedAccountId: number | null = null;

  if (matchedValue) {
    const matchedId = parseId(matchedValue);

    if (matchedId === null || matchedId === transaction.accountId) {
      redirect(returnTo);
    }

    const account = await getAccount(matchedId);

    if (!account || account.archived) {
      redirect(returnTo);
    }

    matchedAccountId = account.id;
  }

  await updateTransactionMatch(transactionId, matchedAccountId);
  revalidatePath("/");
  revalidatePath("/accounts");
  revalidatePath("/reports");
  revalidatePath("/transactions");
  revalidatePath(`/transactions/${transactionId}`);
  revalidatePath(`/accounts/${transaction.accountId}`);

  if (transaction.matchedAccountId) {
    revalidatePath(`/accounts/${transaction.matchedAccountId}`);
  }

  if (matchedAccountId) {
    revalidatePath(`/accounts/${matchedAccountId}`);
  }

  redirect(returnTo);
}
