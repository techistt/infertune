import { useRef, useState } from "react";
import { BookMarked, Download, Trash2, Upload } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { usePromptStore } from "../store/promptStore";
import {
  BUILT_IN_PROMPTS,
  parsePromptFile,
  serializePrompts,
} from "../utils/prompts";
import { dateStamp, revealFile, saveDownload } from "../services/fileService";
import { errorMessage } from "../store/logStore";

/** Saved and built-in prompts for the Playground. */
export default function PromptLibrary() {
  const prompts = usePromptStore((s) => s.prompts);
  const savePrompt = usePromptStore((s) => s.savePrompt);
  const deletePrompt = usePromptStore((s) => s.deletePrompt);
  const importPrompts = usePromptStore((s) => s.importPrompts);

  const setSystemPrompt = useAppStore((s) => s.setSystemPrompt);
  const setUserPrompt = useAppStore((s) => s.setUserPrompt);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [savedPath, setSavedPath] = useState<string | null>(null);

  const fileInput = useRef<HTMLInputElement>(null);

  const load = (systemPrompt: string, userPrompt: string) => {
    setSystemPrompt(systemPrompt);
    setUserPrompt(userPrompt);
  };

  const saveCurrent = () => {
    const state = useAppStore.getState();

    if (!name.trim() || !state.userPrompt.trim()) {
      setMessage("Type a prompt and a name first.");
      return;
    }

    savePrompt(name, state.systemPrompt, state.userPrompt);
    setMessage(`Saved "${name.trim()}".`);
    setName("");
  };

  const exportAll = async () => {
    setSavedPath(null);

    try {
      const path = await saveDownload(
        `infertune-prompts-${dateStamp()}.json`,
        serializePrompts(prompts)
      );

      setSavedPath(path);
      setMessage("Exported to your Downloads folder.");
    } catch (e) {
      setMessage(`Export failed: ${errorMessage(e)}`);
    }
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;

    try {
      const added = importPrompts(parsePromptFile(await file.text()));

      setMessage(
        added > 0
          ? `Imported ${added} prompt${added === 1 ? "" : "s"}.`
          : "Everything in that file was already saved."
      );
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-2 text-sm text-gray-300 hover:text-white"
      >
        <BookMarked size={16} />
        Prompt library {prompts.length > 0 && `(${prompts.length} saved)`}
      </button>

      {open && (
        <div className="mt-3 rounded-lg border border-gray-800 bg-gray-950 p-3 space-y-4 text-sm">

          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-gray-500">
              Templates
            </p>
            <div className="flex flex-wrap gap-2">
              {BUILT_IN_PROMPTS.map((t) => (
                <button
                  key={t.name}
                  onClick={() => load(t.systemPrompt, t.userPrompt)}
                  className="rounded bg-gray-800 px-2 py-1 hover:bg-gray-700"
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-gray-500">
              Saved
            </p>

            {prompts.length === 0 ? (
              <p className="text-gray-500">
                Nothing saved yet. Write a prompt, name it below and save it.
              </p>
            ) : (
              <ul className="max-h-40 overflow-y-auto space-y-1">
                {prompts.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-2 rounded bg-gray-800 px-2 py-1"
                  >
                    <button
                      onClick={() => load(p.systemPrompt, p.userPrompt)}
                      className="flex-1 min-w-0 truncate text-left hover:text-blue-300"
                      title={p.userPrompt}
                    >
                      {p.name}
                    </button>
                    <button
                      onClick={() => deletePrompt(p.id)}
                      title="Delete"
                      className="text-gray-500 hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveCurrent();
              }}
              placeholder="Name for the current prompt"
              className="flex-1 min-w-0 rounded bg-gray-800 px-2 py-1 outline-none"
            />
            <button
              onClick={saveCurrent}
              className="rounded bg-blue-600 px-3 py-1 hover:bg-blue-700"
            >
              Save
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={exportAll}
              disabled={prompts.length === 0}
              className="flex items-center gap-1 rounded bg-gray-800 px-2 py-1 hover:bg-gray-700 disabled:opacity-50"
            >
              <Download size={14} /> Export
            </button>

            <button
              onClick={() => fileInput.current?.click()}
              className="flex items-center gap-1 rounded bg-gray-800 px-2 py-1 hover:bg-gray-700"
            >
              <Upload size={14} /> Import
            </button>

            <input
              ref={fileInput}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => importFile(e.target.files?.[0])}
            />

            {savedPath && (
              <button
                onClick={() => revealFile(savedPath).catch(() => {})}
                className="text-blue-400 hover:underline"
              >
                Show in folder
              </button>
            )}
          </div>

          {message && <p className="text-xs text-gray-400">{message}</p>}
        </div>
      )}
    </div>
  );
}
