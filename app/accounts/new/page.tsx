import Link from "next/link";
import { AccountForm } from "@/features/accounts/account-form";
import { createAccount } from "@/features/accounts/actions";
import { PageIntro } from "../../ui";

export default function NewAccountPage() {
  return (
    <main className="page">
      <PageIntro
        title="New account"
        lede="Use the bank’s wording for bills and income so imports can match them."
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
