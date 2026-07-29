export function ProgressBar({ step, totalSteps }: { step: number; totalSteps: number }) {
  return (
    <div className="mb-8">
      <div className="mb-2 flex justify-between text-xs font-medium text-stone-500">
        <span>
          Step {step} of {totalSteps}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200">
        <div
          className="h-full rounded-full bg-amber transition-all duration-300"
          style={{ width: `${(step / totalSteps) * 100}%` }}
        />
      </div>
    </div>
  );
}
