import { NextResponse } from 'next/server';

const assets = new Map([
  ['pyodide.js', 'application/javascript; charset=utf-8'],
  ['pyodide.asm.js', 'application/javascript; charset=utf-8'],
  ['pyodide.asm.wasm', 'application/wasm'],
  ['python_stdlib.zip', 'application/zip'],
  ['pyodide-lock.json', 'application/json; charset=utf-8']
]);
const pyodideCdnUrl = 'https://cdn.jsdelivr.net/pyodide/v0.29.2/full/';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ asset: string }> }
): Promise<Response> {
  const asset = (await params).asset;
  const contentType = assets.get(asset);
  if (!contentType) return new NextResponse('Not found', { status: 404 });

  return NextResponse.redirect(new URL(asset, pyodideCdnUrl), 307);
}
