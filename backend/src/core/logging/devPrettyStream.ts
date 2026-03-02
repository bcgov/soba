/**
 * Dev-only pretty stream: morgan-style HTTP lines + requestId (correlation id)
 * on every line. Uses pino-pretty-express-style formatting for HTTP and
 * a simple level/msg format for other logs, always including requestId when present.
 */
import split from 'split2';

const LEVEL_NAMES: Record<number, string> = {
  60: 'FATAL',
  50: 'ERROR',
  40: 'WARN',
  30: 'INFO',
  20: 'DEBUG',
  10: 'TRACE',
};

function formatHttpLine(obj: Record<string, unknown>): string {
  const req = obj.req as Record<string, unknown> | undefined;
  const res = obj.res as Record<string, unknown> | undefined;
  const responseTime = (obj.responseTime as number) ?? (res?.responseTime as number);
  const method = req?.method ?? '?';
  const url = (req?.url as string) ?? (req?.originalUrl as string) ?? '?';
  const status = res?.statusCode ?? '?';
  const requestId = obj.requestId as string | undefined;
  const time = obj.time ? new Date(obj.time as number).toISOString() : new Date().toISOString();
  const reqIdPart = requestId != null ? ` [requestId:${requestId}]` : '';
  return `[${time}] ${method} ${url} ${status} ${responseTime ?? '-'} ms${reqIdPart}`;
}

function formatOtherLine(obj: Record<string, unknown>): string {
  const time = obj.time ? new Date(obj.time as number).toISOString() : new Date().toISOString();
  const level = LEVEL_NAMES[obj.level as number] ?? 'USER';
  const msg = (obj.msg as string) ?? '';
  const requestId = obj.requestId as string | undefined;
  const reqIdPart = requestId != null ? ` [requestId:${requestId}]` : '';
  return `[${time}] ${level}: ${msg}${reqIdPart}`;
}

function isPinoLine(obj: unknown): obj is Record<string, unknown> {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'level' in obj &&
    'time' in obj &&
    'v' in (obj as Record<string, unknown>)
  );
}

/**
 * Format a single pino JSON line. HTTP logs get morgan-style with requestId;
 * other logs get level + msg + requestId.
 */
function formatLine(line: string): string {
  try {
    const obj = JSON.parse(line) as Record<string, unknown>;
    if (!isPinoLine(obj)) return line;
    if (obj.req && obj.res) return formatHttpLine(obj);
    return formatOtherLine(obj);
  } catch {
    return line;
  }
}

/**
 * Returns a stream that parses pino JSON lines and outputs pretty-printed
 * lines with correlation id (requestId) on every line. Pipe pino into this
 * and pipe this to process.stdout.
 */
export function createDevPrettyStream(): NodeJS.ReadWriteStream {
  return split((line: string) => formatLine(line) + '\n');
}

/**
 * Same formatting as pino-pretty-express.pretty() but we add requestId to HTTP lines.
 * Use this as the split2 mapper when you want morgan-style + requestId.
 * For a drop-in stream that also does non-HTTP like pino-pretty-express, use createDevPrettyStream.
 */
export { formatLine };
