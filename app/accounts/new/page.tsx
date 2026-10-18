import Link from "next/link";
import { AccountForm } from "@/features/accounts/account-form";
import { createAccount } from "@/features/accounts/actions";
import { PageIntro } from "../../ui";

export default function NewAccountPage() {
  return (
    <main className="page">
      <PageIntro
        title="New account"
        lede="Match text is the part of a bank description that should link to this account."
        action={
          <Link className="button secondary" href="/accounts">
            Back
          </Link>
        }
      />
      <AccountForm action={createAccount} />
    </main>
  );
}
