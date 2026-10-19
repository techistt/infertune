import { CONTEXT_OPTIONS } from "../utils/format";

interface ContextSelectProps {
  value: number;
  onChange: (value: number) => void;
  /** Largest size the model supports; larger options are hidden. */
  limit?: number | null;
  className?: string;
}

export default function ContextSelect({
  value,
  onChange,
  limit = null,
  className = "w-full rounded-lg bg-gray-800 p-2",
}: ContextSelectProps) {
  const options = CONTEXT_OPTIONS.filter((n) => limit === null || n <= limit);

  // Always keep the current value selectable (e.g. a model limit of 40,960).
  if (!options.includes(value)) {
    options.push(value);
    options.sort((a, b) => a - b);
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className={className}
    >
      {options.map((n) => (
        <option key={n} value={n}>
          {n.toLocaleString()} tokens
        </option>
      ))}
    </select>
  );
}
