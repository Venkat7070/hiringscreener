function scoreBadgeClass(score: number | null): string {
  if (score === null) return "bg-stone-100 text-stone-400";
  if (score >= 80) return "bg-emerald-100 text-emerald-800";
  if (score >= 60) return "bg-amber/20 text-amber-dark";
  if (score >= 40) return "bg-orange-100 text-orange-700";
  return "bg-red-100 text-red-700";
}

export function ScoreBadge({ score }: { score: number | null }) {
  return (
    <span
      className={`inline-flex min-w-[2.25rem] justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${scoreBadgeClass(score)}`}
    >
      {score ?? "—"}
    </span>
  );
}
