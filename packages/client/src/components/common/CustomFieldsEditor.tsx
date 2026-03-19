import { Plus, X } from "lucide-react";

interface CustomFieldsEditorProps {
  value: Record<string, string>;
  onChange: (fields: Record<string, string>) => void;
  label?: string;
}

export function CustomFieldsEditor({
  value,
  onChange,
  label = "Custom Fields",
}: CustomFieldsEditorProps) {
  // Convert Record to array of entries for rendering
  const entries = Object.entries(value);

  function handleKeyChange(oldKey: string, newKey: string) {
    const newFields: Record<string, string> = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === oldKey) {
        newFields[newKey] = v;
      } else {
        newFields[k] = v;
      }
    }
    onChange(newFields);
  }

  function handleValueChange(key: string, newValue: string) {
    onChange({ ...value, [key]: newValue });
  }

  function handleAdd() {
    // Generate a unique temporary key to avoid collisions
    let newKey = "";
    let counter = 1;
    while (newKey === "" || newKey in value) {
      newKey = `field_${counter}`;
      counter++;
    }
    onChange({ ...value, [newKey]: "" });
  }

  function handleRemove(key: string) {
    const newFields = { ...value };
    delete newFields[key];
    onChange(newFields);
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">{label}</label>

      {entries.length === 0 && (
        <p className="text-sm text-gray-400">No custom fields added yet.</p>
      )}

      {entries.map(([key, val], index) => (
        <div key={index} className="flex items-start gap-2">
          <input
            type="text"
            value={key}
            onChange={(e) => handleKeyChange(key, e.target.value)}
            placeholder="Field name"
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
          <input
            type="text"
            value={val}
            onChange={(e) => handleValueChange(key, e.target.value)}
            placeholder="Value"
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
          <button
            type="button"
            onClick={() => handleRemove(key)}
            className="mt-1 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
            title="Remove field"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={handleAdd}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors"
      >
        <Plus className="h-4 w-4" />
        Add Field
      </button>
    </div>
  );
}
