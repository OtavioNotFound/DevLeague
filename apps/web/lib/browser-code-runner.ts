import type { LanguageKey } from '@devleague/contracts';

export type BrowserExecutionResult =
  | { readonly ok: true; readonly stdout: string }
  | { readonly ok: false; readonly error: string };

export function canRunInBrowser(language: LanguageKey): boolean {
  return language === 'python' || language === 'javascript';
}

export async function runInBrowser(input: {
  readonly language: LanguageKey;
  readonly source: string;
  readonly stdin: string;
}): Promise<BrowserExecutionResult> {
  if (!canRunInBrowser(input.language)) {
    return { ok: false, error: 'C++ é avaliado pelo judge oficial ao submeter.' };
  }

  const worker = new Worker(URL.createObjectURL(new Blob([workerSource(input.language)], {
    type: 'text/javascript'
  })));

  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      worker.terminate();
      resolve({ ok: false, error: 'Tempo excedido na execução local.' });
    }, input.language === 'python' ? 20_000 : 3_000);

    worker.onmessage = (event: MessageEvent<BrowserExecutionResult>) => {
      window.clearTimeout(timeout);
      worker.terminate();
      resolve(event.data);
    };
    worker.onerror = () => {
      window.clearTimeout(timeout);
      worker.terminate();
      resolve({ ok: false, error: 'Não foi possível iniciar a execução local.' });
    };
    worker.postMessage({
      ...input,
      pyodideUrl: new URL('/api/pyodide/pyodide.js', window.location.origin).href,
      pyodideIndexUrl: new URL('/api/pyodide/', window.location.origin).href
    });
  });
}

export async function runCppLocally(input: {
  readonly source: string;
  readonly stdin: string;
}): Promise<BrowserExecutionResult> {
  try {
    const response = await fetch('/api/local-cpp-run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });
    const result = await response.json() as { ok?: boolean; stdout?: string; error?: string };
    return result.ok ? { ok: true, stdout: result.stdout ?? '' } : { ok: false, error: result.error ?? 'Falha ao executar o g++ local.' };
  } catch {
    return { ok: false, error: 'Não foi possível acessar o executor C++ local.' };
  }
}

function workerSource(language: LanguageKey): string {
  return language === 'python' ? pythonWorkerSource : javascriptWorkerSource;
}

const javascriptWorkerSource = `
self.onmessage = ({ data }) => {
  const output = [];
  const write = (value) => output.push(String(value));
  const fs = { readFileSync: () => data.stdin };
  const sandboxConsole = { log: (...values) => write(values.join(' ')) };
  try {
    const run = new Function('require', 'console', 'process', data.source);
    run((name) => {
      if (name === 'fs') return fs;
      throw new Error('Módulo não disponível na execução local: ' + name);
    }, sandboxConsole, { stdout: { write } });
    self.postMessage({ ok: true, stdout: output.join('\\n') + (output.length ? '\\n' : '') });
  } catch (error) {
    self.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
};`;

const pythonWorkerSource = `
let pyodidePromise;

async function getPyodide() {
  if (!pyodidePromise) {
    importScripts(self.__devleaguePyodideUrl);
    pyodidePromise = loadPyodide({ indexURL: self.__devleaguePyodideIndexUrl });
  }
  return pyodidePromise;
}

self.onmessage = async ({ data }) => {
  try {
    self.__devleaguePyodideUrl = data.pyodideUrl;
    self.__devleaguePyodideIndexUrl = data.pyodideIndexUrl;
    const pyodide = await getPyodide();
    pyodide.globals.set('__devleague_source', data.source);
    pyodide.globals.set('__devleague_stdin', data.stdin);
    const stdout = await pyodide.runPythonAsync(\`
import io
import sys

_stdout = io.StringIO()
_previous_stdin, _previous_stdout = sys.stdin, sys.stdout
try:
    sys.stdin = io.StringIO(__devleague_stdin)
    sys.stdout = _stdout
    exec(compile(__devleague_source, '<devleague>', 'exec'), {})
finally:
    sys.stdin, sys.stdout = _previous_stdin, _previous_stdout
_stdout.getvalue()
    \`);
    self.postMessage({ ok: true, stdout: String(stdout) });
  } catch (error) {
    self.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
};`;
