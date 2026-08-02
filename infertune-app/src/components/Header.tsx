import { Cpu, MemoryStick, Clock3 } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
 

export default function Header() {
  
   const { model } = useAppStore();

  return (
    <header className="h-16 border-b border-gray-800 bg-gray-900 px-6 flex items-center justify-between">
      <div>
        <h2 className="text-lg font-semibold">
          Dashboard
        </h2>

        <p className="text-sm text-gray-400">
          Active Model: {model}
        </p>
      </div>

      <div className="flex items-center gap-6 text-sm text-gray-300">
        <div className="flex items-center gap-2">
          <Cpu size={18} />
          <span>CPU --%</span>
        </div>

        <div className="flex items-center gap-2">
          <MemoryStick size={18} />
          <span>RAM --%</span>
        </div>

        <div className="flex items-center gap-2">
          <Clock3 size={18} />
          <span>Ready</span>
        </div>
      </div>
    </header>
  );
}