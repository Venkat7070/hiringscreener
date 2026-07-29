import { useState } from "react";

export function TagEditor({
  tags,
  onChange,
  disabled,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
}) {
  const [newTag, setNewTag] = useState("");

  function handleAddTag() {
    const tag = newTag.trim();
    if (!tag || tags.includes(tag)) {
      setNewTag("");
      return;
    }
    setNewTag("");
    onChange([...tags, tag]);
  }

  function handleRemoveTag(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  return (
    <div className="flex max-w-[220px] flex-wrap items-center gap-1">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-700"
        >
          {tag}
          <button
            onClick={() => handleRemoveTag(tag)}
            disabled={disabled}
            className="text-stone-400 hover:text-red-600"
            aria-label={`Remove tag ${tag}`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        value={newTag}
        onChange={(e) => setNewTag(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleAddTag();
          }
        }}
        disabled={disabled}
        placeholder="+ tag"
        className="w-16 rounded-md border border-stone-200 px-1.5 py-0.5 text-[11px] focus:w-24 focus:outline-none"
      />
    </div>
  );
}
