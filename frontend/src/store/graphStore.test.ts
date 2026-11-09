import { afterEach, describe, expect, it, vi } from 'vitest';
import { useGraphStore } from './graphStore';

const validation = { valid: true, errors: [], shapes: { 'mlp-output': [10] }, nodeErrors: {} };
const generated = { valid: true, errors: [], code: 'class TorchFlowModel: ...', className: 'TorchFlowModel' };

afterEach(() => {
  vi.unstubAllGlobals();
  useGraphStore.getState().newGraph();
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
