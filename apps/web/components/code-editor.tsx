'use client';

import type { LanguageKey, PracticeSubmission, ProblemDetail, SubmissionVerdict } from '@devleague/contracts';
import Editor from '@monaco-editor/react';
import type * as MonacoApi from 'monaco-editor';
import { CheckCircle2, ChevronDown, LoaderCircle, Play, Send, TerminalSquare } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createApi } from '../lib/auth';
import { canRunInBrowser, runInBrowser } from '../lib/browser-code-runner';
import { publicConfig } from '../lib/config';

const languages: readonly { key: LanguageKey; label: string; runtime: string }[] = [
  { key: 'python', label: 'Python', runtime: 'Pyodide · Wasm local' },
  { key: 'javascript', label: 'JavaScript', runtime: 'Web Worker local' },
  { key: 'typescript', label: 'TypeScript', runtime: 'TypeScript · local' },
  { key: 'lua', label: 'Lua', runtime: 'Fengari · local' },
  { key: 'cpp', label: 'C++', runtime: 'Clang · Wasm experimental' }
];

const storagePrefix = 'devleague:editor:';
let monacoConfigured = false;

export function CodeEditor({ problem, mode = 'practice', matchId, onMatchSubmitted, onLocalValidation, localCompetition = false, disabled = false }: {
  problem: ProblemDetail;
  mode?: 'practice' | 'match';
  matchId?: string;
  onMatchSubmitted?: () => Promise<void> | void;
  onLocalValidation?: (accepted: boolean) => Promise<void> | void;
  localCompetition?: boolean;
  disabled?: boolean;
}) {
  const [language, setLanguage] = useState<LanguageKey>(() =>
    problem.languages.includes('python') ? 'python' : problem.languages[0] ?? 'python'
  );
  const [sources, setSources] = useState<Partial<Record<LanguageKey, string>>>(() => ({ ...problem.starterCode }));
  const [state, setState] = useState<'idle' | 'running' | 'accepted' | 'rejected' | 'error'>('idle');
  const [consoleText, setConsoleText] = useState('Execute o código para validar o primeiro exemplo.');
  const api = useMemo(() => createApi(), []);
  const executeRef = useRef<((kind: 'runs' | 'submissions') => Promise<void>) | undefined>(undefined);
  const source = sources[language] ?? '';
  const visibleLanguages = languages.filter((item) => problem.languages.includes(item.key));
  const runtimeAvailable = language !== 'cpp' || publicConfig.experimentalCpp;

  useEffect(() => {
    const restored: Partial<Record<LanguageKey, string>> = {};
    for (const item of visibleLanguages) {
      const value = window.localStorage.getItem(`${storagePrefix}${problem.versionId}:${item.key}`);
      if (value !== null) restored[item.key] = value;
    }
    if (Object.keys(restored).length > 0) setSources((current) => ({ ...current, ...restored }));
  }, [problem.versionId]);

  async function execute(kind: 'runs' | 'submissions') {
    if (disabled || state === 'running' || !runtimeAvailable) return;
    setState('running');
    setConsoleText(mode === 'practice' && language === 'cpp'
      ? 'Baixando o Clang/Wasm e compilando no navegador… O primeiro uso pode levar até 3 minutos; os próximos serão mais rápidos.'
      : mode === 'practice' && language === 'python'
        ? 'Carregando o Python/Wasm no navegador… O primeiro uso pode levar alguns segundos.'
        : kind === 'runs' ? 'Executando casos de exemplo…' : 'Enviando para avaliação…');
    try {
      if (canRunInBrowser(language) && (kind === 'runs' || mode === 'practice' || localCompetition)) {
        const examples = kind === 'runs' ? problem.examples.slice(0, 1) : problem.examples;
        if (examples.length === 0) throw new Error('este problema ainda não possui caso de exemplo');
        const results: string[] = [];
        let passed = 0;
        for (const [index, example] of examples.entries()) {
          const local = await runInBrowser({ language, source, stdin: example.stdin });
          if (!local.ok) {
            setState('rejected');
            setConsoleText(`EXECUÇÃO LOCAL · EXEMPLO ${index + 1}\n${local.error}`);
            return;
          }
          const matches = normalizeOutput(local.stdout) === normalizeOutput(example.expectedOutput);
          if (matches) passed += 1;
          results.push(`Exemplo ${index + 1}: ${matches ? 'passou' : 'falhou'}\nSaída: ${local.stdout || '(vazia)'}`);
        }
        const allPassed = passed === examples.length;
        setState(allPassed ? 'accepted' : 'rejected');
        const localNotice = kind === 'submissions'
          ? localCompetition
            ? '\n\nX1 demonstrativo: resultado calculado localmente com os exemplos públicos e sem alteração de rating.'
            : '\n\nValidação local: testa somente exemplos públicos, não é veredito do judge e não altera rating.'
          : '';
        setConsoleText(`${allPassed ? 'EXEMPLOS PASSARAM' : 'EXEMPLOS NÃO PASSARAM'} · ${passed}/${examples.length}\n\n${results.join('\n\n')}${localNotice}`);
        if (kind === 'submissions' && localCompetition) await onLocalValidation?.(allPassed);
        return;
      }
      if (mode === 'match' && kind === 'submissions' && matchId) {
        await api.submitMatch({ matchId, language, source });
        setConsoleText('Envio admitido pelo servidor. Aguardando o judge…');
        await onMatchSubmitted?.();
        if (publicConfig.demoMode) {
          await delay(650);
          setState('accepted');
          setConsoleText('ACEITO · sua solução encerrou a partida');
        }
        return;
      }
      const accepted = await api.submitPractice({ problemVersionId: problem.versionId, language, source, kind });
      const result = await pollPracticeSubmission(api, accepted.submissionId, accepted.pollAfterMs);
      setState(result.verdict === 'ACCEPTED' ? 'accepted' : 'rejected');
      setConsoleText(formatPracticeResult(result));
    } catch (error: unknown) {
      setState('error');
      setConsoleText(error instanceof Error ? `Não foi possível avaliar agora: ${error.message}` : 'Não foi possível avaliar agora. Seu código continua salvo nesta tela.');
    }
  }

  executeRef.current = execute;

  const beforeMount = (monaco: typeof MonacoApi) => {
    if (monacoConfigured) return;
    monacoConfigured = true;
    monaco.editor.defineTheme('devleague-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [{ token: 'comment', foreground: '718096' }],
      colors: { 'editor.background': '#090c10', 'editor.lineHighlightBackground': '#10161f', 'editorCursor.foreground': '#7b92ff' }
    });
    for (const languageId of ['python', 'javascript', 'typescript', 'lua', 'cpp']) {
      monaco.languages.registerCompletionItemProvider(languageId, {
        provideCompletionItems: (model: MonacoApi.editor.ITextModel, position: MonacoApi.IPosition) => ({
          suggestions: completionSuggestions(monaco, languageId, model.getWordUntilPosition(position), position)
        })
      });
    }
  };

  const onMount = (editor: MonacoApi.editor.IStandaloneCodeEditor, monaco: typeof MonacoApi) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => { void executeRef.current?.('runs'); });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      window.localStorage.setItem(`${storagePrefix}${problem.versionId}:${language}`, editor.getValue());
      setConsoleText('Código salvo localmente.');
    });
  };

  return (
    <section className={`editor-panel ${mode === 'match' ? 'match-editor' : ''}`} aria-busy={state === 'running'}>
      <header className="editor-toolbar">
        <div className="language-picker">
          <select aria-label="Linguagem" value={language} onChange={(event) => {
            setLanguage(event.target.value as LanguageKey);
            setState('idle');
            setConsoleText('Execute o código para validar o primeiro exemplo.');
          }}>
            {visibleLanguages.map((item) => <option value={item.key} key={item.key} disabled={item.key === 'cpp' && !publicConfig.experimentalCpp}>{item.label} · {item.key === 'cpp' && !publicConfig.experimentalCpp ? 'temporariamente indisponível' : item.runtime}</option>)}
          </select>
          <ChevronDown size={15} aria-hidden="true" />
        </div>
        <span className="autosave-state">Salvo localmente</span>
      </header>
      <div className="editor-surface monaco-editor-shell">
        <Editor
          height="100%"
          language={language === 'cpp' ? 'cpp' : language}
          value={source}
          theme="devleague-dark"
          beforeMount={beforeMount}
          onMount={onMount}
          onChange={(value) => {
            const next = value ?? '';
            setSources((current) => ({ ...current, [language]: next }));
            window.localStorage.setItem(`${storagePrefix}${problem.versionId}:${language}`, next);
          }}
          options={{
            automaticLayout: true,
            fontSize: 14,
            fontFamily: '"Cascadia Code", "JetBrains Mono", Consolas, "Courier New", monospace',
            fontLigatures: false,
            lineHeight: 22,
            cursorStyle: 'line',
            cursorWidth: 2,
            minimap: { enabled: false }, scrollBeyondLastLine: false, padding: { top: 16, bottom: 16 },
            quickSuggestions: { other: 'on', comments: 'off', strings: 'off' },
            quickSuggestionsDelay: 75,
            suggestOnTriggerCharacters: true,
            wordBasedSuggestions: 'currentDocument',
            suggest: { showKeywords: true, showSnippets: true },
            tabSize: 2, insertSpaces: true, wordWrap: 'on', bracketPairColorization: { enabled: true },
            guides: { indentation: true }, fixedOverflowWidgets: true
          }}
        />
      </div>
      <div className="console-panel">
        <div className="console-title"><TerminalSquare size={15} /> SAÍDA {state === 'accepted' && <span><CheckCircle2 size={14} /> concluído</span>}</div>
        <pre className={state === 'error' || state === 'rejected' ? 'console-error' : state === 'accepted' ? 'console-success' : ''}>{consoleText}</pre>
      </div>
      <footer className="editor-actions">
        <span>Ctrl + Enter executar · Ctrl + S salvar · Ctrl + F buscar</span>
        <div>
          <button className="button secondary" type="button" disabled={disabled || state === 'running' || !runtimeAvailable} onClick={() => void execute('runs')}><Play size={16} /> {canRunInBrowser(language) ? 'Executar no navegador' : 'Executar'}</button>
          <button className="button primary" type="button" disabled={disabled || state === 'running' || !runtimeAvailable} onClick={() => void execute('submissions')}>{state === 'running' ? <LoaderCircle className="spin" size={17} /> : <Send size={16} />} {mode === 'match' ? 'Enviar solução' : 'Validar exemplos'}</button>
        </div>
      </footer>
    </section>
  );
}

function normalizeOutput(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/\n+$/, '');
}

function completionSuggestions(
  monaco: typeof MonacoApi,
  language: string,
  word: { readonly word: string; readonly startColumn: number; readonly endColumn: number },
  position: { readonly lineNumber: number; readonly column: number }
) {
  const snippets: Record<string, readonly { label: string; detail: string; insertText: string }[]> = {
    python: [
      { label: 'ler inteiros', detail: 'Lê uma linha de inteiros', insertText: 'nums = list(map(int, input().split()))' },
      { label: 'ler inteiro', detail: 'Lê um número inteiro', insertText: '${1:n} = int(input())' },
      { label: 'ler texto', detail: 'Lê uma linha de texto', insertText: '${1:texto} = input().strip()' },
      { label: 'for', detail: 'Laço for', insertText: 'for ${1:item} in ${2:items}:\n\t${0:pass}' },
      { label: 'for range', detail: 'Laço usando range', insertText: 'for ${1:i} in range(${2:n}):\n\t${0:pass}' },
      { label: 'while', detail: 'Laço while', insertText: 'while ${1:condicao}:\n\t${0:pass}' },
      { label: 'if', detail: 'Condição if', insertText: 'if ${1:condicao}:\n\t${0:pass}' },
      { label: 'if else', detail: 'Condição completa', insertText: 'if ${1:condicao}:\n\t${2:pass}\nelse:\n\t${0:pass}' },
      { label: 'função', detail: 'Define função', insertText: 'def ${1:nome}(${2:parametro}):\n\t${0:pass}' },
      { label: 'lista', detail: 'Cria uma lista por compreensão', insertText: '${1:resultado} = [${2:item} for ${2:item} in ${3:items}]' },
      { label: 'enumerate', detail: 'Percorre índice e valor', insertText: 'for ${1:i}, ${2:valor} in enumerate(${3:items}):\n\t${0:pass}' },
      { label: 'main', detail: 'Ponto de entrada Python', insertText: 'def main():\n\t${0:pass}\n\nif __name__ == "__main__":\n\tmain()' }
    ],
    javascript: [
      { label: 'ler entrada', detail: 'Lê stdin no formato Node', insertText: 'const input = require("fs").readFileSync(0, "utf8").trim();' },
      { label: 'ler inteiros', detail: 'Lê todos os inteiros da entrada', insertText: 'const nums = require("fs").readFileSync(0, "utf8").trim().split(/\\s+/).map(Number);' },
      { label: 'desestruturar entrada', detail: 'Lê inteiros em variáveis', insertText: 'const [${1:a}, ${2:b}] = require("fs").readFileSync(0, "utf8").trim().split(/\\s+/).map(Number);' },
      { label: 'for', detail: 'Laço for', insertText: 'for (let ${1:i} = 0; ${1:i} < ${2:n}; ${1:i} += 1) {\n\t${0}\n}' },
      { label: 'for of', detail: 'Percorre os valores de uma coleção', insertText: 'for (const ${1:item} of ${2:items}) {\n\t${0}\n}' },
      { label: 'while', detail: 'Laço while', insertText: 'while (${1:condicao}) {\n\t${0}\n}' },
      { label: 'if', detail: 'Condição if', insertText: 'if (${1:condicao}) {\n\t${0}\n}' },
      { label: 'if else', detail: 'Condição completa', insertText: 'if (${1:condicao}) {\n\t${2}\n} else {\n\t${0}\n}' },
      { label: 'função', detail: 'Arrow function', insertText: 'const ${1:nome} = (${2:parametro}) => {\n\t${0}\n};' },
      { label: 'map', detail: 'Transforma os itens de um array', insertText: '${1:items}.map((${2:item}) => ${0:item})' },
      { label: 'reduce', detail: 'Reduz um array a um valor', insertText: '${1:items}.reduce((${2:acc}, ${3:item}) => ${0:acc + item}, ${4:0})' },
      { label: 'ordenar números', detail: 'Ordena um array numericamente', insertText: '${1:nums}.sort((a, b) => a - b);' }
    ],
    typescript: [
      { label: 'ler entrada', detail: 'Lê stdin como texto', insertText: 'const input: string = require("fs").readFileSync(0, "utf8").trim();' },
      { label: 'ler inteiros', detail: 'Lê todos os inteiros', insertText: 'const nums: number[] = require("fs").readFileSync(0, "utf8").trim().split(/\\s+/).map(Number);' },
      { label: 'for', detail: 'Laço for tipado', insertText: 'for (let ${1:i}: number = 0; ${1:i} < ${2:n}; ${1:i} += 1) {\n\t${0}\n}' },
      { label: 'função', detail: 'Define uma função tipada', insertText: 'function ${1:nome}(${2:valor}: ${3:number}): ${4:number} {\n\t${0:return valor;}\n}' }
    ],
    lua: [
      { label: 'ler números', detail: 'Lê dois números da entrada', insertText: 'local ${1:a}, ${2:b} = io.read("*n", "*n")' },
      { label: 'for', detail: 'Laço numérico', insertText: 'for ${1:i} = 1, ${2:n} do\n\t${0}\nend' },
      { label: 'while', detail: 'Laço while', insertText: 'while ${1:condicao} do\n\t${0}\nend' },
      { label: 'if', detail: 'Condição', insertText: 'if ${1:condicao} then\n\t${0}\nend' },
      { label: 'função', detail: 'Define uma função', insertText: 'local function ${1:nome}(${2:parametro})\n\t${0}\nend' }
    ],
    cpp: [
      { label: 'iostream', detail: 'Base C++ para entrada e saída', insertText: '#include <iostream>\nusing namespace std;\n\nint main() {\n\t${0}\n\treturn 0;\n}' },
      { label: 'bits', detail: 'Base competitiva com biblioteca padrão', insertText: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n\tios::sync_with_stdio(false);\n\tcin.tie(nullptr);\n\n\t${0}\n\treturn 0;\n}' },
      { label: 'for', detail: 'Laço for', insertText: 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ++${1:i}) {\n\t${0}\n}' },
      { label: 'for range', detail: 'Percorre os valores de um container', insertText: 'for (const auto& ${1:item} : ${2:items}) {\n\t${0}\n}' },
      { label: 'while', detail: 'Laço while', insertText: 'while (${1:condicao}) {\n\t${0}\n}' },
      { label: 'if', detail: 'Condição if', insertText: 'if (${1:condicao}) {\n\t${0}\n}' },
      { label: 'if else', detail: 'Condição completa', insertText: 'if (${1:condicao}) {\n\t${2}\n} else {\n\t${0}\n}' },
      { label: 'ler inteiro', detail: 'Lê inteiro com cin', insertText: 'long long ${1:n};\ncin >> ${1:n};' },
      { label: 'vector', detail: 'Cria um vector com tamanho definido', insertText: 'vector<${1:int}> ${2:values}(${3:n});' },
      { label: 'ler vector', detail: 'Lê todos os valores de um vector', insertText: 'for (auto& ${1:value} : ${2:values}) cin >> ${1:value};' },
      { label: 'sort', detail: 'Ordena um container', insertText: 'sort(${1:values}.begin(), ${1:values}.end());' }
    ]
  };
  const keywords: Record<string, readonly string[]> = {
    python: ['and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'False', 'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'None', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'True', 'try', 'while', 'with', 'yield'],
    javascript: ['async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do', 'else', 'export', 'extends', 'false', 'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof', 'let', 'new', 'null', 'of', 'return', 'static', 'super', 'switch', 'this', 'throw', 'true', 'try', 'typeof', 'undefined', 'var', 'void', 'while', 'yield'],
    typescript: ['abstract', 'any', 'as', 'async', 'await', 'boolean', 'break', 'case', 'catch', 'class', 'const', 'continue', 'default', 'do', 'else', 'enum', 'export', 'extends', 'false', 'finally', 'for', 'function', 'if', 'implements', 'import', 'interface', 'keyof', 'let', 'never', 'new', 'null', 'number', 'private', 'protected', 'public', 'readonly', 'return', 'string', 'type', 'typeof', 'undefined', 'unknown', 'void', 'while'],
    lua: ['and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function', 'goto', 'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return', 'then', 'true', 'until', 'while'],
    cpp: ['alignas', 'auto', 'bool', 'break', 'case', 'catch', 'char', 'class', 'const', 'constexpr', 'continue', 'default', 'do', 'double', 'else', 'enum', 'false', 'float', 'for', 'if', 'include', 'inline', 'int', 'long', 'namespace', 'nullptr', 'private', 'protected', 'public', 'return', 'short', 'signed', 'sizeof', 'static', 'struct', 'switch', 'template', 'this', 'throw', 'true', 'try', 'typedef', 'typename', 'unsigned', 'using', 'vector', 'void', 'while']
  };
  const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn };
  const snippetItems = (snippets[language] ?? []).map((item) => ({
    label: item.label,
    detail: item.detail,
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: item.insertText,
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    sortText: `0-${item.label}`,
    range
  }));
  const keywordItems = (keywords[language] ?? []).map((keyword) => ({
    label: keyword,
    detail: `Palavra-chave de ${language === 'cpp' ? 'C++' : language === 'javascript' ? 'JavaScript' : language === 'typescript' ? 'TypeScript' : language === 'lua' ? 'Lua' : 'Python'}`,
    kind: monaco.languages.CompletionItemKind.Keyword,
    insertText: keyword,
    sortText: `1-${keyword}`,
    range
  }));
  return [...snippetItems, ...keywordItems];
}

async function pollPracticeSubmission(api: ReturnType<typeof createApi>, id: string, initialDelayMs: number): Promise<PracticeSubmission> {
  await delay(initialDelayMs);
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const submission = await api.submission(id);
    if (submission.status === 'FINISHED') return submission;
    await delay(Math.min(2_000, 500 + attempt * 100));
  }
  throw new Error('tempo limite de acompanhamento excedido');
}

function formatPracticeResult(result: PracticeSubmission): string {
  const label: Record<SubmissionVerdict, string> = {
    ACCEPTED: 'ACEITO', WRONG_ANSWER: 'RESPOSTA INCORRETA', COMPILE_ERROR: 'ERRO DE COMPILAÇÃO',
    RUNTIME_ERROR: 'ERRO EM EXECUÇÃO', TIME_LIMIT_EXCEEDED: 'TEMPO EXCEDIDO',
    MEMORY_LIMIT_EXCEEDED: 'MEMÓRIA EXCEDIDA', OUTPUT_LIMIT_EXCEEDED: 'SAÍDA EXCEDIDA',
    SYSTEM_ERROR: 'FALHA NO AVALIADOR', CANCELLED: 'CANCELADA'
  };
  const sections = [result.verdict ? label[result.verdict] : 'FINALIZADO'];
  if (result.compileOutput) sections.push(`Compilação:\n${result.compileOutput}`);
  if (result.stdout) sections.push(`Saída:\n${result.stdout}`);
  if (result.stderr) sections.push(`Erros:\n${result.stderr}`);
  return sections.join('\n\n');
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
