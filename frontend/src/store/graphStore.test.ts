import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGraphStore } from './graphStore';

const validation = { valid: true, errors: [], shapes: { 'mlp-output': [10] }, nodeErrors: {} };
const generated = { valid: true, errors: [], code: 'class TorchFlowModel: ...', className: 'TorchFlowModel' };

beforeEach(() => useGraphStore.setState(useGraphStore.getInitialState(), true));

afterEach(() => {
  vi.unstubAllGlobals();
  useGraphStore.getState().newGraph();
});

describe('document history', () => {
  const store = () => useGraphStore.getState();

  it('restores a deleted node together with its connections and parameters', () => {
    store().loadExample('mlp-classifier');
    const original = structuredClone(store().getDocument());
    const layer = original.nodes.find((node) => node.type === 'linear')!;
    store().deleteNode(layer.id);
    const deleted = structuredClone(store().getDocument());
    expect(deleted.edges.length).toBeLessThan(original.edges.length);
    store().undo();
    expect(store().getDocument()).toEqual(original);
    store().redo();
    expect(store().getDocument()).toEqual(deleted);
  });

  it('restores parameter edits, names, imports, and New', () => {
    store().loadExample('mlp-classifier');
    const original = structuredClone(store().getDocument());
    const layer = original.nodes.find((node) => node.type === 'linear')!;
    store().updateNodeParams(layer.id, { out_features: 17 });
    store().setGraphName('Changed');
    store().loadExample('binary-classifier');
    store().newGraph();
    for (let i = 0; i < 4; i++) store().undo();
    expect(store().getDocument()).toEqual(original);
    for (let i = 0; i < 4; i++) store().redo();
    expect(store().nodes).toEqual([]);
  });

  it('records a whole drag once and does not clear validation while moving', () => {
    store().addNode('input');
    const node = store().nodes[0];
    useGraphStore.setState({ validation });
    const steps = store().past.length;
    store().beginDrag();
    store().moveNode(node.id, { x: 100, y: 100 });
    store().moveNode(node.id, { x: 200, y: 200 });
    store().endDrag();
    expect(store().past).toHaveLength(steps + 1);
    expect(store().validation).toEqual(validation);
    store().undo();
    expect(store().nodes[0].position).toEqual(node.position);
    store().redo();
    expect(store().nodes[0].position).toEqual({ x: 200, y: 200 });
  });

  it('keeps redo for no-ops, selection, invalid edits, and notices', () => {
    store().addNode('input');
    store().addNode('output');
    store().undo();
    const before = store().past.length;
    const node = store().nodes[0];
    store().selectNode(node.id);
    store().addNode('input');
    store().connect(node.id, node.id);
    store().deleteNode('missing');
    store().moveNode(node.id, node.position);
    store().beginDrag();
    store().endDrag();
    store().dismissNotice();
    expect(store().past).toHaveLength(before);
    expect(store().future).toHaveLength(1);
    store().addNode('relu');
    expect(store().future).toHaveLength(0);
  });

  it('bounds history and starts a restored session without undo steps', () => {
    for (let i = 0; i < 120; i++) store().setGraphName(`Network ${i}`);
    expect(store().past).toHaveLength(100);
    store().loadDocument(store().getDocument(), { silent: true });
    expect(store().past).toHaveLength(0);
    expect(store().future).toHaveLength(0);
    store().undo();
    expect(store().graphName).toBe('Network 119');
  });

  it.each(['undo', 'redo'] as const)('ignores an API response arriving after %s', async (action) => {
    let finish!: () => void;
    const gate = new Promise<void>((resolve) => { finish = resolve; });
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      await gate;
      return Response.json(url.endsWith('/api/validate') ? validation : generated);
    }));
    store().loadExample('mlp-classifier');
    store().setGraphName('Renamed');
    if (action === 'redo') store().undo();
    const pending = store().generate();
    store()[action]();
    finish();
    await pending;
    expect(store()).toMatchObject({ validation: null, generatedCode: null, backendStatus: 'idle' });
  });
});

describe('starting a new graph', () => {
  it('clears validation and Python from the previous document', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) =>
      Response.json(url.endsWith('/api/validate') ? validation : generated),
    ));
    const { loadExample, generate, newGraph } = useGraphStore.getState();
    loadExample('mlp-classifier');
    await generate();
    expect(useGraphStore.getState().generatedCode).toBe(generated.code);
    expect(useGraphStore.getState().validation?.shapes).toEqual(validation.shapes);

    newGraph();

    expect(useGraphStore.getState()).toMatchObject({
      nodes: [], edges: [], validation: null, generatedCode: null, backendStatus: 'idle',
    });
  });

  it('ignores validation and Python arriving after the reset', async () => {
    let finish!: () => void;
    const response = new Promise<void>((resolve) => { finish = resolve; });
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      await response;
      return Response.json(url.endsWith('/api/validate') ? validation : generated);
    }));
    const { loadExample, generate, newGraph } = useGraphStore.getState();
    loadExample('mlp-classifier');
    const pending = generate();
    expect(useGraphStore.getState().backendStatus).toBe('generating');

    newGraph();
    const statusAfterReset = useGraphStore.getState().backendStatus;
    finish();
    await pending;

    expect(statusAfterReset).toBe('idle');
    expect(useGraphStore.getState()).toMatchObject({
      nodes: [], validation: null, generatedCode: null,
      notice: { kind: 'info', message: 'Started a new graph.' },
    });
  });
});
