import ParameterPanel from "../components/ParameterPanel";
import PromptEditor from "../components/PromptEditor";
import ResponsePanel from "../components/ResponsePanel";

export default function Playground() {
  return (
    <div className="grid grid-cols-12 gap-5">

      <div className="col-span-12 lg:col-span-3 min-h-[420px]">
        <ParameterPanel />
      </div>

      <div className="col-span-12 lg:col-span-5 min-h-[420px]">
        <PromptEditor />
      </div>

      <div className="col-span-12 lg:col-span-4 min-h-[420px] lg:h-[calc(100vh-8rem)]">
        <ResponsePanel />
      </div>

    </div>
  );
}
