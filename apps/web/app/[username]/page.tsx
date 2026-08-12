import { CalendarDays, Code2, Gauge, Swords, Trophy } from 'lucide-react';
import { notFound } from 'next/navigation';
import { AppShell } from '../../components/app-shell';
import { PageHeader } from '../../components/ui';
import { demoMe } from '../../lib/demo-data';

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  if (!username.startsWith('@')) notFound();
  const clean = username.slice(1);
  return (
    <AppShell>
      <PageHeader eyebrow="PERFIL PÚBLICO" title={`@${clean}`} description="Competidor da alpha fechada · Brasil" action={<span className="profile-avatar">{clean.slice(0,2).toUpperCase()}</span>} />
      <section className="profile-stats"><article><Gauge /><strong>{clean === demoMe.username ? demoMe.rating : 1261}</strong><small>rating</small></article><article><Trophy /><strong>7</strong><small>vitórias</small></article><article><Swords /><strong>12</strong><small>partidas</small></article><article><Code2 /><strong>19</strong><small>problemas aceitos</small></article></section>
      <section className="profile-history"><div className="section-heading"><div><p className="eyebrow">HISTÓRICO</p><h2>Atividade competitiva</h2></div><span><CalendarDays size={15} /> desde agosto de 2026</span></div><div className="history-row"><span className="result-letter win">V</span><span><strong>Eco do Array</strong><small>vs. bytebruna · Python</small></span><b>+16</b><time>há 18 min</time></div><div className="history-row"><span className="result-letter loss">D</span><span><strong>Soma em Janela</strong><small>vs. devlucas · JavaScript</small></span><b>−14</b><time>ontem</time></div></section>
    </AppShell>
  );
}
