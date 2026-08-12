'use client';

import type { ProblemSummary, RecentPracticeSubmission } from '@devleague/contracts';
import { ArrowRight, BookOpen, Gauge, LoaderCircle, Swords, Trophy } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '../../components/app-shell';
import { useAccount } from '../../components/session-gate';
import { DifficultyBadge, PageHeader, VerdictBadge } from '../../components/ui';
import { createApi } from '../../lib/auth';

export default function HomePage() {
  return <AppShell><HomeContent /></AppShell>;
}

function HomeContent() {
  const account = useAccount();
  const api = useMemo(() => createApi(), []);
  const [problems, setProblems] = useState<readonly ProblemSummary[]>([]);
  const [recent, setRecent] = useState<readonly RecentPracticeSubmission[]>([]);
  const [loadingProblems, setLoadingProblems] = useState(true);

  useEffect(() => {
    let active = true;
    void api.problems()
      .then(({ items }) => { if (active) setProblems(items.slice(0, 2)); })
      .catch(() => { if (active) setProblems([]); })
      .finally(() => { if (active) setLoadingProblems(false); });
    void api.recentPractice()
      .then((items) => { if (active) setRecent(items); })
      .catch(() => { if (active) setRecent([]); });
    return () => { active = false; };
  }, [api]);

  return (
    <>
      <PageHeader
        eyebrow="CENTRAL DO COMPETIDOR"
        title={`Olá, ${account.username}.`}
        description="Aqueça com um problema ou entre direto na fila. Seu rating só muda em partidas públicas ranqueadas."
        action={<Link className="button primary large" href="/play/queue"><Swords size={19} /> Jogar X1</Link>}
      />

      <section className="home-stats" aria-label="Seu desempenho">
        <article className="card card-accent"><Gauge size={20} /><span className="stat-value">{account.rating}</span><span className="stat-label">rating atual</span><small>Pico: {account.stats.peakRating}</small></article>
        <article className="card"><Trophy size={20} /><span className="stat-value">{account.stats.wins}</span><span className="stat-label">vitórias no X1</span><small>{account.stats.wins} vitórias · {account.stats.losses} derrotas</small></article>
        <article className="card"><Swords size={20} /><span className="stat-value">{account.stats.games}</span><span className="stat-label">partidas ranqueadas</span><small>{account.stats.draws} empates</small></article>
      </section>

      <section className="home-grid">
        <div>
          <div className="section-heading"><div><p className="eyebrow">AQUECIMENTO</p><h2>Problemas recomendados</h2></div><Link className="text-link" href="/practice">Ver catálogo <ArrowRight size={16} /></Link></div>
          <div className="problem-stack">
            {loadingProblems && <div className="catalog-loading"><LoaderCircle className="spin" /> Carregando problemas…</div>}
            {!loadingProblems && problems.map((problem, index) => (
              <Link key={problem.id} className="problem-row" href={`/practice/problems/${problem.id}`}>
                <span className="problem-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="problem-copy"><strong>{problem.title}</strong><small>{problem.categories.join(' · ')}</small></span>
                <DifficultyBadge value={problem.difficulty} />
                <ArrowRight size={18} />
              </Link>
            ))}
            {!loadingProblems && problems.length === 0 && <div className="catalog-empty">Nenhum problema publicado ainda.</div>}
          </div>
        </div>

        <aside>
          <div className="section-heading"><div><p className="eyebrow">ATIVIDADE</p><h2>Últimas tentativas</h2></div></div>
          <div className="activity-list card">
            {recent.map((item) => item.verdict && <div key={item.id}><BookOpen size={17} /><span><strong>{item.problemTitle}</strong><small>{item.kind === 'RUN' ? 'Execução' : 'Submissão'} · {item.language.toUpperCase()}</small></span><VerdictBadge verdict={item.verdict} /></div>)}
            {recent.length === 0 && <div><BookOpen size={20} /><span><strong>Nenhuma tentativa registrada</strong><small>Suas submissões reais aparecerão aqui.</small></span></div>}
          </div>
        </aside>
      </section>
    </>
  );
}
