import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import ParameterPanel from "../components/ParameterPanel";
import PromptEditor from "../components/PromptEditor";
import ResponsePanel from "../components/ResponsePanel";
import GpuSelector from "../components/GpuSelector";
import HardwareCard from "../components/HardwareCard";
import ModelRecommendationCard from "../components/ModelRecommendationCard";
import PerformanceCard from "../components/PerformanceCard";
import GpuRecommendationCard from "../components/GpuRecommendationCard";
import ModelRankingCard from "../components/ModelRankingCard";

export default function Dashboard() {
  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
      <Sidebar />

      <div className="flex flex-1 min-w-0 flex-col">
        <Header />

        <main className="flex-1 p-4 overflow-y-auto">

          <div className="grid grid-cols-12 gap-5">

            <div className="col-span-3 flex flex-col gap-5 min-h-[420px]">

              <ParameterPanel />

              <GpuSelector />

            </div>

            <div className="col-span-5 min-h-[420px]">
              <PromptEditor />
            </div>

            <div className="col-span-4 min-h-[420px]">
              <ResponsePanel />
            </div>

            <div className="col-span-12 grid grid-cols-1 lg:grid-cols-6 gap-5">

              <div className="lg:col-span-2"><HardwareCard /></div>

              <div className="lg:col-span-2"><GpuRecommendationCard /></div>

              <div className="lg:col-span-2"><ModelRecommendationCard /></div>

              <div className="lg:col-span-3"><ModelRankingCard /></div>

              <div className="lg:col-span-3"><PerformanceCard /></div>

            </div>

          </div>

        </main>
      </div>
    </div>
  );
}