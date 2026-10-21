export class ApiError extends Error {
  status: number;
  code: string;
  headers: Record<string, string>;
  constructor(
    status: number,
    code: string,
    message: string,
    headers: Record<string, string> = {},
  ) { super(message); this.status = status; this.code = code; this.headers = headers; }
}

export function unauthorized(): ApiError {
  return new ApiError(401, 'unauthorized', 'A valid integration API key is required.', {
    'WWW-Authenticate': 'Bearer realm="validation-api"',
  });
}

export function subscriptionRequired(): ApiError {
  return new ApiError(402, 'subscription_required', 'An active paid API subscription is required.');
}
