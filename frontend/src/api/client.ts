import type { GraphDocument } from '../types/graph';

const API_BASE = (
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000'
).replace(/\/$/, '');

export type ValidationIssueDto = {
  code: string;
  message: string;
  nodeId?: string;
  edgeId?: string;
};

export type ValidateResponseDto = {
  valid: boolean;
  errors: ValidationIssueDto[];
  shapes: Record<string, number[]>;
  nodeErrors: Record<string, string>;
};

export type GenerateResponseDto = {
  valid: boolean;
  errors: ValidationIssueDto[];
  code: string | null;
  className: string | null;
};

async function postJson<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new Error(
      `Backend unreachable at ${API_BASE}. Is the FastAPI server running? (${
        error instanceof Error ? error.message : String(error)
      })`,
    );
  }

  if (!response.ok) {
    const detail = await response
      .json()
      .catch(() => null as unknown);
    const message =
      (detail && typeof detail === 'object' && 'detail' in detail
        ? JSON.stringify((detail as { detail: unknown }).detail)
        : null) ?? `${response.status} ${response.statusText}`;
    throw new Error(`Backend rejected the request: ${message}`);
  }

  return (await response.json()) as T;
}

export function validateGraph(
  document: GraphDocument,
): Promise<ValidateResponseDto> {
  return postJson<ValidateResponseDto>('/api/validate', { document });
}

export function generateModel(
  document: GraphDocument,
  className = 'TorchFlowModel',
): Promise<GenerateResponseDto> {
  return postJson<GenerateResponseDto>('/api/generate', { document, className });
}

export async function checkHealth(): Promise<{ status: string; version: string }> {
  const response = await fetch(`${API_BASE}/api/health`);
  if (!response.ok) throw new Error(`Health check failed: ${response.status}`);
  return (await response.json()) as { status: string; version: string };
}
