import { useEffect, useState } from 'react';
import { GraphCanvas } from './components/GraphCanvas';
import { Inspector } from './components/Inspector';
import { JsonPanel } from './components/JsonPanel';
import { NodePalette } from './components/NodePalette';
import { NoticeBanner } from './components/NoticeBanner';
import { Toolbar } from './components/Toolbar';
import { ValidationPanel } from './components/ValidationPanel';
import { CodePanel } from './components/CodePanel';
import { useGraphStore } from './store/graphStore';
import {
  loadFromLocalStorage,
  saveToLocalStorage,
} from './store/persistence';

type RightTab = 'inspector' | 'validation' | 'code' | 'json';

export default function App() {
  const [hydrated, setHydrated] = useState(false);
  const [rightTab, setRightTab] = useState<RightTab>('inspector');

  const graphName = useGraphStore((state) => state.graphName);
  const nodes = useGraphStore((state) => state.nodes);
  const edges = useGraphStore((state) => state.edges);
  const loadDocument = useGraphStore((state) => state.loadDocument);
  const getDocument = useGraphStore((state) => state.getDocument);

  // Restore the previous editing session (once).
  useEffect(() => {
    const stored = loadFromLocalStorage();
    if (stored) loadDocument(stored, { silent: true });
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced autosave.
  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      saveToLocalStorage(getDocument());
    }, 400);
    return () => window.clearTimeout(timer);
  }, [hydrated, graphName, nodes, edges, getDocument]);

  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-200">
      <Toolbar />

      <main className="grid min-h-0 flex-1 grid-cols-[220px_minmax(0,1fr)_340px] overflow-hidden">
        <NodePalette />

        <section className="relative min-h-0 min-w-0">
          <GraphCanvas />
        </section>

        <aside className="flex min-h-0 flex-col border-l border-slate-800 bg-slate-950">
          <div className="flex shrink-0 border-b border-slate-800">
            <TabButton
              active={rightTab === 'inspector'}
              onClick={() => setRightTab('inspector')}
            >
              Inspector
            </TabButton>
            <TabButton active={rightTab === 'validation'} onClick={() => setRightTab('validation')}>Validation</TabButton>
            <TabButton active={rightTab === 'code'} onClick={() => setRightTab('code')}>PyTorch</TabButton>
            <TabButton
              active={rightTab === 'json'}
              onClick={() => setRightTab('json')}
            >
              Graph JSON
            </TabButton>
          </div>
          <div className="min-h-0 flex-1">
            {rightTab === 'inspector' ? <Inspector /> : rightTab === 'validation' ? <ValidationPanel /> : rightTab === 'code' ? <CodePanel /> : <JsonPanel />}
          </div>
        </aside>
      </main>

      <NoticeBanner />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 px-3 py-2 text-[11px] font-medium uppercase tracking-wide transition ${
        active
          ? 'border-b-2 border-sky-500 text-slate-100'
          : 'border-b-2 border-transparent text-slate-500 hover:text-slate-300'
      }`}
    >
      {children}
    </button>
  );
}
