import { Health } from "@/lib/types";
import { HEALTH_BADGE_CLASS } from "@/lib/format";

export default function HealthBadge({ health, overridden }: { health: Health; overridden?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${HEALTH_BADGE_CLASS[health]}`}
    >
      {health}
      {overridden && (
        <span title="CSM manual health differs from computed score" className="text-text/50">
          *
        </span>
      )}
    </span>
  );
}
