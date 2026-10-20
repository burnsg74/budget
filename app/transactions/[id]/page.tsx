import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export default function TransactionPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense>
      <RedirectToEdit params={params} />
    </Suspense>
  );
}

async function RedirectToEdit({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  redirect(`/transactions/${id}/edit`);
  return null;
}
