import type { PrintStatusCode } from '@soba/lib';
import type { TemplateFileType } from './templateFileType';

/** Result of a document-generation readiness check; exposes no config or credentials. */
export interface DocumentGenerationReadinessResult {
  ok: boolean;
  message?: string;
}

/** A rendered document returned by the generation backend. */
export interface DocumentRenderResult {
  data: Buffer;
  contentType?: string;
}

/** Facts about the print that a template can show next to the answers. */
export interface PrintContext {
  status: PrintStatusCode;
  /** ISO 8601. */
  printedAt: string;
  /** Null until the submission is confirmed, and for unsaved answers. */
  confirmationCode: string | null;
  /** The saved revision printed; null for unsaved answers. */
  revisionNo: number | null;
}

/** A document to render: the template file, the answer data it renders, and backend options. */
export interface DocumentRenderRequest {
  template: { content: Buffer; fileType: TemplateFileType };
  data: Record<string, unknown>;
  context: PrintContext;
  /** Backend-specific render options, passed through unchanged. */
  options: Record<string, unknown>;
}

export interface DocumentGenerationAdapter {
  /** Render a document and return the raw bytes. The backend shapes the request for its API. */
  render(request: DocumentRenderRequest): Promise<DocumentRenderResult>;
  /** Optional: report whether the backend is reachable (readiness). No config in the result. */
  readinessCheck?(): Promise<DocumentGenerationReadinessResult>;
}
