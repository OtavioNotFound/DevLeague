'use client';

import { CheckCircle2, Radio, RotateCcw, ShieldCheck, Swords, TimerReset, Trophy, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { demoMe, demoProblem } from '../lib/demo-data';
import { CodeEditor } from './code-editor';
import { ProblemMarkdown } from './problem-markdown';

type DemoPhase = 'searching' | 'found' | 'arena' | 'won';

export function DemoX1() {
  const [phase, setPhase] = useState<DemoPhase>('searching');
  const [queueSeconds, setQueueSeconds] = useState(0);
  const [remaining, setRemaining] = useState(10 * 60);
  const [submissions, setSubmissions] = useState(0);

  useEffect(() => {
    if (phase !== 'searching') return;
    const clock = window.setInterval(() => setQueueSeconds((value) => value + 1), 1_000);
    const found = window.setTimeout(() => setPhase('found'), 2_400);
    return () => { window.clearInterval(clock); window.clearTimeout(found); };
  }, [phase]);

  useEffect(() => {
    if (phase !== 'arena') return;
    const clock = window.setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1_000);
    return () => window.clearInterval(clock);
  }, [phase]);

  function reset() {
    setPhase('searching');
    setQueueSeconds(0);
    setRemaining(10 * 60);
    setSubmissions(0);
  }

  async function handleValidation(accepted: boolean) {
    setSubmissions((value) => value + 1);
    if (accepted) {
      await new Promise((resolve) => window.setTimeout(resolve, 700));
      setPhase('won');
    }
  }

  if (phase === 'searching') return (
    <div className="queue-card">
      <div className="radar" aria-hidden="true"><span><Swords size={30} /></span><i /><i /></div>
      <p className="eyebrow">X1 DEMONSTRATIVO · SEM RATING</p><h1>PROCURANDO RIVAL.</h1>
      <p className="queue-lead">Preparando uma partida local contra um rival simulado.</p>
      <span className="queue-time">00:{String(queueSeconds).padStart(2, '0')}</span>
      <div className="searching-state"><Radio size={16} /> Matchmaking de demonstração</div>
      <div className="queue-rules"><span><Radio size={17} /><b>Região</b><small>Local</small></span><span><UsersRound size={17} /><b>Rating</b><small>0</small></span><span><TimerReset size={17} /><b>Duração</b><small>10 minutos</small></span><span><ShieldCheck size={17} /><b>Modo</b><small>Simulação</small></span></div>
    </div>
  );

  if (phase === 'found') return (
    <div className="queue-card found-card">
      <CheckCircle2 size={46} />
      <p className="eyebrow">RIVAL ENCONTRADO</p><h1>PARTIDA PRONTA.</h1>
      <div className="found-players"><span><b>OT</b><strong>{demoMe.username}</strong><small>0</small></span><i>VS</i><span><b>BB</b><strong>bytebruna</strong><small>0</small></span></div>
      <button className="button primary large" type="button" onClick={() => setPhase('arena')}>Entrar na arena <Swords size={19} /></button>
      <small>O rival desta demonstração é simulado no navegador.</small>
    </div>
  );

  if (phase === 'won') return (
    <div className="demo-result">
      <section className="result-hero won"><Trophy size={48} /><p className="eyebrow">PARTIDA ENCERRADA</p><h1>VITÓRIA</h1><p>Sua solução passou nos exemplos antes do rival simulado.</p></section>
      <section className="result-stats"><article><Trophy size={19} /><span><small>RESULTADO</small><strong>1 — 0</strong></span><b className="positive">VENCEU</b></article><article><Swords size={19} /><span><small>SEUS ENVIOS</small><strong>{submissions} tentativa{submissions === 1 ? '' : 's'}</strong></span><b>Demo</b></article><article><ShieldCheck size={19} /><span><small>RATING</small><strong>0 → 0</strong></span><b>Sem rating</b></article></section>
      <div className="result-actions"><button className="button primary large" type="button" onClick={reset}><RotateCcw size={18} /> Jogar novamente</button><Link className="button secondary large" href="/demo">Voltar ao treino</Link></div>
    </div>
  );

  return (
    <div className="arena-page">
      <div className="inline-alert demo-x1-warning"><ShieldCheck size={18} /><span><strong>Simulação local.</strong> O rival e o resultado são demonstrativos; não há judge competitivo nem mudança de rating.</span></div>
      <header className="arena-header"><div className="arena-live"><Radio size={15} /> AO VIVO <span className="tag">DEMO</span></div><div className={remaining < 60 ? 'arena-clock danger-text' : 'arena-clock'}>{String(Math.floor(remaining / 60)).padStart(2, '0')}:{String(remaining % 60).padStart(2, '0')}</div><div className="arena-actions"><span><ShieldCheck size={15} /> execução local</span></div></header>
      <div className="arena-score"><div className="current-player"><b>OT</b><span><strong>{demoMe.username}</strong><small>pronto · {submissions} envios</small></span><i>VOCÊ</i></div><div><b>BB</b><span><strong>bytebruna</strong><small>pronto · 0 envios</small></span><i>RIVAL SIMULADO</i></div></div>
      <div className="arena-workspace">
        <article className="arena-problem"><p className="eyebrow">DESAFIO DO X1</p><h1>{demoProblem.title}</h1><ProblemMarkdown value={demoProblem.statementMarkdown} /><h2>Limites</h2><ProblemMarkdown value={demoProblem.constraintsMarkdown} /></article>
        <CodeEditor problem={demoProblem} mode="match" localCompetition onLocalValidation={handleValidation} />
      </div>
    </div>
  );
}
