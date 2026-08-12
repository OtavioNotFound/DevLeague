'use client';

import type { MatchSnapshot } from '@devleague/contracts';
import { LoaderCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createApi } from '../lib/auth';
import { publicConfig } from '../lib/config';
import { demoMatch } from '../lib/demo-data';
import { MatchArena } from './match-arena';

export function MatchLoader({ id }: { id: string }) {
  const [match, setMatch] = useState<MatchSnapshot | null>(publicConfig.demoMode ? { ...demoMatch, id } : null);
  const [failure, setFailure] = useState('');
  const api = useMemo(() => createApi(), []);

  useEffect(() => {
    if (publicConfig.demoMode) return;
    let active = true;
    void api.match(id).then((snapshot) => { if (active) setMatch(snapshot); }).catch(() => { if (active) setFailure('Não foi possível abrir esta partida.'); });
    return () => { active = false; };
  }, [api, id]);

  if (failure) return <div className="session-state"><strong>Partida indisponível</strong><p>{failure}</p><a className="button secondary" href="/home">Voltar ao início</a></div>;
  if (!match) return <div className="session-state"><LoaderCircle className="spin" /><strong>Sincronizando partida…</strong></div>;
  return <MatchArena initialMatch={match} />;
}
