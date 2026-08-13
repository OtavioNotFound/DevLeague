/// <reference lib="webworker" />

import { loadPyodide } from 'pyodide';

type RunRequest = {
  readonly source: string;
  readonly stdin: string;
  readonly indexUrl: string;
};
type RunResult = { readonly ok: true; readonly stdout: string } | { readonly ok: false; readonly error: string };

interface SafePyodide {
  readonly globals: { set(name: string, value: string): void };
  runPythonAsync(source: string): Promise<unknown>;
}

let runtime: Promise<SafePyodide> | undefined;

self.onmessage = async (event: MessageEvent<RunRequest>) => {
  try {
    runtime ??= loadPyodide({ indexURL: event.data.indexUrl }) as unknown as Promise<SafePyodide>;
    const pyodide = await runtime;
    pyodide.globals.set('__devleague_source', event.data.source);
    pyodide.globals.set('__devleague_stdin', event.data.stdin);
    const stdout = await pyodide.runPythonAsync(`
import io
import sys

class _DevLeagueOutput(io.StringIO):
    def write(self, value):
        if self.tell() + len(value.encode("utf-8")) > 65536:
            raise RuntimeError("Saída local excedeu 64 KiB.")
        return super().write(value)

_stdout = _DevLeagueOutput()
_previous_stdin, _previous_stdout = sys.stdin, sys.stdout
try:
    sys.stdin = io.StringIO(__devleague_stdin)
    sys.stdout = _stdout
    exec(compile(__devleague_source, '<devleague>', 'exec'), {})
finally:
    sys.stdin, sys.stdout = _previous_stdin, _previous_stdout
_stdout.getvalue()
    `);
    post({ ok: true, stdout: String(stdout) });
  } catch (error: unknown) {
    post({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
};

function post(result: RunResult): void {
  self.postMessage(result);
}
