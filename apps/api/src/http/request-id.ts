import { randomUUID } from 'node:crypto';

interface RequestLike {
  readonly headers: Record<string, string | string[] | undefined>;
  requestId?: string;
}

interface ResponseLike {
  setHeader(name: string, value: string): void;
}

export function requestIdMiddleware(
  request: RequestLike,
  response: ResponseLike,
  next: () => void
): void {
  const supplied = request.headers['x-request-id'];
  const requestId = typeof supplied === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(supplied)
    ? supplied
    : randomUUID();
  request.requestId = requestId;
  response.setHeader('X-Request-Id', requestId);
  next();
}
