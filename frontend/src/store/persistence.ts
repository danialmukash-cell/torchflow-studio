import type { GraphDocument } from '../types/graph';
import { parseDocument, serializeDocument } from '../graph/serialization';

const STORAGE_KEY = 'torchflow-studio.graph.v1';

/** Persists the graph so it is restored on the next page load. */
export function saveToLocalStorage(document: GraphDocument): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, serializeDocument(document));
  } catch {
    // Storage can be unavailable (private mode, quota). Autosave is best-effort.
  }
}

export function loadFromLocalStorage(): GraphDocument | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const result = parseDocument(raw);
    return result.ok ? result.document : null;
  } catch {
    return null;
  }
}

export function clearLocalStorage(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function suggestFilename(graphName: string): string {
  const base =
    graphName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'graph';
  return `${base}.torchflow.json`;
}

export function downloadGraphJson(
  filename: string,
  graph: GraphDocument,
): void {
  const blob = new Blob([serializeDocument(graph)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Could not read the selected file.'));
    reader.readAsText(file);
  });
}
