'use client';

import type { ProblemDetail } from '@devleague/contracts';
import { BookOpen, Clock3, Database, LoaderCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createApi } from '../lib/auth';
import { publicConfig } from '../lib/config';
import { demoProblem } from '../lib/demo-data';
import { CodeEditor } from './code-editor';
import { DifficultyBadge } from './ui';
import { ProblemMarkdown } from './problem-markdown';

export function PracticeProblemLoader({ id }: { id: string }) {
  const [problem, setProblem] = useState<ProblemDetail | null>(publicConfig.demoMode ? { ...demoProblem, id } : null);
  const [failure, setFailure] = useState('');
  const api = useMemo(() => createApi(), []);
  useEffect(() => {
    if (publicConfig.demoMode) return;
    let active = true;
    void api.problem(id).then((value) => { if (active) setProblem(value); }).catch(() => { if (active) setFailure('Não foi possível carregar este problema.'); });
    return () => { active = false; };
  }, [api, id]);
  if (failure) return <div className="session-state"><strong>Problema indisponível</strong><p>{failure}</p><a className="button secondary" href="/practice">Voltar ao catálogo</a></div>;
  if (!problem) return <div className="session-state"><LoaderCircle className="spin" /><strong>Carregando enunciado…</strong></div>;
  return <div className="practice-workspace"><article className="problem-statement"><header><div><p className="eyebrow">PROBLEMA</p><h1>{problem.title}</h1></div><DifficultyBadge value={problem.difficulty} /></header><div className="problem-meta"><span><Clock3 size={15} /> 10 min sugeridos</span><span><Database size={15} /> 256 MB</span><span><BookOpen size={15} /> {problem.categories.join(' · ')}</span></div><section><h2>Enunciado</h2><ProblemMarkdown value={problem.statementMarkdown} /></section><section><h2>Entrada e limites</h2><ProblemMarkdown value={problem.constraintsMarkdown} /></section><section><h2>Exemplos</h2>{problem.examples.map((example, index) => <div className="example-grid" key={example.id}><div><small>ENTRADA {index + 1}</small><pre>{example.stdin}</pre></div><div><small>SAÍDA ESPERADA</small><pre>{example.expectedOutput}</pre></div></div>)}</section></article><CodeEditor problem={problem} /></div>;
}
