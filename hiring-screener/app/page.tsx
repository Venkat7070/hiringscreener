import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-semibold text-stone-950">Yellow.ai — Forward Deployed Hiring</h1>
      <p className="mt-3 max-w-md text-stone-600">
        Applying for a Forward Deployed role? Head to the application form.
      </p>
      <Link
        href="/apply"
        className="mt-8 rounded-md bg-amber px-6 py-3 font-medium text-stone-950 transition hover:bg-amber-dark"
      >
        Start application
      </Link>
    </main>
  );
}
