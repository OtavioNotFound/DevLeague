/// <reference lib="webworker" />

import { Directory, Wasmer, init } from '@wasmer/sdk';

type RunRequest = { readonly source: string; readonly stdin: string };
type RunResult = { readonly ok: true; readonly stdout: string } | { readonly ok: false; readonly error: string };

let initialized: Promise<unknown> | undefined;
let compiler: Awaited<ReturnType<typeof Wasmer.fromRegistry>> | undefined;

self.onmessage = async (event: MessageEvent<RunRequest>) => {
  try {
    initialized ??= init();
    await initialized;
    compiler ??= await Wasmer.fromRegistry('clang/clang');

    const project = new Directory();
    await project.writeFile('main.cpp', event.data.source);
    const command = compiler.entrypoint;
    if (!command) throw new Error('O pacote Clang não expôs um compilador executável.');

    const compilation = await command.run({
      args: ['-x', 'c++', '-std=c++20', '-O1', '/project/main.cpp', '-o', '/project/main.wasm'],
      mount: { '/project': project }
    });
    const compiled = await compilation.wait();
    if (!compiled.ok) {
      post({ ok: false, error: compiled.stderr || compiled.stdout || `Compilação encerrada com código ${compiled.code}.` });
      return;
    }

    const binary = await project.readFile('main.wasm');
    const program = await Wasmer.fromFile(binary);
    const entrypoint = program.entrypoint;
    if (!entrypoint) throw new Error('O programa compilado não possui ponto de entrada.');
    const execution = await entrypoint.run({ stdin: event.data.stdin });
    const output = await execution.wait();
    post(output.ok
      ? { ok: true, stdout: output.stdout }
      : { ok: false, error: output.stderr || `Execução encerrada com código ${output.code}.` });
  } catch (error: unknown) {
    post({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
};

function post(result: RunResult): void {
  self.postMessage(result);
}
