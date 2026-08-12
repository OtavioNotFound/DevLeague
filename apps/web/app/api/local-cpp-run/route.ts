import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'O executor C++ local não está disponível em produção.' }, { status: 403 });
  }

  const body = await request.json() as { source?: unknown; stdin?: unknown };
  if (typeof body.source !== 'string' || typeof body.stdin !== 'string' || body.source.length > 50_000 || body.stdin.length > 10_000) {
    return NextResponse.json({ error: 'Código ou entrada inválidos.' }, { status: 400 });
  }

  const workspace = await mkdtemp(join(tmpdir(), 'devleague-cpp-'));
  const sourceFile = join(workspace, 'main.cpp');
  const executable = join(workspace, `main-${randomUUID()}.exe`);
  try {
    await writeFile(sourceFile, body.source, 'utf8');
    const compiler = process.env.LOCAL_CPP_COMPILER ?? 'g++';
    const compilation = await run(compiler, ['-std=c++20', '-O2', '-pipe', sourceFile, '-o', executable], workspace, '', 10_000);
    if (compilation.timedOut) return NextResponse.json({ ok: false, error: 'Tempo de compilação excedido.' });
    if (compilation.exitCode !== 0) return NextResponse.json({ ok: false, error: compilation.stderr || compilation.stdout || 'Falha ao compilar.' });

    const execution = await run(executable, [], workspace, body.stdin, 3_000);
    if (execution.timedOut) return NextResponse.json({ ok: false, error: 'Tempo de execução excedido.' });
    if (execution.exitCode !== 0) return NextResponse.json({ ok: false, error: execution.stderr || 'O programa terminou com erro.' });
    return NextResponse.json({ ok: true, stdout: execution.stdout });
  } catch (error: unknown) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Falha ao iniciar o g++ local.' });
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

async function run(command: string, args: readonly string[], cwd: string, stdin: string, timeoutMs: number): Promise<{ exitCode: number | null; stdout: string; stderr: string; timedOut: boolean }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; child.kill(); }, timeoutMs);
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    child.once('error', (error) => { clearTimeout(timeout); reject(error); });
    child.once('close', (exitCode) => { clearTimeout(timeout); resolve({ exitCode, stdout, stderr, timedOut }); });
    child.stdin.end(stdin);
  });
}
