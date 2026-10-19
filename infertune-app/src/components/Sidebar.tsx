import {
  LayoutDashboard,
  Bot,
  Boxes,
  BarChart3,
  FolderOpen,
  Settings,
  FileText,
} from "lucide-react";

const menu = [
  { icon: LayoutDashboard, label: "Dashboard" },
  { icon: Bot, label: "Playground" },
  { icon: Boxes, label: "Models" },
  { icon: BarChart3, label: "Benchmarks" },
  { icon: FolderOpen, label: "Sessions" },
  { icon: FileText, label: "Logs" },
  { icon: Settings, label: "Settings" },
];

export default function Sidebar() {
  return (
    <aside className="w-64 shrink-0 bg-gray-950 border-r border-gray-800 flex flex-col">
      <div className="p-6 border-b border-gray-800">
        <h1>
          <img
            src="/logo.svg"
            alt="InferTune"
            className="h-11 w-auto"
            draggable={false}
          />
        </h1>

        <p className="text-xs text-gray-500 mt-3">
          LLM Tuning Studio
        </p>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {menu.map(({ icon: Icon, label }, index) => {
          const active = index === 0;

          return (
            <button
              key={label}
              disabled={!active}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 w-full rounded-lg px-4 py-3 transition ${
                active
                  ? "bg-gray-800 text-white"
                  : "text-gray-500 cursor-not-allowed"
              }`}
            >
              <Icon size={20} />
              <span className="flex-1 text-left">{label}</span>
              {!active && (
                <span className="text-[10px] uppercase tracking-wide text-gray-600">
                  Soon
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-gray-800 p-4 text-xs text-gray-500">
        InferTune v0.1.0
      </div>
    </aside>
  );
}