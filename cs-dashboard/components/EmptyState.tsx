export default function EmptyState({ sheetTab }: { sheetTab?: string }) {
  return (
    <div className="rounded-lg border border-border bg-panel p-8 text-center">
      <h2 className="font-display text-lg">No account rows found</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-text/60">
        The sheet tab <span className="text-text/80">&quot;{sheetTab ?? "Data"}&quot;</span> was reachable but had no
        data rows. Add rows below a header row containing columns like{" "}
        <span className="text-text/80">Account Name, Tier, ARR ($), Renewal Date, Health</span>, etc.
      </p>
    </div>
  );
}
