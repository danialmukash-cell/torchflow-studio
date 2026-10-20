import { useGraphStore } from '../store/graphStore';

export function CodePanel() {
  const code = useGraphStore((state) => state.generatedCode);
  const status = useGraphStore((state) => state.backendStatus);
  const download = () => {
    if (!code) return;
    const url = URL.createObjectURL(new Blob([code], { type: 'text/x-python' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'torchflow_model.py';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <div className="flex h-full min-h-0 flex-col p-3 text-xs">
    <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold text-slate-100">Generated PyTorch</h2>
      <button type="button" onClick={download} disabled={!code} className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-slate-200 disabled:opacity-40">Download .py</button>
    </div>
    {!code && <p className="text-slate-400">{status === 'generating' ? 'Generating…' : 'Click Generate PyTorch to validate the graph and generate a torch.nn.Module.'}</p>}
    {code && <pre className="min-h-0 flex-1 overflow-auto rounded border border-slate-800 bg-slate-900 p-3 font-mono text-[10px] leading-relaxed text-sky-100"><code>{code}</code></pre>}
  </div>;
}
