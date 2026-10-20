import { useMemo, useState } from 'react';
import { serializeDocument, toDocument } from '../graph/serialization';
import { downloadGraphJson, suggestFilename } from '../store/persistence';
import { useGraphStore } from '../store/graphStore';

export function JsonPanel() {
  const graphName = useGraphStore((state) => state.graphName);
  const nodes = useGraphStore((state) => state.nodes);
  const edges = useGraphStore((state) => state.edges);
  const notify = useGraphStore((state) => state.notify);
  const [copied, setCopied] = useState(false);

  const document = useMemo(
    () => toDocument(graphName, nodes, edges),
    [graphName, nodes, edges],
  );
  const json = useMemo(() => serializeDocument(document), [document]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      notify({
        kind: 'error',
        message: 'Clipboard access was denied by the browser.',
      });
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
          schema v{document.schemaVersion}
        </span>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-200 transition hover:bg-slate-700"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            type="button"
            onClick={() =>
              downloadGraphJson(suggestFilename(document.name), document)
            }
            className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-200 transition hover:bg-slate-700"
          >
            Download
          </button>
        </div>
      </div>
      <pre className="min-h-0 flex-1 overflow-auto bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-slate-300">
        {json}
      </pre>
    </div>
  );
}
