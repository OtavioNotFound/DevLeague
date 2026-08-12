import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { NextResponse } from 'next/server';

const assets = new Map([
  ['pyodide.js', 'application/javascript; charset=utf-8'],
  ['pyodide.asm.js', 'application/javascript; charset=utf-8'],
  ['pyodide.asm.wasm', 'application/wasm'],
  ['python_stdlib.zip', 'application/zip'],
  ['pyodide-lock.json', 'application/json; charset=utf-8']
]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ asset: string }> }
): Promise<Response> {
  const asset = (await params).asset;
  const contentType = assets.get(asset);
  if (!contentType) return new NextResponse('Not found', { status: 404 });

  const file = await readFile(join(process.cwd(), 'node_modules', 'pyodide', asset));
  return new NextResponse(file, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
  });
}
