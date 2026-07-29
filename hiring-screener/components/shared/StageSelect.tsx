import { STAGES, type Stage } from "@/lib/types";

const STAGE_STYLES: Record<Stage, string> = {
  Applied: "border-stone-300 bg-stone-50 text-stone-700",
  Screened: "border-sky-300 bg-sky-50 text-sky-800",
  Shortlisted: "border-emerald-300 bg-emerald-50 text-emerald-800",
  Interview: "border-violet-300 bg-violet-50 text-violet-800",
  "Final Select": "border-amber bg-amber/10 text-stone-900",
  Rejected: "border-red-300 bg-red-50 text-red-700",
};

export function StageSelect({
  value,
  onChange,
  disabled,
}: {
  value: Stage;
  onChange: (stage: Stage) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as Stage)}
      className={`rounded-md border px-2 py-1 text-xs font-medium ${STAGE_STYLES[value]}`}
    >
      {STAGES.map((s) => (
        <option key={s} value={s} className="bg-white text-stone-900">
          {s}
        </option>
      ))}
    </select>
  );
}
