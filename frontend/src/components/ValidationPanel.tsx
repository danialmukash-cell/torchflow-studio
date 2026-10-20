import { useGraphStore } from '../store/graphStore';

export function ValidationPanel() {
  const validation = useGraphStore((state) => state.validation);
  const status = useGraphStore((state) => state.backendStatus);
  return (
    <div className="h-full overflow-y-auto p-4 text-xs">
      <h2 className="mb-3 font-semibold text-slate-100">Graph validation</h2>
      {status === 'validating' && <p className="text-sky-300">Validating…</p>}
      {!validation && <p className="leading-relaxed text-slate-400">Select Validate to check all connections, parameter types, output dimensions and tensor shapes against the local FastAPI backend.</p>}
      {validation && <>
        <p role="status" className={validation.valid ? 'mb-3 text-emerald-300' : 'mb-3 text-rose-300'}>{validation.valid ? '✓ Valid network' : `⚠ ${validation.errors.length} issue(s)`}</p>
        {validation.errors.map((err, idx) => <div key={idx} className="mb-2 rounded border border-rose-900/50 bg-rose-950/30 p-2 text-rose-200"><span className="font-semibold">{err.code}</span><p className="mt-1 break-words">{err.message}</p></div>)}
        <div className="mt-4 border-t border-slate-800 pt-3"><h3 className="mb-2 font-semibold text-slate-200">Inferred tensor shapes (excluding batch dimension)</h3>{Object.entries(validation.shapes).map(([id, shape]) => <div key={id} className="flex justify-between gap-2 border-b border-slate-800 py-1 font-mono text-[10px]"><span className="truncate text-slate-400" title={id}>{id}</span><span className="text-sky-300">[{shape.join(', ')}]</span></div>)}</div>
      </>}
    </div>
  );
}
