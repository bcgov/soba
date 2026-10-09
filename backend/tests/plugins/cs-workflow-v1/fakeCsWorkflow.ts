import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

export type CsWorkflowHandler = (req: IncomingMessage, res: ServerResponse) => void;

export interface RecordedRequest {
  method?: string;
  url?: string;
  authorization?: string;
  body?: unknown;
}

export interface FakeCsWorkflow {
  baseUrl: string;
  requests: RecordedRequest[];
  close: () => Promise<void>;
}

/** Stands in for the Connected Services workflow API under /api/v1 and records each request. */
export async function startCsWorkflow(handler: CsWorkflowHandler): Promise<FakeCsWorkflow> {
  const requests: RecordedRequest[] = [];
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString();
      requests.push({
        method: req.method,
        url: req.url,
        authorization: req.headers.authorization,
        body: raw ? JSON.parse(raw) : undefined,
      });
      handler(req, res);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}/api/v1`,
    requests,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

/** Answers every request with `status` and `body` as JSON. */
export const json =
  (status: number, body: unknown): CsWorkflowHandler =>
  (_req, res) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };
