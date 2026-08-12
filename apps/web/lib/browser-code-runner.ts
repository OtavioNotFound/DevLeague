import type { LanguageKey } from '@devleague/contracts';

export type BrowserExecutionResult =
  | { readonly ok: true; readonly stdout: string }
  | { readonly ok: false; readonly error: string };

let cppWorker: Worker | undefined;
let pythonWorker: Worker | undefined;

const pyodideCdnUrl = 'https://cdn.jsdelivr.net/pyodide/v0.29.2/full/';

export function canRunInBrowser(language: LanguageKey): boolean {
  return language === 'python' || language === 'javascript' || language === 'cpp';
}

export async function runInBrowser(input: {
  readonly language: LanguageKey;
  readonly source: string;
  readonly stdin: string;
}): Promise<BrowserExecutionResult> {
  if (input.language === 'cpp') return runCppInBrowser(input);
  if (input.language === 'python') return runPythonInBrowser(input);

  const worker = new Worker(URL.createObjectURL(new Blob([workerSource(input.language)], {
    type: 'text/javascript'
  })));

  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      worker.terminate();
      resolve({ ok: false, error: 'Tempo excedido na execução local.' });
    }, 3_000);

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
    worker.postMessage(input);
  });
}

async function runPythonInBrowser(input: { readonly source: string; readonly stdin: string }): Promise<BrowserExecutionResult> {
  pythonWorker ??= new Worker(URL.createObjectURL(new Blob([pythonWorkerSource], {
    type: 'text/javascript'
  })));
  const result = await runWorker(
    pythonWorker,
    { ...input, pyodideUrl: `${pyodideCdnUrl}pyodide.js`, pyodideIndexUrl: pyodideCdnUrl },
    90_000,
    'O Python local demorou mais de 90 segundos para iniciar. Verifique sua conexão e tente novamente.',
    'Não foi possível iniciar o Python no navegador.',
    false
  );
  if (!result.ok && (result.error.includes('90 segundos') || result.error.includes('iniciar o Python'))) pythonWorker = undefined;
  return result;
}

async function runCppInBrowser(input: { readonly source: string; readonly stdin: string }): Promise<BrowserExecutionResult> {
  cppWorker ??= new Worker(new URL('../workers/cpp-runner.worker.ts', import.meta.url), { type: 'module' });
  const result = await runWorker(
    cppWorker,
    input,
    180_000,
    'A compilação C++ excedeu o limite local de 3 minutos.',
    'Não foi possível iniciar o compilador C++ no navegador.',
    false
  );
  if (!result.ok && (result.error.includes('3 minutos') || result.error.includes('iniciar o compilador'))) cppWorker = undefined;
  return result;
}

function runWorker(
  worker: Worker,
  input: { readonly source: string; readonly stdin: string; readonly pyodideUrl?: string; readonly pyodideIndexUrl?: string },
  timeoutMs: number,
  timeoutMessage: string,
  startupErrorMessage: string,
  terminateOnFinish = true
): Promise<BrowserExecutionResult> {
  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      worker.terminate();
      resolve({ ok: false, error: timeoutMessage });
    }, timeoutMs);
    worker.onmessage = (event: MessageEvent<BrowserExecutionResult>) => {
      window.clearTimeout(timeout);
      if (terminateOnFinish) worker.terminate();
      resolve(event.data);
    };
    worker.onerror = () => {
      window.clearTimeout(timeout);
      worker.terminate();
      resolve({ ok: false, error: startupErrorMessage });
    };
    worker.postMessage(input);
  });
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
