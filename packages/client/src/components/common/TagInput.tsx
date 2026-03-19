import { useState, useRef, type KeyboardEvent } from "react";
import { X } from "lucide-react";

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  label?: string;
  error?: string;
}

export function TagInput({ value, onChange, placeholder = "Add a tag…", label, error }: TagInputProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function addTag(raw: string) {
    const tag = raw.trim().toLowerCase();
    if (!tag) return;
    if (value.includes(tag)) {
      setInput("");
      return;
    }
    onChange([...value, tag]);
    setInput("");
  }

  function removeTag(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
    }
    // Allow backspace to remove last tag when input is empty
    if (e.key === "Backspace" && input === "" && value.length > 0) {
      removeTag(value.length - 1);
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text");
    const parts = pasted.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    const unique = parts.filter((t) => !value.includes(t));
    if (unique.length > 0) {
      // Deduplicate within the pasted set as well
      const deduped = [...new Set(unique)];
      onChange([...value, ...deduped]);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-gray-700">{label}</label>
      )}
      <div
        className={`flex flex-wrap items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors focus-within:ring-2 focus-within:ring-brand-500 focus-within:border-brand-500 ${
          error ? "border-red-400 bg-red-50" : "border-gray-300 bg-white"
        }`}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag, idx) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 bg-brand-50 text-brand-700 rounded-full px-2 py-0.5 text-xs font-medium"
          >
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(idx);
              }}
              className="text-brand-400 hover:text-brand-700 transition-colors"
              aria-label={`Remove tag ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={() => {
            if (input.trim()) addTag(input);
          }}
          placeholder={value.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[80px] bg-transparent outline-none text-sm placeholder:text-gray-400"
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
