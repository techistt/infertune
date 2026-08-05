import HardwareMonitor from "./HardwareMonitor";

export default function HardwareCard() {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 h-full overflow-hidden">
      <h2 className="mb-4 text-lg font-semibold">
        Hardware Monitor
      </h2>

      <HardwareMonitor />
    </div>
  );
}