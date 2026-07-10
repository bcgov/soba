export const documentGenerationVersions = ['v2', 'v3'] as const;

export type DocumentGenerationVersion = (typeof documentGenerationVersions)[number];

export interface DocumentGenerationAdapter {
  readonly supportedVersions: readonly DocumentGenerationVersion[];

  uploadTemplate(
    version: DocumentGenerationVersion,
    body: Buffer,
    contentType?: string,
  ): Promise<Response>;

  renderTemplate(version: DocumentGenerationVersion, payload: unknown): Promise<Response>;

  renderTemplateByHash(
    version: DocumentGenerationVersion,
    hash: string,
    payload: unknown,
  ): Promise<Response>;

  getTemplate(version: DocumentGenerationVersion, hash: string): Promise<Response>;

  deleteTemplate(version: DocumentGenerationVersion, hash: string): Promise<Response>;

  getFileTypes(version: DocumentGenerationVersion): Promise<Response>;

  getHealth(version: DocumentGenerationVersion): Promise<Response>;
}
