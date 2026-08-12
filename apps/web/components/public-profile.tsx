'use client';

import { Gauge, Swords, Trophy } from 'lucide-react';
import { useAccount } from './session-gate';
import { PageHeader } from './ui';

export function PublicProfile({ username }: { username: string }) {
  const account = useAccount();
  const isOwnProfile = username.toLocaleLowerCase('pt-BR') === account.username.toLocaleLowerCase('pt-BR');

  if (!isOwnProfile) {
    return <div className="catalog-empty">A consulta de outros perfis públicos será habilitada em uma próxima etapa da alpha.</div>;
  }

  return (
    <>
      <PageHeader eyebrow="PERFIL PÚBLICO" title={`@${account.username}`} description="Competidor da alpha fechada" action={<span className="profile-avatar">{account.username.slice(0, 2).toUpperCase()}</span>} />
      <section className="profile-stats"><article><Gauge /><strong>{account.rating}</strong><small>rating</small></article><article><Trophy /><strong>{account.stats.wins}</strong><small>vitórias</small></article><article><Swords /><strong>{account.stats.games}</strong><small>partidas</small></article><article><Gauge /><strong>{account.stats.peakRating}</strong><small>pico de rating</small></article></section>
      <section className="profile-history"><div className="section-heading"><div><p className="eyebrow">HISTÓRICO</p><h2>Atividade competitiva</h2></div></div><div className="catalog-empty">Nenhuma partida ranqueada registrada ainda.</div></section>
    </>
  );
}
