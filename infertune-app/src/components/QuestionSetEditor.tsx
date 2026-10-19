import { useState } from "react";
import { Plus, Trash2, Download, Upload } from "lucide-react";
import { useQuestionSetStore } from "../store/questionSetStore";
import { newRecordId } from "../store/historyStore";
import {
  MATCH_LABEL,
  parseSet,
  serializeSet,
  validateQuestion,
  type CustomQuestion,
  type MatchMode,
  type QuestionSet,
} from "../utils/quality";
import { dateStamp, revealFile, saveDownload } from "../services/fileService";

const blank = (): CustomQuestion => ({
  id: newRecordId(),
  prompt: "",
  expected: "",
  mode: "contains",
});

interface Props {
  /** Called with the id of a set the user saved or picked. */
  onUse: (id: string) => void;
}

export default function QuestionSetEditor({ onUse }: Props) {
  const sets = useQuestionSetStore((s) => s.sets);
  const saveSet = useQuestionSetStore((s) => s.saveSet);
  const deleteSet = useQuestionSetStore((s) => s.deleteSet);

  const [draft, setDraft] = useState<QuestionSet>({
    id: newRecordId(),
    name: "",
    questions: [blank()],
  });
  const [message, setMessage] = useState("");
  const [importText, setImportText] = useState("");
  const [showImport, setShowImport] = useState(false);

  const update = (id: string, patch: Partial<CustomQuestion>) =>
    setDraft((d) => ({
      ...d,
      questions: d.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)),
    }));

  const save = () => {
    if (!draft.name.trim()) return setMessage("Give the set a name.");

    for (const [i, q] of draft.questions.entries()) {
      const problem = validateQuestion(q);

      if (problem) return setMessage(`Question ${i + 1}: ${problem}`);
    }

    saveSet({ ...draft, name: draft.name.trim() });
    onUse(draft.id);
    setMessage(`Saved "${draft.name.trim()}". It is now selected.`);
  };

  const startNew = () => {
    setDraft({ id: newRecordId(), name: "", questions: [blank()] });
    setMessage("");
  };

  const doImport = () => {
    const parsed = parseSet(importText);

    if (!parsed) return setMessage("That is not a valid question set file.");

    setDraft({ id: newRecordId(), ...parsed });
    setShowImport(false);
    setImportText("");
    setMessage("Imported. Review it and press Save.");
  };

  const exportSet = async (set: QuestionSet) => {
    try {
      const path = await saveDownload(
        `infertune-questions-${dateStamp()}.json`,
        serializeSet(set)
      );

      setMessage(`Saved to ${path}`);
      revealFile(path).catch(() => undefined);
    } catch {
      setMessage("Could not save the file.");
    }
  };

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <h2 className="text-xl font-semibold">My question sets</h2>
      <p className="mt-1 text-sm text-gray-400">
        Write questions for your own use case and say how an answer is judged.
        Use short, checkable answers (a word, a number, or a pattern).
      </p>

      {sets.length > 0 && (
        <div className="mt-4 space-y-1">
          {sets.map((set) => (
            <div key={set.id} className="flex items-center gap-2 rounded bg-gray-800/60 px-3 py-2 text-sm">
              <span className="flex-1">
                {set.name} <span className="text-gray-500">({set.questions.length})</span>
              </span>
              <button onClick={() => onUse(set.id)} className="text-blue-400 hover:text-blue-300">Use</button>
              <button onClick={() => setDraft(structuredClone(set))} className="text-gray-300 hover:text-white">Edit</button>
              <button onClick={() => exportSet(set)} title="Export" className="text-gray-400 hover:text-white"><Download size={14} /></button>
              <button onClick={() => deleteSet(set.id)} title="Delete" className="text-gray-500 hover:text-red-400"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 space-y-3">
        <input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder="Set name, e.g. Support replies"
          className="w-full rounded-lg bg-gray-800 p-2"
        />

        {draft.questions.map((q, i) => (
          <div key={q.id} className="rounded-lg border border-gray-800 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>Question {i + 1}</span>
              <button
                onClick={() =>
                  setDraft({ ...draft, questions: draft.questions.filter((x) => x.id !== q.id) })
                }
                className="hover:text-red-400"
              >
                Remove
              </button>
            </div>
            <textarea
              value={q.prompt}
              onChange={(e) => update(q.id, { prompt: e.target.value })}
              rows={2}
              placeholder="What to ask the model"
              className="w-full rounded-lg bg-gray-800 p-2 text-sm"
            />
            <div className="flex flex-wrap gap-2">
              <select
                value={q.mode}
                onChange={(e) => update(q.id, { mode: e.target.value as MatchMode })}
                className="rounded-lg bg-gray-800 p-2 text-sm"
              >
                {(Object.keys(MATCH_LABEL) as MatchMode[]).map((m) => (
                  <option key={m} value={m}>{MATCH_LABEL[m]}</option>
                ))}
              </select>
              <input
                value={q.expected}
                onChange={(e) => update(q.id, { expected: e.target.value })}
                placeholder="Expected answer"
                className="min-w-[12rem] flex-1 rounded-lg bg-gray-800 p-2 text-sm"
              />
            </div>
          </div>
        ))}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setDraft({ ...draft, questions: [...draft.questions, blank()] })}
            className="flex items-center gap-1 rounded-lg bg-gray-700 px-3 py-2 text-sm hover:bg-gray-600"
          >
            <Plus size={14} /> Add question
          </button>
          <button onClick={save} className="rounded-lg bg-blue-600 px-4 py-2 text-sm hover:bg-blue-700">
            Save set
          </button>
          <button onClick={startNew} className="rounded-lg bg-gray-700 px-3 py-2 text-sm hover:bg-gray-600">
            New set
          </button>
          <button
            onClick={() => setShowImport((v) => !v)}
            className="flex items-center gap-1 rounded-lg bg-gray-700 px-3 py-2 text-sm hover:bg-gray-600"
          >
            <Upload size={14} /> Import
          </button>
        </div>

        {showImport && (
          <div className="space-y-2">
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={5}
              placeholder="Paste the contents of an exported question set file"
              className="w-full rounded-lg bg-gray-800 p-2 font-mono text-xs"
            />
            <button onClick={doImport} className="rounded-lg bg-blue-600 px-3 py-2 text-sm hover:bg-blue-700">
              Load
            </button>
          </div>
        )}

        {message && <p className="text-sm text-gray-300 break-words">{message}</p>}
      </div>
    </div>
  );
}
