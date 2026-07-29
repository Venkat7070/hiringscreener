"use client";

import { useEffect, useRef } from "react";

interface MultiSelectFilterProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}

export default function MultiSelectFilter({ label, options, selected, onChange }: MultiSelectFilterProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (detailsRef.current && !detailsRef.current.contains(e.target as Node)) {
        detailsRef.current.open = false;
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <details ref={detailsRef} className="relative">
      <summary
        className="cursor-pointer select-none list-none rounded-md border border-border bg-panel px-3 py-1.5 text-sm text-text hover:border-accent/60 [&::-webkit-details-marker]:hidden"
      >
        {label}
        {selected.length > 0 && (
          <span className="ml-1.5 rounded bg-accent/20 px-1.5 py-0.5 text-xs text-accent num">
            {selected.length}
          </span>
        )}
      </summary>
      <div className="absolute left-0 z-20 mt-1 max-h-64 w-52 overflow-y-auto rounded-md border border-border bg-panel p-1.5 shadow-xl">
        {options.length === 0 && <div className="px-2 py-1 text-xs text-text/50">No options</div>}
        {options.map((opt) => (
          <label
            key={opt}
            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-white/5"
          >
            <input
              type="checkbox"
              checked={selected.includes(opt)}
              onChange={() => toggle(opt)}
              className="h-3.5 w-3.5 accent-accent"
            />
            <span className="truncate">{opt}</span>
          </label>
        ))}
      </div>
    </details>
  );
}
