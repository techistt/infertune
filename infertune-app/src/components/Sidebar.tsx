import {
  LayoutDashboard,
  Bot,
  Boxes,
  BarChart3,
  FolderOpen,
  Settings,
  FileText,
  GitCompare,
  ClipboardCheck,
  SlidersHorizontal,
  Dumbbell,
  type LucideIcon,
} from "lucide-react";
import pkg from "../../package.json";
import { useAppStore, type Page } from "../store/useAppStore";

const menu: { icon: LucideIcon; label: string; page: Page }[] = [
  { icon: LayoutDashboard, label: "Dashboard", page: "dashboard" },
  { icon: Bot, label: "Playground", page: "playground" },
  { icon: Boxes, label: "Models", page: "models" },
  { icon: BarChart3, label: "Benchmarks", page: "benchmarks" },
  { icon: GitCompare, label: "Compare", page: "compare" },
  { icon: ClipboardCheck, label: "Quality", page: "quality" },
  { icon: SlidersHorizontal, label: "Auto-tune", page: "autotune" },
  { icon: Dumbbell, label: "Fine-tune", page: "finetune" },
  { icon: FolderOpen, label: "Sessions", page: "sessions" },
  { icon: FileText, label: "Logs", page: "logs" },
  { icon: Settings, label: "Settings", page: "settings" },
];

export default function Sidebar() {
  const page = useAppStore((s) => s.page);
  const setPage = useAppStore((s) => s.setPage);

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

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {menu.map(({ icon: Icon, label, page: target }) => {
          const active = page === target;

          return (
            <button
              key={label}
              onClick={() => setPage(target)}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 w-full rounded-lg px-4 py-3 transition ${
                active
                  ? "bg-gray-800 text-white"
                  : "text-gray-400 hover:bg-gray-900 hover:text-white"
              }`}
            >
              <Icon size={20} />
              <span className="flex-1 text-left">{label}</span>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-gray-800 p-4 text-xs text-gray-500">
        InferTune v{pkg.version}
      </div>
    </aside>
  );
}
