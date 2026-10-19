import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Square, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { getActiveProfile, useActiveProfile } from "../store/settingsStore";
import { newRecordId, useHistoryStore } from "../store/historyStore";
import { toConfig } from "../types/provider";
import { listModels } from "../services/modelService";
import { generateText } from "../services/llmService";
import { logger, errorMessage } from "../store/logStore";
import { tokensPerSecond, formatDateTime } from "../utils/format";
import { withHint } from "../utils/hints";
import { notifyDone } from "../services/notify";
import { useQuestionSetStore } from "../store/questionSetStore";
import QuestionSetEditor from "../components/QuestionSetEditor";
import {
  CATEGORY_LABEL,
  QUALITY_QUESTIONS,
  toQuestions,
  grade,
  scoreAnswers,
  snippet,
  stripThinking,
  type GradedAnswer,
  type QualityCategory,
} from "../utils/quality";

export default function Quality() {
  const profile = useActiveProfile();
  const online = useAppStore((s) => s.providerOnline);
  const activeModel = useAppStore((s) => s.model);

  const runs = useHistoryStore((s) => s.qualityRuns ?? []);
  const deleteRun = useHistoryStore((s) => s.deleteQualityRun);
  const clearRuns = useHistoryStore((s) => s.clearQualityRuns);

  const [available, setAvailable] = useState<string[]>([]);
  const [model, setModel] = useState(activeModel);
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const sets = useQuestionSetStore((s) => s.sets);
  const [setId, setSetId] = useState("builtin");
  const [editing, setEditing] = useState(false);

  const customSet = sets.find((x) => x.id === setId) ?? null;
  const setName = customSet ? customSet.name : "Built-in";
  const questions = customSet ? toQuestions(customSet) : QUALITY_QUESTIONS;

  const cancelRef = useRef(false);

  const loadModels = useCallback(async () => {
    try {
      const names = (await listModels(toConfig(profile))).map((m) => m.name);

      setAvailable(names);
      setModel((current) => (names.includes(current) ? current : names[0] ?? ""));
    } catch {
      setAvailable([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id, profile.kind, profile.baseUrl, profile.apiKey, online]);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const start = async () => {
    if (running || !model) return;

    const active = getActiveProfile();
    const provider = toConfig(active);

    cancelRef.current = false;
    setRunning(true);
    setError(null);
    setStep(0);
    logger.info("quality", `Started quality check on ${model}`);

    const graded: GradedAnswer[] = [];
    const detail: {
      id: string;
      category: string;
      prompt: string;
      expected: string;
      answer: string;
      correct: boolean;
    }[] = [];
    const speeds: number[] = [];

    try {
      for (const q of questions) {
        if (cancelRef.current) break;

        const result = await generateText(
          {
            model,
            systemPrompt:
              "You are a careful assistant. Answer exactly as asked, briefly.",
            userPrompt: q.prompt,
            temperature: 0,
            topP: 1,
            topK: 40,
            maxTokens: 400,
            seed: 42,
            contextLength: 4096,
          },
          provider
        );

        const answer = stripThinking(result.text);
        const correct = grade(q, answer);

        graded.push({ id: q.id, category: q.category, correct, answer });
        detail.push({
          id: q.id,
          category: q.category,
          prompt: q.prompt,
          expected: q.expected,
          answer,
          correct,
        });

        if (result.generationTime > 0) {
          speeds.push(tokensPerSecond(result.tokens, result.generationTime));
        }

        setStep(graded.length);
      }
    } catch (e) {
      const message = `${model}: ${errorMessage(e)}`;
      setError(withHint(message));
      logger.error("quality", message);
    }

    // Only save complete runs; partial scores would be misleading.
    if (graded.length === questions.length && questions.length > 0) {
      const score = scoreAnswers(graded);

      useHistoryStore.getState().addQualityRun({
        id: newRecordId(),
        createdAt: Date.now(),
        providerName: active.name,
        model,
        setName,
        correct: score.correct,
        total: score.total,
        percent: score.percent,
        byCategory: score.byCategory,
        answers: detail,
        avgTokensPerSecond:
          speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0,
      });

      logger.info("quality", `${model}: ${score.correct}/${score.total}`);
      notifyDone("Quality check finished", `${model}: ${score.correct}/${score.total} correct`);
    }

    setRunning(false);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <h2 className="text-xl font-semibold">Quality check</h2>
        <p className="mt-1 text-sm text-gray-400">
          Asks the model {questions.length} short questions at temperature 0 and
          grades the answers automatically. The built-in set covers math, logic,
          knowledge, instructions and code; you can also write your own. Use it to see what a smaller or more compressed model
          gives up. It is a quick sanity check, not a full benchmark.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[16rem] flex-1">
            <label className="mb-1 block text-xs text-gray-400">Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={running}
              className="w-full rounded-lg bg-gray-800 p-2"
            >
              {available.length === 0 && <option value="">No models</option>}
              {available.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[12rem]">
            <label className="mb-1 block text-xs text-gray-400">Question set</label>
            <select
              value={setId}
              onChange={(e) => setSetId(e.target.value)}
              disabled={running}
              className="w-full rounded-lg bg-gray-800 p-2"
            >
              <option value="builtin">Built-in ({QUALITY_QUESTIONS.length})</option>
              {sets.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name} ({x.questions.length})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setEditing((v) => !v)}
            disabled={running}
            className="rounded-lg bg-gray-700 px-3 py-2 hover:bg-gray-600 disabled:opacity-50"
          >
            {editing ? "Close editor" : "My question sets"}
          </button>

          {running ? (
            <button
              onClick={() => (cancelRef.current = true)}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 hover:bg-red-700"
            >
              <Square size={16} /> Stop
            </button>
          ) : (
            <button
              onClick={start}
              disabled={!model}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
            >
              <Play size={16} /> Run check
            </button>
          )}
        </div>

        {running && (
          <p className="mt-3 text-sm text-gray-300">
            Question {Math.min(step + 1, questions.length)} of{" "}
            {questions.length}...
          </p>
        )}

        {error && (
          <p className="mt-3 rounded-lg bg-red-950 p-3 text-sm text-red-300 break-words">
            {error}
          </p>
        )}
      </div>

      {editing && <QuestionSetEditor onUse={(id) => setSetId(id)} />}

      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Results</h2>
          {runs.length > 0 && (
            <button
              onClick={clearRuns}
              className="text-sm text-gray-400 hover:text-red-400"
            >
              Clear all
            </button>
          )}
        </div>

        {runs.length === 0 ? (
          <p className="py-6 text-center text-gray-500">
            No quality checks yet.
          </p>
        ) : (
          <div className="space-y-2">
            {runs.map((run) => (
              <div key={run.id} className="rounded-lg bg-gray-800/60">
                <div className="flex items-center gap-3 p-3">
                  <button
                    onClick={() => setOpen(open === run.id ? null : run.id)}
                    className="flex flex-1 items-center gap-3 text-left"
                  >
                    {open === run.id ? (
                      <ChevronDown size={16} />
                    ) : (
                      <ChevronRight size={16} />
                    )}
                    <span className="font-medium break-all">{run.model}</span>
                    <span className="text-xs text-gray-500">
                      {run.providerName} · {run.setName ?? "Built-in"} · {formatDateTime(run.createdAt)}
                    </span>
                  </button>

                  <div className="hidden gap-2 text-xs text-gray-400 md:flex">
                    {run.byCategory.map((c) => (
                      <span key={c.category}>
                        {CATEGORY_LABEL[c.category as QualityCategory] ?? c.category}{" "}
                        {c.correct}/{c.total}
                      </span>
                    ))}
                  </div>

                  <span
                    className={`rounded px-2 py-1 text-sm font-medium ${
                      run.percent >= 80
                        ? "bg-green-900/60 text-green-300"
                        : run.percent >= 50
                          ? "bg-yellow-900/60 text-yellow-300"
                          : "bg-red-900/60 text-red-300"
                    }`}
                  >
                    {run.correct}/{run.total} · {run.percent.toFixed(0)}%
                  </span>

                  <button
                    onClick={() => deleteRun(run.id)}
                    title="Delete"
                    className="text-gray-500 hover:text-red-400"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {open === run.id && (
                  <div className="overflow-x-auto border-t border-gray-800 p-3">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-400">
                          <th className="py-1 pr-3 font-medium">Question</th>
                          <th className="py-1 pr-3 font-medium">Expected</th>
                          <th className="py-1 pr-3 font-medium">Model said</th>
                          <th className="py-1 font-medium"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {run.answers.map((a) => (
                          <tr key={a.id} className="border-t border-gray-800/60 align-top">
                            <td className="py-2 pr-3 text-gray-300">{snippet(a.prompt, 90)}</td>
                            <td className="py-2 pr-3 whitespace-nowrap">{a.expected}</td>
                            <td className="py-2 pr-3 break-words">{snippet(a.answer) || "(empty)"}</td>
                            <td className="py-2">{a.correct ? "✓" : "✗"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
