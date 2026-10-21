import { ApiError } from './errors.ts';

export const MAX_BODY_BYTES = 16_384;
export const MAX_KARYOTYPE_LENGTH = 4096;

export async function readKaryotype(request: Request): Promise<string> {
  if (new URL(request.url).search) throw new ApiError(400, 'invalid_request', 'Send notation only in the JSON request body.');
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new ApiError(415, 'unsupported_media_type', 'Use Content-Type: application/json.');
  }
  if (request.headers.has('content-encoding') && request.headers.get('content-encoding') !== 'identity') {
    throw new ApiError(415, 'unsupported_encoding', 'Compressed request bodies are not supported.');
  }
  const declaredSize = request.headers.get('content-length');
  if (declaredSize && Number(declaredSize) > MAX_BODY_BYTES) throw bodyTooLarge();
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'invalid_request', 'A JSON body with one karyotype string is required.');
  let size = 0;
  let text = '';
  const decoder = new TextDecoder('utf-8', { fatal: true });
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_BODY_BYTES) { await reader.cancel(); throw bodyTooLarge(); }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, 'invalid_request', 'The request body must be valid UTF-8 JSON.');
  } finally { reader.releaseLock(); }
  let value: unknown;
  try { value = JSON.parse(text); }
  catch { throw new ApiError(400, 'invalid_request', 'The request body must be valid JSON.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).length !== 1 || !('karyotype' in value) || typeof value.karyotype !== 'string' ||
      !value.karyotype.trim() || value.karyotype.length > MAX_KARYOTYPE_LENGTH) {
    throw new ApiError(400, 'invalid_request', `Send exactly one nonempty karyotype string, up to ${MAX_KARYOTYPE_LENGTH} characters.`);
  }
  return value.karyotype.trim();
}

function bodyTooLarge(): ApiError {
  return new ApiError(413, 'body_too_large', `The request body must not exceed ${MAX_BODY_BYTES} bytes.`);
}
