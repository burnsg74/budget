import { Suspense } from "react";
import { MonthRegister } from "@/features/transactions/month-register";

export default function Home({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; account?: string }>;
}) {
  return (
    <main className="page">
      <Suspense fallback={<p className="muted">Loading transactions…</p>}>
        <MonthRegister searchParams={searchParams} path="/" />
      </Suspense>
    </main>
  );
}
