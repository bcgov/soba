import {
  documentGenerationVersions,
  type DocumentGenerationAdapter,
  type DocumentGenerationVersion,
} from '../../core/integrations/cdogs/documentGenerationAdapter';
import { ValidationError } from '../../core/errors';
import { CdogsClient } from './cdogsClient';

export class CdogsAdapter implements DocumentGenerationAdapter {
  readonly supportedVersions = documentGenerationVersions;

  constructor(private readonly client: CdogsClient) {}

  async uploadTemplate(
    version: DocumentGenerationVersion,
    body: Buffer,
    contentType?: string,
  ): Promise<Response> {
    this.assertSupported(version);
    return this.client.uploadTemplate(version, body, contentType);
  }

  async renderTemplate(version: DocumentGenerationVersion, payload: unknown): Promise<Response> {
    this.assertSupported(version);
    return this.client.renderTemplate(version, payload);
  }

  async renderTemplateByHash(
    version: DocumentGenerationVersion,
    hash: string,
    payload: unknown,
  ): Promise<Response> {
    this.assertSupported(version);
    return this.client.renderTemplateByHash(version, hash, payload);
  }

  async getTemplate(version: DocumentGenerationVersion, hash: string): Promise<Response> {
    this.assertSupported(version);
    return this.client.getTemplate(version, hash);
  }

  async deleteTemplate(version: DocumentGenerationVersion, hash: string): Promise<Response> {
    this.assertSupported(version);
    return this.client.deleteTemplate(version, hash);
  }

  async getFileTypes(version: DocumentGenerationVersion): Promise<Response> {
    this.assertSupported(version);
    return this.client.getFileTypes(version);
  }

  async getHealth(version: DocumentGenerationVersion): Promise<Response> {
    this.assertSupported(version);
    return this.client.getHealth(version);
  }

  private assertSupported(version: string): void {
    if (!this.supportedVersions.includes(version as DocumentGenerationVersion)) {
      throw new ValidationError(`Unsupported document generation version: ${version}`);
    }
  }
}
