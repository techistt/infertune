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
    <aside className="w-64 bg-gray-950 border-r border-gray-800 flex flex-col">
      <div className="p-6 border-b border-gray-800">
        <h1 className="text-2xl font-bold text-blue-400">
          InferTune
        </h1>

        <p className="text-xs text-gray-500 mt-1">
          LLM Tuning Studio
        </p>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {menu.map(({ icon: Icon, label }) => (
          <button
            key={label}
            className="flex items-center gap-3 w-full rounded-lg px-4 py-3 text-gray-300 hover:bg-gray-800 hover:text-white transition"
          >
            <Icon size={20} />
            {label}
          </button>
        ))}
      </nav>

      <div className="border-t border-gray-800 p-4 text-xs text-gray-500">
        InferTune v0.1.0
      </div>
    </aside>
  );
}