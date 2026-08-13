import type { LanguageKey } from '@devleague/contracts';

export type BrowserExecutionResult =
  | { readonly ok: true; readonly stdout: string }
  | { readonly ok: false; readonly error: string };

let cppWorker: Worker | undefined;
let pythonWorker: Worker | undefined;
let luaWorker: Worker | undefined;

const pyodideCdnUrl = 'https://cdn.jsdelivr.net/pyodide/v0.29.2/full/';

export function canRunInBrowser(language: LanguageKey): boolean {
  return language === 'python' || language === 'javascript' || language === 'typescript' || language === 'lua' || language === 'cpp';
}

export async function runInBrowser(input: {
  readonly language: LanguageKey;
  readonly source: string;
  readonly stdin: string;
}): Promise<BrowserExecutionResult> {
  if (input.language === 'cpp') return runCppInBrowser(input);
  if (input.language === 'python') return runPythonInBrowser(input);
  if (input.language === 'lua') return runLuaInBrowser(input);

  const executableInput = input.language === 'typescript'
    ? await transpileTypeScript(input)
    : input;
  if ('error' in executableInput) return executableInput;

  const worker = new Worker(URL.createObjectURL(new Blob([javascriptWorkerSource], {
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
    worker.postMessage(executableInput);
  });
}

async function transpileTypeScript(input: { readonly source: string; readonly stdin: string }): Promise<{ readonly source: string; readonly stdin: string } | BrowserExecutionResult> {
  const ts = await import('typescript');
  const result = ts.transpileModule(input.source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
    reportDiagnostics: true
  });
  const errors = result.diagnostics?.filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error) ?? [];
  if (errors.length > 0) {
    return { ok: false, error: errors.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')).join('\n') };
  }
  return { source: result.outputText, stdin: input.stdin };
}

async function runLuaInBrowser(input: { readonly source: string; readonly stdin: string }): Promise<BrowserExecutionResult> {
  luaWorker ??= new Worker(URL.createObjectURL(new Blob([
    luaWorkerSource.replace('__DEVLEAGUE_FENGARI_URL__', new URL('/api/lua/fengari-web.js', window.location.origin).href)
  ], { type: 'text/javascript' })));
  const result = await runWorker(
    luaWorker,
    input,
    5_000,
    'A execução Lua excedeu o limite local de 5 segundos.',
    'Não foi possível iniciar Lua no navegador.',
    false
  );
  if (!result.ok && (result.error.includes('5 segundos') || result.error.includes('iniciar Lua'))) luaWorker = undefined;
  return result;
}

async function runPythonInBrowser(input: { readonly source: string; readonly stdin: string }): Promise<BrowserExecutionResult> {
  pythonWorker ??= new Worker(new URL('../workers/python-runner.worker.ts', import.meta.url), { type: 'module' });
  const result = await runWorker(
    pythonWorker,
    { ...input, indexUrl: pyodideCdnUrl },
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
  input: { readonly source: string; readonly stdin: string; readonly indexUrl?: string },
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
    worker.onerror = (event) => {
      window.clearTimeout(timeout);
      worker.terminate();
      resolve({ ok: false, error: event.message ? `${startupErrorMessage} ${event.message}` : startupErrorMessage });
    };
    worker.postMessage(input);
  });
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

const luaWorkerSource = `
self.window = self;
importScripts('__DEVLEAGUE_FENGARI_URL__');

self.onmessage = ({ data }) => {
  try {
    const luaString = (value) => '[==[' + String(value).replaceAll(']==]', ']=] .. "]==]" .. [==[') + ']==]';
    const wrapped = \`
local __input = \${luaString(data.stdin)}
local __position = 1
local __output = {}
io = io or {}
io.read = function(...)
  local formats = {...}
  if #formats == 0 then formats = {"*l"} end
  local values = {}
  for _, format in ipairs(formats) do
    if format == "*n" then
      local start_at, end_at, token = string.find(__input, "([%+%-]?[%d%.]+)", __position)
      if token then __position = end_at + 1; values[#values + 1] = tonumber(token) end
    elseif format == "*a" then
      values[#values + 1] = string.sub(__input, __position); __position = #__input + 1
    else
      local end_at = string.find(__input, "\\\\n", __position, true)
      values[#values + 1] = string.sub(__input, __position, end_at and end_at - 1 or #__input)
      __position = end_at and end_at + 1 or #__input + 1
    end
  end
  return table.unpack(values)
end
print = function(...)
  local values = {...}
  for index = 1, #values do values[index] = tostring(values[index]) end
  __output[#__output + 1] = table.concat(values, "\\\\t")
end
\${data.source}
return table.concat(__output, "\\\\n") .. (#__output > 0 and "\\\\n" or "")
\`;
    const execute = fengari.load(wrapped);
    self.postMessage({ ok: true, stdout: String(execute()) });
  } catch (error) {
    self.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
};`;
