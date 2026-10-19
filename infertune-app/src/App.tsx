import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import Dashboard from "./pages/Dashboard";
import Playground from "./pages/Playground";
import Models from "./pages/Models";
import Benchmarks from "./pages/Benchmarks";
import Compare from "./pages/Compare";
import Sessions from "./pages/Sessions";
import Logs from "./pages/Logs";
import Settings from "./pages/Settings";
import { useAppStore } from "./store/useAppStore";
import { useHardwarePolling } from "./hooks/useHardwarePolling";
import { useProviderStatus } from "./hooks/useProviderStatus";

function App() {
  // Background monitoring for every page.
  useHardwarePolling();
  useProviderStatus();

  const page = useAppStore((s) => s.page);

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
      <Sidebar />

      <div className="flex flex-1 min-w-0 flex-col">
        <Header />

        <main className="flex-1 min-h-0 p-4 overflow-y-auto">
          {page === "dashboard" && <Dashboard />}
          {page === "playground" && <Playground />}
          {page === "models" && <Models />}
          {page === "benchmarks" && <Benchmarks />}
          {page === "compare" && <Compare />}
          {page === "sessions" && <Sessions />}
          {page === "logs" && <Logs />}
          {page === "settings" && <Settings />}
        </main>
      </div>
    </div>
  );
}

export default App;
