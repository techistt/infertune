import GpuSelector from "../components/GpuSelector";
import HardwareCard from "../components/HardwareCard";
import ModelRecommendationCard from "../components/ModelRecommendationCard";
import PerformanceCard from "../components/PerformanceCard";
import GpuRecommendationCard from "../components/GpuRecommendationCard";
import ModelRankingCard from "../components/ModelRankingCard";

export default function Dashboard() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-6 gap-5">

      <div className="lg:col-span-2"><HardwareCard /></div>

      <div className="lg:col-span-2"><GpuSelector /></div>

      <div className="lg:col-span-2"><GpuRecommendationCard /></div>

      <div className="lg:col-span-2"><ModelRecommendationCard /></div>

      <div className="lg:col-span-2"><ModelRankingCard /></div>

      <div className="lg:col-span-2"><PerformanceCard /></div>

    </div>
  );
}
