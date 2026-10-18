import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page">
      <h1>Not found</h1>
      <p className="lede">That page is not in the budget.</p>
      <p>
        <Link className="button" href="/">
          Go home
        </Link>
      </p>
    </main>
  );
}
