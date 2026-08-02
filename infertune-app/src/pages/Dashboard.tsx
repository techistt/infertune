import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import ParameterPanel from "../components/ParameterPanel";
import PromptEditor from "../components/PromptEditor";
import ResponsePanel from "../components/ResponsePanel";

export default function Dashboard() {
  return (
    <div className="flex h-screen bg-gray-950 text-white">
      <Sidebar />

      <div className="flex flex-1 flex-col">
        <Header />

        <main className="flex-1 min-h-0 p-6 overflow-hidden">
          <div className="grid h-full min-h-0 grid-cols-12 gap-5">
            <div className="col-span-3 min-h-0">
              <ParameterPanel />
            </div>

            <div className="col-span-5 min-h-0">
              <PromptEditor />
            </div>

            <div className="col-span-4 min-h-0">
              <ResponsePanel />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}