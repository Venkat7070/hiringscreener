export default function StaleBanner({ reason, fetchedAt }: { reason?: string; fetchedAt: string }) {
  return (
    <div className="rounded-md border border-health-amber/40 bg-health-amber/10 px-3 py-2 text-sm text-health-amber">
      Showing cached data from {new Date(fetchedAt).toLocaleString()} — the sheet was unreachable
      {reason ? `: ${reason}` : "."}
    </div>
  );
}
