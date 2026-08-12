import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, DevLeagueApi } from './api';

type RawRequest = <T>(path: string, options?: {
  method?: string;
  allowEmpty?: boolean;
}) => Promise<T>;

function rawRequest(api: DevLeagueApi): RawRequest {
  return (api as unknown as { request: RawRequest }).request.bind(api);
}

describe('DevLeagueApi response parsing', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('treats an empty heartbeat response as no active queue entry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
    const api = new DevLeagueApi(() => Promise.resolve(null));

    await expect(rawRequest(api)<undefined>('/matchmaking/heartbeat', {
      method: 'POST',
      allowEmpty: true
    })).resolves.toBeUndefined();
  });

  it('reports an invalid successful response without leaking a SyntaxError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() =>
      Promise.resolve(new Response('not-json', { status: 200 }))
    ));
    const api = new DevLeagueApi(() => Promise.resolve(null));

    await expect(rawRequest(api)('/me')).rejects.toBeInstanceOf(ApiError);
    await expect(rawRequest(api)('/me')).rejects.toMatchObject({
      name: 'ApiError',
      code: 'INVALID_API_RESPONSE'
    });
  });
});
