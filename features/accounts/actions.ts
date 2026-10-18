"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  isAccountType,
  isBalanceType,
  isLiabilityType,
  isScheduleType,
} from "../../lib/account-types";
import { getAccount, insertAccount, saveAccountRecord, type AccountInput } from "../../lib/accounts";
import { isIsoDate } from "../../lib/dates";
import { dollarsToCents } from "../../lib/money";

export type FormState = { error: string } | null;

export async function createAccount(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseAccountForm(formData, false);

  if (!parsed.ok) {
    return { error: parsed.error };
  }

  await insertAccount(parsed.value);
  revalidatePath("/accounts");
  revalidatePath("/");
  redirect("/accounts");
}

export async function saveAccount(
  id: number,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const existing = await getAccount(id);

  if (!existing) {
    return { error: "That account no longer exists." };
  }

  const parsed = parseAccountForm(formData, true);

  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const saved = await saveAccountRecord(id, parsed.value, existing.matchText);
  revalidatePath("/accounts");
  revalidatePath("/");
  revalidatePath("/reports");
  revalidatePath("/transactions");

  if (saved.deleted) {
    redirect("/accounts");
  }

  revalidatePath(`/accounts/${id}`);
  redirect(`/accounts/${id}`);
}

function parseAccountForm(
  formData: FormData,
  editing: boolean,
): { ok: false; error: string } | { ok: true; value: AccountInput } {
  const name = String(formData.get("name") ?? "").trim();
  const matchText = String(formData.get("matchText") ?? "").trim();
  const typeValue = String(formData.get("type") ?? "");
  const institution = String(formData.get("institution") ?? "").trim() || null;
  const mask = String(formData.get("mask") ?? "").trim() || null;

  if (!name || name.length > 80) {
    return { ok: false, error: "Enter a name up to 80 characters." };
  }

  if (matchText.length > 500) {
    return { ok: false, error: "Match text must be 500 characters or fewer." };
  }

  if (!isAccountType(typeValue)) {
    return { ok: false, error: "Choose an account type." };
  }

  if (institution && institution.length > 80) {
    return { ok: false, error: "Institution must be 80 characters or fewer." };
  }

  if (mask && !/^\d{2,8}$/.test(mask)) {
    return { ok: false, error: "Mask should be the last 2 to 8 digits." };
  }

  let openingBalanceCents = 0;
  let openingOn: string | null = null;

  if (isBalanceType(typeValue)) {
    const cents = dollarsToCents(String(formData.get("balance") ?? ""));
    const opening = String(formData.get("openingOn") ?? "");

    if (cents === null) {
      return { ok: false, error: "Enter a balance like 1200.00." };
    }

    if (!isIsoDate(opening)) {
      return { ok: false, error: "Choose the date that balance was current." };
    }

    openingOn = opening;
    openingBalanceCents = isLiabilityType(typeValue) ? -Math.abs(cents) : cents;
  }

  let expectedAmountCents: number | null = null;
  let dueDay: number | null = null;
  let scheduleActive = false;

  if (isScheduleType(typeValue)) {
    const rawAmount = String(formData.get("expected") ?? "").trim();
    const rawDay = String(formData.get("dueDay") ?? "").trim();
    scheduleActive = formData.get("scheduleActive") === "on";

    if (rawAmount) {
      const cents = dollarsToCents(rawAmount);

      if (cents === null || cents < 0) {
        return { ok: false, error: "Enter an expected amount like 29.98." };
      }

      expectedAmountCents = cents;
    }

    if (rawDay) {
      const day = Number(rawDay);

      if (!Number.isInteger(day) || day < 1 || day > 31) {
        return { ok: false, error: "Due day must be between 1 and 31." };
      }

      dueDay = day;
    }

    if (scheduleActive && (expectedAmountCents === null || dueDay === null)) {
      return { ok: false, error: "Monthly tracking needs an amount and a day of the month." };
    }
  }

  return {
    ok: true,
    value: {
      name,
      matchText,
      type: typeValue,
      institution,
      mask,
      openingBalanceCents,
      openingOn,
      expectedAmountCents,
      dueDay,
      scheduleActive,
      archived: editing && formData.get("archived") === "on",
    },
  };
}
