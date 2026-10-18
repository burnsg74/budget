import { unstable_rethrow } from "next/navigation";
import type { ReactNode } from "react";

export function logDatabaseError(error: unknown): void {
  unstable_rethrow(error);
  console.error(error);
}

export function PageIntro({
  title,
  lede,
  action,
}: {
  title: string;
  lede?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="intro">
      <div>
        <h1>{title}</h1>
        {lede ? <div className="lede">{lede}</div> : null}
      </div>
      {action}
    </div>
  );
}

export function DatabaseError() {
  return (
    <p className="alert" role="alert">
      The database is not available. Check DATABASE_URL, then run npm run db:setup.
    </p>
  );
}
