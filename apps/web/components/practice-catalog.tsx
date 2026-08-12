'use client';

import type { ProblemSummary } from '@devleague/contracts';
import { ArrowRight, Filter, LoaderCircle, Search } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createApi } from '../lib/auth';
import { publicConfig } from '../lib/config';
import { demoProblems } from '../lib/demo-data';
import { DifficultyBadge } from './ui';

export function PracticeCatalog() {
  const [problems, setProblems] = useState<readonly ProblemSummary[]>(publicConfig.demoMode ? demoProblems : []);
  const [loading, setLoading] = useState(!publicConfig.demoMode);
  const [failure, setFailure] = useState('');
  const [query, setQuery] = useState('');
  const [difficulty, setDifficulty] = useState<'ALL' | ProblemSummary['difficulty']>('ALL');
  const api = useMemo(() => createApi(), []);
  useEffect(() => {
    if (publicConfig.demoMode) return;
    let active = true;
    void api.problems().then(({ items }) => { if (active) { setProblems(items); setLoading(false); } }).catch(() => { if (active) { setFailure('Não foi possível carregar o catálogo.'); setLoading(false); } });
    return () => { active = false; };
  }, [api]);
  if (loading) return <div className="catalog-loading"><LoaderCircle className="spin" /> Carregando problemas…</div>;
  if (failure) return <div className="inline-alert danger">{failure}</div>;
  const normalized = query.trim().toLocaleLowerCase('pt-BR');
  const filtered = problems.filter((problem) => (difficulty === 'ALL' || problem.difficulty === difficulty) && (!normalized || problem.title.toLocaleLowerCase('pt-BR').includes(normalized) || problem.categories.some((category) => category.toLocaleLowerCase('pt-BR').includes(normalized))));
  return <><div className="catalog-toolbar"><label className="search-box"><Search size={18} /><input aria-label="Buscar problema" placeholder="Buscar por título ou categoria" value={query} onChange={(event) => setQuery(event.target.value)} /></label><label className="filter-select"><Filter size={17} /><select aria-label="Filtrar dificuldade" value={difficulty} onChange={(event) => setDifficulty(event.target.value as typeof difficulty)}><option value="ALL">Todas</option><option value="EASY">Fácil</option><option value="MEDIUM">Médio</option><option value="HARD">Difícil</option></select></label></div><section className="catalog-list" aria-label="Problemas disponíveis"><div className="catalog-head"><span>Problema</span><span>Categoria</span><span>Dificuldade</span><span>Linguagens</span><span /></div>{filtered.map((problem, index) => <Link className="catalog-row" href={`/practice/problems/${problem.id}`} key={problem.id}><span className="catalog-title"><small>{String(index + 1).padStart(2, '0')}</small><strong>{problem.title}</strong></span><span className="category-list">{problem.categories.map((category) => <span className="tag" key={category}>{category}</span>)}</span><DifficultyBadge value={problem.difficulty} /><span className="language-list">{problem.languages.map((language) => language === 'javascript' ? 'JS' : language.toUpperCase()).join(' · ')}</span><ArrowRight size={18} /></Link>)}{filtered.length === 0 && <div className="catalog-empty">Nenhum problema corresponde aos filtros.</div>}</section><p className="catalog-note">{filtered.length} de {problems.length} problemas · novos enunciados entram após revisão editorial e técnica.</p></>;
}
