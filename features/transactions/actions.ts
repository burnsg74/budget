"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAccount, getTransactionAccountId, updateTransactionMatch } from "../../lib/accounts";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function saveTransactionMatch(formData: FormData) {
  const transactionId = String(formData.get("transactionId") ?? "");
  const matchedValue = String(formData.get("matchedAccountId") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "/accounts");

  if (!UUID_PATTERN.test(transactionId)) {
    redirect(returnTo);
  }

  const transaction = await getTransactionAccountId(transactionId);

  if (!transaction) {
    redirect(returnTo);
  }

  let matchedAccountId: string | null = null;

  if (matchedValue) {
    if (!UUID_PATTERN.test(matchedValue) || matchedValue === transaction.accountId) {
      redirect(returnTo);
    }

    const account = await getAccount(matchedValue);

    if (!account || account.archived) {
      redirect(returnTo);
    }

    matchedAccountId = account.id;
  }

  await updateTransactionMatch(transactionId, matchedAccountId);
  revalidatePath("/");
  revalidatePath("/accounts");
  revalidatePath("/reports");
  revalidatePath(`/accounts/${transaction.accountId}`);

  if (transaction.matchedAccountId) {
    revalidatePath(`/accounts/${transaction.matchedAccountId}`);
  }

  if (matchedAccountId) {
    revalidatePath(`/accounts/${matchedAccountId}`);
  }

  redirect(returnTo);
}
