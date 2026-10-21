interface TransactionalEmail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

class InvalidEmailRequest extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const MAX_BODY_BYTES = 32768;
const EMAIL_FIELDS = new Set(['to', 'subject', 'text', 'html']);

function parseMessage(value: unknown): TransactionalEmail {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new InvalidEmailRequest('invalid_message');
  }
  const input = value as Record<string, unknown>;
  const { to, subject, text, html } = input;
  if (Object.keys(input).some((key) => !EMAIL_FIELDS.has(key)) ||
      typeof to !== 'string' || to.length > 254 || /[\x00-\x1f\x7f]/.test(to) || !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(to) ||
      typeof subject !== 'string' || !subject.trim() || subject.length > 200 || /[\r\n\x00-\x1f\x7f]/.test(subject) ||
      typeof text !== 'string' || !text.trim() || text.length > 12000 ||
      (html !== undefined && (typeof html !== 'string' || html.length > 16000))) {
    throw new InvalidEmailRequest('invalid_message');
  }
  return { to, subject, text, ...(typeof html === 'string' ? { html } : {}) };
}

async function readMessage(request: Request): Promise<TransactionalEmail> {
  if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json' ||
      request.headers.has('Content-Encoding')) {
    throw new InvalidEmailRequest('unsupported_media_type', 415);
  }
  const reader = request.body?.getReader();
  if (!reader) throw new InvalidEmailRequest('invalid_message');
  const buffer = new Uint8Array(MAX_BODY_BYTES);
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (size + value.byteLength > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new InvalidEmailRequest('message_too_large', 413);
      }
      buffer.set(value, size);
      size += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(buffer.subarray(0, size)));
  } catch {
    throw new InvalidEmailRequest('invalid_json');
  }
  return parseMessage(value);
}

function json(body: object, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export default {
  async fetch(request: Request, env: EmailWorkerEnv): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === '/health' && request.method === 'GET') {
      return json({ service: 'iscn-email', status: 'running' });
    }
    if (path !== '/send') return json({ error: 'not_found' }, 404);
    if (request.method !== 'POST') {
      return new Response(null, { status: 405, headers: { Allow: 'POST', 'Cache-Control': 'no-store' } });
    }
    const requestId = crypto.randomUUID();
    try {
      const message = await readMessage(request);
      const result = await env.EMAIL.send({
        ...message,
        from: { email: env.EMAIL_FROM, name: 'Bioinformat ISCN' },
        replyTo: env.EMAIL_REPLY_TO,
      });
      return json({ request_id: requestId, message_id: result.messageId, status: 'accepted' }, 202);
    } catch (error) {
      if (error instanceof InvalidEmailRequest) {
        return json({ request_id: requestId, error: error.message }, error.status);
      }
      console.error(JSON.stringify({ event: 'email_send_failed', request_id: requestId }));
      return json({ request_id: requestId, error: 'email_send_failed' }, 502);
    }
  },
} satisfies ExportedHandler<EmailWorkerEnv>;
