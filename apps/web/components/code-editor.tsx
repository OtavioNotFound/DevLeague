'use client';

import type { LanguageKey, PracticeSubmission, ProblemDetail, SubmissionVerdict } from '@devleague/contracts';
import { CheckCircle2, ChevronDown, LoaderCircle, Play, Send, TerminalSquare } from 'lucide-react';
import { useMemo, useState } from 'react';
import { createApi } from '../lib/auth';
import { publicConfig } from '../lib/config';

const languages: readonly { key: LanguageKey; label: string; runtime: string }[] = [
  { key: 'python', label: 'Python', runtime: '3.13' },
  { key: 'javascript', label: 'JavaScript', runtime: 'Node 24' },
  { key: 'java', label: 'Java', runtime: '24' },
  { key: 'cpp', label: 'C++', runtime: 'GCC 15' }
];

export function CodeEditor({ problem, mode = 'practice', matchId, onMatchSubmitted }: { problem: ProblemDetail; mode?: 'practice' | 'match'; matchId?: string; onMatchSubmitted?: () => Promise<void> | void }) {
  const [language, setLanguage] = useState<LanguageKey>('python');
  const [sources, setSources] = useState<Partial<Record<LanguageKey, string>>>(() => ({ ...problem.starterCode }));
  const [state, setState] = useState<'idle' | 'running' | 'accepted' | 'rejected' | 'error'>('idle');
  const [consoleText, setConsoleText] = useState('Execute o código para validar o primeiro exemplo.');
  const api = useMemo(() => createApi(), []);
  const source = sources[language] ?? '';

  async function execute(kind: 'runs' | 'submissions') {
    setState('running');
    setConsoleText(kind === 'runs' ? 'Executando casos de exemplo…' : 'Enviando para avaliação…');
    try {
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

  return (
    <section className={`editor-panel ${mode === 'match' ? 'match-editor' : ''}`}>
      <header className="editor-toolbar">
        <div className="language-picker">
          <select aria-label="Linguagem" value={language} onChange={(event) => setLanguage(event.target.value as LanguageKey)}>
            {languages.map((item) => <option value={item.key} key={item.key}>{item.label} · {item.runtime}</option>)}
          </select>
          <ChevronDown size={15} aria-hidden="true" />
        </div>
        <span className="autosave-state">Salvo localmente</span>
      </header>
      <div className="editor-surface">
        <div className="line-numbers" aria-hidden="true">{Array.from({ length: Math.max(source.split('\n').length, 14) }, (_, index) => <span key={index}>{index + 1}</span>)}</div>
        <textarea aria-label="Editor de código" spellCheck={false} value={source} onChange={(event) => setSources((current) => ({ ...current, [language]: event.target.value }))} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); void execute('runs'); } }} />
      </div>
      <div className="console-panel">
        <div className="console-title"><TerminalSquare size={15} /> SAÍDA {state === 'accepted' && <span><CheckCircle2 size={14} /> concluído</span>}</div>
        <pre className={state === 'error' || state === 'rejected' ? 'console-error' : state === 'accepted' ? 'console-success' : ''}>{consoleText}</pre>
      </div>
      <footer className="editor-actions">
        <span>Ctrl + Enter para executar</span>
        <div>
          <button className="button secondary" type="button" disabled={state === 'running'} onClick={() => void execute('runs')}><Play size={16} /> Executar</button>
          <button className="button primary" type="button" disabled={state === 'running'} onClick={() => void execute('submissions')}>{state === 'running' ? <LoaderCircle className="spin" size={17} /> : <Send size={16} />} {mode === 'match' ? 'Enviar solução' : 'Submeter'}</button>
        </div>
      </footer>
    </section>
  );
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
