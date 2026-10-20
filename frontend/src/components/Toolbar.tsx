import { useRef } from 'react';
import { EXAMPLES, type ExampleKey } from '../graph/examples';
import { parseDocument } from '../graph/serialization';
import {
  downloadGraphJson,
  readFileAsText,
  suggestFilename,
} from '../store/persistence';
import { useGraphStore } from '../store/graphStore';

const buttonClasses =
  'rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700';

export function Toolbar() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const nodes = useGraphStore((state) => state.nodes);
  const graphName = useGraphStore((state) => state.graphName);
  const getDocument = useGraphStore((state) => state.getDocument);
  const loadDocument = useGraphStore((state) => state.loadDocument);
  const loadExample = useGraphStore((state) => state.loadExample);
  const newGraph = useGraphStore((state) => state.newGraph);
  const notify = useGraphStore((state) => state.notify);

  const handleSave = () => {
    const document = getDocument();
    downloadGraphJson(suggestFilename(document.name), document);
    notify({ kind: 'info', message: 'Graph downloaded as JSON.' });
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const text = await readFileAsText(file);
      const result = parseDocument(text);
      if (!result.ok) {
        notify({ kind: 'error', message: result.error });
        return;
      }
      loadDocument(result.document);
    } catch (error) {
      notify({
        kind: 'error',
        message:
          error instanceof Error ? error.message : 'Could not read the file.',
      });
    }
  };

  const handleNew = () => {
    if (nodes.length > 0 && !window.confirm('Discard the current graph?')) {
      return;
    }
    newGraph();
  };

  return (
    <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-800 bg-slate-950 px-4 py-2.5">
      <div className="flex items-baseline gap-3">
        <h1 className="text-sm font-semibold tracking-tight text-slate-100">
          TorchFlow <span className="text-sky-400">Studio</span>
        </h1>
        <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
          Milestone 1
        </span>
        <span className="hidden truncate text-xs text-slate-500 md:inline">
          {graphName}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button type="button" onClick={handleNew} className={buttonClasses}>
          New
        </button>

        <button type="button" onClick={handleSave} className={buttonClasses}>
          Save
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={buttonClasses}
        >
          Load
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={(event) => void handleFileChange(event)}
          className="hidden"
        />

        <select
          value=""
          onChange={(event) => {
            const key = event.target.value as ExampleKey;
            if (!key) return;
            loadExample(key);
          }}
          className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs font-medium text-slate-200 outline-none transition hover:bg-slate-700 focus:border-sky-500"
        >
          <option value="">Examples…</option>
          {EXAMPLES.map((example) => (
            <option key={example.key} value={example.key}>
              {example.label}
            </option>
          ))}
        </select>
      </div>
    </header>
  );
}
