import { NextResponse } from 'next/server';

const fengariUrl = 'https://cdn.jsdelivr.net/npm/fengari-web@0.1.4/dist/fengari-web.js';

export async function GET(): Promise<Response> {
  const response = await fetch(fengariUrl, { next: { revalidate: 31_536_000 } });
  if (!response.ok) return new NextResponse('Lua runtime unavailable', { status: 502 });
  return new NextResponse(await response.arrayBuffer(), {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
  });
}
