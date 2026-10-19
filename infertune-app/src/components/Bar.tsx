interface BarProps {
  /** 0-100 */
  percent: number;
  className?: string;
}

/** Slim progress bar that turns amber and red as it fills. */
export default function Bar({ percent, className = "" }: BarProps) {
  const value = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));

  const color =
    value >= 90 ? "bg-red-500" : value >= 70 ? "bg-yellow-500" : "bg-blue-500";

  return (
    <div
      className={`h-2 w-full rounded-full bg-gray-800 overflow-hidden ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}
