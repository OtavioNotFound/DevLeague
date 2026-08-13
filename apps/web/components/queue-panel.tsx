'use client';

import { ArrowLeft, CheckCircle2, LoaderCircle, Radio, ShieldCheck, Swords, TimerReset, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createApi } from '../lib/auth';
import { ApiError } from '../lib/api';
import { demoMatch } from '../lib/demo-data';
import { publicConfig } from '../lib/config';
import { useAccount } from './session-gate';

export function QueuePanel({ mode }: { mode: 'RANKED' | 'UNRANKED' }) {
  const [seconds, setSeconds] = useState(0);
  const [phase, setPhase] = useState<'joining' | 'searching' | 'found' | 'error'>('joining');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [matchId, setMatchId] = useState(demoMatch.id);
  const api = useMemo(() => createApi(), []);
  const account = useAccount();

  useEffect(() => {
    let active = true;
    void api.joinQueue(mode).then(() => { if (active) setPhase('searching'); }).catch((error: unknown) => {
      if (!active) return;
      setErrorCode(error instanceof ApiError ? error.code : 'NETWORK_ERROR');
      setPhase('error');
    });
    const clock = window.setInterval(() => setSeconds((value) => value + 1), 1_000);
    const found = publicConfig.demoMode ? window.setTimeout(() => { if (active) setPhase('found'); }, 5_500) : undefined;
    const status = !publicConfig.demoMode ? window.setInterval(() => {
      void api.me().then((me) => {
        if (active && me.activeMatchId) { setMatchId(me.activeMatchId); setPhase('found'); }
      }).catch(() => undefined);
    }, 2_000) : undefined;
    const heartbeat = window.setInterval(() => { void api.heartbeatQueue().catch(() => undefined); }, 15_000);
    return () => { active = false; window.clearInterval(clock); window.clearInterval(heartbeat); if (found) window.clearTimeout(found); if (status) window.clearInterval(status); };
  }, [api, mode]);

  async function cancel() {
    await api.leaveQueue().catch(() => undefined);
    window.location.href = '/home';
  }

  if (phase === 'found') return (
    <div className="queue-card found-card">
      <CheckCircle2 size={46} />
      <p className="eyebrow">RIVAL ENCONTRADO</p><h1>PARTIDA PRONTA.</h1>
      <div className="found-players"><span><b>{account.username.slice(0,2).toUpperCase()}</b><strong>{account.username}</strong><small>{account.rating}</small></span><i>VS</i><span><b>?</b><strong>{publicConfig.demoMode ? 'bytebruna' : 'rival confirmado'}</strong><small>{publicConfig.demoMode ? '0' : 'rating compatível'}</small></span></div>
      <Link className="button primary large" href={`/matches/${matchId}`}>Entrar na arena <Swords size={19} /></Link>
      <small>A partida inicia quando os dois participantes estiverem conectados.</small>
    </div>
  );

  return (
    <div className="queue-card">
      <div className="radar" aria-hidden="true"><span><Swords size={30} /></span><i /><i /></div>
      <p className="eyebrow">{mode === 'RANKED' ? 'MATCHMAKING RANQUEADO' : 'MATCHMAKING SEM RATING'}</p><h1>{phase === 'error' ? 'FILA INDISPONÍVEL.' : 'PROCURANDO RIVAL.'}</h1>
      <p className="queue-lead">{phase === 'error' ? queueErrorMessage(errorCode) : 'Buscando um rival para uma partida casual, sem alteração de rating.'}</p>
      {phase !== 'error' && <><span className="queue-time">{String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</span><div className="searching-state"><LoaderCircle className="spin" size={16} /> {phase === 'joining' ? 'Entrando na fila…' : 'Expandindo faixa aos poucos'}</div></>}
      <div className="queue-rules"><span><Radio size={17} /><b>Região</b><small>São Paulo</small></span><span><UsersRound size={17} /><b>Rating</b><small>não é alterado</small></span><span><TimerReset size={17} /><b>Duração</b><small>10 minutos</small></span><span><ShieldCheck size={17} /><b>Validação</b><small>Wasm · exemplos públicos</small></span></div>
      {phase === 'error' ? <button className="button primary" type="button" onClick={() => window.location.reload()}>Tentar novamente</button> : <button className="button ghost" type="button" onClick={() => void cancel()}><ArrowLeft size={17} /> Cancelar busca</button>}
    </div>
  );
}

function queueErrorMessage(code: string | null): string {
  if (code === 'ALPHA_NOT_ELIGIBLE') {
    return 'Sua sessão ainda não reconheceu a confirmação do e-mail. Saia da conta, entre novamente e tente de novo.';
  }
  if (code === 'MATCHMAKING_DISABLED') return 'O matchmaking está temporariamente desativado.';
  if (code === 'COMPETITIVE_EXECUTION_DISABLED') return 'O X1 casual está pausado no servidor. O catálogo de prática continua disponível.';
  if (code === 'RANKED_DISABLED') return 'O ranked está pausado até o judge competitivo estar pronto. O modo unranked continua disponível.';
  return 'Não conseguimos acessar o matchmaking. Tente novamente em alguns instantes.';
}
