/**
 * Result of a storage engine readiness check; no credentials or sensitive config are exposed.
 */
export interface StorageEngineReadinessResult {
  ok: boolean;
  message?: string;
}

/**
 * A single file's metadata as returned by the storage engine.
 * Implementations may add provider-specific fields in `metadata`.
 */
export type StorageFileMeta = {
  /** Engine-assigned stable reference for the file (opaque). */
  engineFileRef: string;
  /** Original filename as uploaded. */
  filename: string;
  /** MIME content type (when known). */
  contentType?: string;
  /** Size in bytes (when known). */
  size?: number;
  /** Optional publicly addressable URL (if the backend exposes one). */
  publicUrl?: string;
  /** Provider-specific metadata bag (ACLs, etags, custom tags). */
  metadata?: Record<string, unknown>;
  /** ISO timestamp when the object was created in the storage backend. */
  createdAt?: string;
};

/**
 * Input accepted when uploading a file to the storage engine. To support multiple
 * environments (server-side direct upload, presigned-url flows) adapters may accept
 * either raw bytes/streams or a source URL which the adapter will ingest.
 */
export interface UploadFileInput {
  /** SOBA workspace id — used for tenancy and scoping in the storage backend. */
  workspaceId: string;
  /** Optional SOBA submission id or owner id to associate file with. */
  submissionId?: string;
  /** Original filename provided by the client. */
  filename: string;
  /** Content type hint. */
  contentType?: string;
  /** Optional size hint in bytes. */
  size?: number;
  /** The file payload: either a Buffer, a Readable stream, or omitted when using a sourceUrl. */
  buffer?: Buffer;
  stream?: NodeJS.ReadableStream;
  /** Optional source URL the adapter should fetch/ingest (useful for server-side copies). */
  sourceUrl?: string;
  /** Optional metadata to attach to the stored object. */
  metadata?: Record<string, unknown>;
}

export interface UploadFileResult {
  /** Stable engine reference for the newly stored file. */
  engineFileRef: string;
  /** Optional public URL (if the backend exposes or generates one). */
  publicUrl?: string;
  /** Returned/normalized metadata. */
  metadata?: Record<string, unknown>;
}

export interface GetFileResult extends StorageFileMeta {
  /** When available, a stream to read the file contents server-side (may be omitted). */
  downloadStream?: NodeJS.ReadableStream;
}

export interface ListFilesResult {
  items: StorageFileMeta[];
  nextPageToken?: string;
}

export interface GeneratePresignedUrlInput {
  /** The intended operation: 'get' for download, 'put' for upload. */
  operation: 'get' | 'put';
  /** Optional target engineFileRef (for downloads) or filename (for uploads). */
  engineFileRef?: string;
  filename?: string;
  /** Expiration in seconds. */
  expiresIn?: number;
  /** Optional content type constraint for uploads. */
  contentType?: string;
}

export interface GeneratePresignedUrlResult {
  url: string;
  method: 'GET' | 'PUT' | 'POST';
  expiresIn: number;
  /** Any required headers the client must set when using the URL. */
  headers?: Record<string, string>;
}

/**
 * Storage engine adapter contract. Implementations (local, minio, s3, etc.) should
 * implement this interface to plug into SOBA's storage abstraction.
 */
export interface StorageEngineAdapter {
  /** Optional: report whether the storage backend is reachable. */
  readinessCheck?(): Promise<StorageEngineReadinessResult>;

  /**
   * Upload a file into the storage backend. Implementations should be idempotent where
   * possible (for example by deduplication using a content hash) but callers should not
   * rely on dedupe unless documented by the adapter.
   */
  uploadFile(input: UploadFileInput): Promise<UploadFileResult>;

  /** Read file metadata and optionally a download stream. Returns null if not found. */
  getFile(engineFileRef: string): Promise<GetFileResult | null>;

  /** Delete a stored file by engine reference. */
  deleteFile(engineFileRef: string): Promise<void>;

  /**
   * List files for a workspace, with an optional prefix or pagination token.
   * Implementations may provide provider-specific filters via metadata.
   */
  listFiles?(workspaceId: string, prefix?: string, pageToken?: string): Promise<ListFilesResult>;

  /**
   * Generate a presigned (time-limited) URL that a client can use to upload or download
   * directly from the storage backend. Optional — not all adapters need to support it.
   */
  generatePresignedUrl?(input: GeneratePresignedUrlInput): Promise<GeneratePresignedUrlResult>;

  /**
   * Optional transform hook to normalize provider-specific metadata into a portable shape.
   */
  normalizeMetadata?(
    metadata: Record<string, unknown> | undefined,
  ): Record<string, unknown> | undefined;
}
