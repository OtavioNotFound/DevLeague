import { ArrowRight, BookOpen, Flame, Gauge, Swords, Trophy } from 'lucide-react';
import Link from 'next/link';
import { AppShell } from '../../components/app-shell';
import { DifficultyBadge, PageHeader, VerdictBadge } from '../../components/ui';
import { demoMe, demoProblems } from '../../lib/demo-data';

const recent = [
  { title: 'Eco do Array', mode: 'Treino', outcome: 'ACCEPTED' as const, when: 'há 18 min' },
  { title: 'Soma em Janela', mode: 'X1 ranqueado', outcome: 'WRONG_ANSWER' as const, when: 'ontem' }
];

export default function HomePage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="CENTRAL DO COMPETIDOR"
        title={`Boa noite, ${demoMe.username}.`}
        description="Aqueça com um problema ou entre direto na fila. Seu rating só muda em partidas públicas ranqueadas."
        action={<Link className="button primary large" href="/play/queue"><Swords size={19} /> Jogar X1</Link>}
      />

      <section className="home-stats" aria-label="Seu desempenho">
        <article className="card card-accent"><Gauge size={20} /><span className="stat-value">{demoMe.rating}</span><span className="stat-label">rating atual</span><small>Top 38% da alpha</small></article>
        <article className="card"><Trophy size={20} /><span className="stat-value">7</span><span className="stat-label">vitórias no X1</span><small>7 vitórias · 5 derrotas</small></article>
        <article className="card"><Flame size={20} /><span className="stat-value">3</span><span className="stat-label">dias de sequência</span><small>Seu recorde é 6</small></article>
      </section>

      <section className="home-grid">
        <div>
          <div className="section-heading"><div><p className="eyebrow">AQUECIMENTO</p><h2>Problemas recomendados</h2></div><Link className="text-link" href="/practice">Ver catálogo <ArrowRight size={16} /></Link></div>
          <div className="problem-stack">
            {demoProblems.slice(0, 2).map((problem, index) => (
              <Link key={problem.id} className="problem-row" href={`/practice/problems/${problem.id}`}>
                <span className="problem-index">0{index + 1}</span>
                <span className="problem-copy"><strong>{problem.title}</strong><small>{problem.categories.join(' · ')}</small></span>
                <DifficultyBadge value={problem.difficulty} />
                <ArrowRight size={18} />
              </Link>
            ))}
          </div>
        </div>

        <aside>
          <div className="section-heading"><div><p className="eyebrow">ATIVIDADE</p><h2>Últimas tentativas</h2></div></div>
          <div className="activity-list card">
            {recent.map((item) => <div key={item.title}><BookOpen size={17} /><span><strong>{item.title}</strong><small>{item.mode} · {item.when}</small></span><VerdictBadge verdict={item.outcome} /></div>)}
          </div>
        </aside>
      </section>
    </AppShell>
  );
}
