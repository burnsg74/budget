"use client";

import { useActionState, useId, useState } from "react";
import {
  ACCOUNT_TYPES,
  TYPE_LABELS,
  isBalanceType,
  isLiabilityType,
  isScheduleType,
  type AccountType,
} from "../../lib/account-types";
import { centsToInput } from "../../lib/money";
import type { FormState } from "./actions";

type AccountFormValues = {
  name: string;
  type: AccountType;
  institution: string | null;
  mask: string | null;
  openingBalanceCents: number;
  openingOn: string | null;
  expectedAmountCents: number | null;
  dueDay: number | null;
  scheduleActive: boolean;
  archived: boolean;
};

export function AccountForm({
  action,
  account,
}: {
  action: (previous: FormState, formData: FormData) => Promise<FormState>;
  account?: AccountFormValues;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [type, setType] = useState<AccountType>(account?.type ?? "checking");
  const baseId = useId();
  const balanceDefault = account
    ? centsToInput(
        isLiabilityType(account.type)
          ? Math.abs(account.openingBalanceCents)
          : account.openingBalanceCents,
      )
    : "";
  const expectedDefault =
    account?.expectedAmountCents === null || account?.expectedAmountCents === undefined
      ? ""
      : centsToInput(account.expectedAmountCents);

  return (
    <form action={formAction} className="form">
      {state?.error ? (
        <p className="alert" role="alert">
          {state.error}
        </p>
      ) : null}

      <label className="field" htmlFor={`${baseId}-name`}>
        Name
        <input
          id={`${baseId}-name`}
          name="name"
          required
          maxLength={80}
          defaultValue={account?.name ?? ""}
        />
      </label>
      <p className="help">
        Name bills and income after the bank text, such as Netflix or PennyMac, so an
        import can link them.
      </p>

      <label className="field" htmlFor={`${baseId}-type`}>
        Type
        <select
          id={`${baseId}-type`}
          name="type"
          value={type}
          onChange={(event) => setType(event.target.value as AccountType)}
        >
          {ACCOUNT_TYPES.map((accountType) => (
            <option key={accountType} value={accountType}>
              {TYPE_LABELS[accountType]}
            </option>
          ))}
        </select>
      </label>

      <label className="field" htmlFor={`${baseId}-institution`}>
        Institution
        <input
          id={`${baseId}-institution`}
          name="institution"
          maxLength={80}
          defaultValue={account?.institution ?? ""}
        />
      </label>

      <label className="field" htmlFor={`${baseId}-mask`}>
        Last digits
        <input
          id={`${baseId}-mask`}
          name="mask"
          inputMode="numeric"
          maxLength={8}
          defaultValue={account?.mask ?? ""}
          placeholder="7502"
        />
      </label>

      {isBalanceType(type) ? (
        <>
          <label className="field" htmlFor={`${baseId}-balance`}>
            {isLiabilityType(type) ? "Amount owed" : "Balance"}
            <input
              id={`${baseId}-balance`}
              name="balance"
              inputMode="decimal"
              required
              defaultValue={balanceDefault}
              placeholder="0.00"
            />
          </label>
          <label className="field" htmlFor={`${baseId}-opening`}>
            Balance as of
            <input
              id={`${baseId}-opening`}
              name="openingOn"
              type="date"
              required
              defaultValue={account?.openingOn ?? ""}
            />
          </label>
          <p className="help">
            This is the balance at the end of that date. Later transactions change it.
          </p>
        </>
      ) : null}

      {isScheduleType(type) ? (
        <fieldset className="fieldset">
          <legend>Monthly expectation</legend>
          <label className="field" htmlFor={`${baseId}-expected`}>
            Expected amount
            <input
              id={`${baseId}-expected`}
              name="expected"
              inputMode="decimal"
              defaultValue={expectedDefault}
              placeholder="0.00"
            />
          </label>
          <label className="field" htmlFor={`${baseId}-day`}>
            Day of month
            <input
              id={`${baseId}-day`}
              name="dueDay"
              type="number"
              min={1}
              max={31}
              defaultValue={account?.dueDay ?? ""}
            />
          </label>
          <label className="check" htmlFor={`${baseId}-active`}>
            <input
              id={`${baseId}-active`}
              name="scheduleActive"
              type="checkbox"
              defaultChecked={account?.scheduleActive ?? false}
            />
            Track this every month
          </label>
          <p className="help">
            {type === "income"
              ? "The dashboard adds this when it has not posted yet this month."
              : "The dashboard subtracts this from checking when it has not posted yet this month."}
          </p>
        </fieldset>
      ) : null}

      {account ? (
        <label className="check" htmlFor={`${baseId}-archived`}>
          <input
            id={`${baseId}-archived`}
            name="archived"
            type="checkbox"
            defaultChecked={account.archived}
          />
          Archive this account
        </label>
      ) : null}

      <button className="button" type="submit" disabled={pending}>
        {pending ? "Saving…" : account ? "Save account" : "Create account"}
      </button>
    </form>
  );
}
