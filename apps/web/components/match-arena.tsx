'use client';

import type { MatchSnapshot } from '@devleague/contracts';
import { AlertTriangle, Flag, Radio, ShieldCheck, WifiOff } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { createApi, getAccessToken } from '../lib/auth';
import { publicConfig } from '../lib/config';
import { CodeEditor } from './code-editor';
import { ProblemMarkdown } from './problem-markdown';
import { VerdictBadge } from './ui';

type SyncState = 'demo' | 'connecting' | 'live' | 'reconnecting' | 'offline';
interface SnapshotAck { readonly ok: boolean; readonly snapshot?: unknown }

export function MatchArena({ initialMatch }: { initialMatch: MatchSnapshot }) {
  const [match, setMatch] = useState(initialMatch);
  const [serverOffsetMs, setServerOffsetMs] = useState(() => serverOffset(initialMatch.serverNow));
  const [remaining, setRemaining] = useState(() => secondsUntil(matchTarget(initialMatch), serverOffset(initialMatch.serverNow)));
  const [confirmForfeit, setConfirmForfeit] = useState(false);
  const [readyPending, setReadyPending] = useState(false);
  const [readyError, setReadyError] = useState<string | null>(null);
  const [sync, setSync] = useState<SyncState>(publicConfig.demoMode ? 'demo' : 'connecting');
  const api = useMemo(() => createApi(), []);
  const router = useRouter();
  const orderedParticipants = useMemo(() => [...match.participants].sort((left, right) =>
    left.userId === match.currentUserId ? -1 : right.userId === match.currentUserId ? 1 : 0
  ), [match.currentUserId, match.participants]);
  const currentParticipant = match.participants.find((participant) => participant.userId === match.currentUserId);
  const allParticipantsReady = match.participants.length === 2 && match.participants.every((participant) => participant.ready);

  const applySnapshot = useCallback((snapshot: unknown): snapshot is MatchSnapshot => {
    if (!isMatchSnapshot(snapshot)) return false;
    setMatch((current) => snapshot.version >= current.version ? snapshot : current);
    const nextOffset = serverOffset(snapshot.serverNow);
    setServerOffsetMs(nextOffset);
    setRemaining(secondsUntil(matchTarget(snapshot), nextOffset));
    if (snapshot.status === 'FINISHED' && snapshot.result) router.replace(`/matches/${snapshot.id}/result`);
    return true;
  }, [router]);

  const refresh = useCallback(async () => {
    applySnapshot(await api.match(match.id));
  }, [api, applySnapshot, match.id]);

  useEffect(() => {
    const updateClock = () => setRemaining(secondsUntil(matchTarget(match), serverOffsetMs));
    updateClock();
    const clock = window.setInterval(updateClock, 250);
    return () => window.clearInterval(clock);
  }, [match, serverOffsetMs]);

  useEffect(() => {
    if (match.status !== 'COUNTDOWN' || !allParticipantsReady) return;
    const waitMs = Math.max(0, new Date(match.startsAt).getTime() - (Date.now() + serverOffsetMs)) + 150;
    const transition = window.setTimeout(() => { void refresh().catch(() => setSync('offline')); }, waitMs);
    return () => window.clearTimeout(transition);
  }, [allParticipantsReady, match.startsAt, match.status, refresh, serverOffsetMs]);

  useEffect(() => {
    if (publicConfig.demoMode) return;
    let active = true;
    let socket: ReturnType<typeof io> | undefined;
    void getAccessToken().then((token) => {
      if (!active || !token) { setSync('offline'); return; }
      socket = io(publicConfig.socketUrl, { auth: { token }, transports: ['websocket'], reconnection: true });
      socket.on('connect', () => {
        setSync('live');
        socket?.emit('match.join', { matchId: match.id, lastEventSeq: initialMatch.version }, (ack: SnapshotAck) => {
          if (!ack.ok || !applySnapshot(ack.snapshot)) void refresh().catch(() => setSync('offline'));
        });
      });
      socket.on('disconnect', () => setSync('reconnecting'));
      socket.on('connect_error', () => setSync('offline'));
      socket.on('match.snapshot', (snapshot: unknown) => {
        if (!applySnapshot(snapshot)) void refresh().catch(() => setSync('offline'));
      });
    });
    const fallback = window.setInterval(() => { void refresh().catch(() => setSync('offline')); }, 8_000);
    return () => { active = false; window.clearInterval(fallback); socket?.disconnect(); };
  }, [applySnapshot, initialMatch.version, match.id, refresh]);

  async function refreshAfterSubmit() {
    if (publicConfig.demoMode) return;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await delay(1_000);
      const snapshot = await api.match(match.id);
      applySnapshot(snapshot);
      const latest = snapshot.mySubmissions.at(-1);
      if (snapshot.status === 'FINISHED' || latest?.status === 'FINISHED') return;
    }
    throw new Error('O judge ainda não concluiu o envio; o acompanhamento continuará pela partida.');
  }

  async function forfeit() {
    await api.forfeitMatch(match.id);
    router.replace(`/matches/${match.id}/result?outcome=forfeit`);
  }

  async function markReady() {
    setReadyPending(true);
    setReadyError(null);
    try {
      applySnapshot(await api.readyMatch(match.id));
    } catch {
      setReadyError('Não foi possível confirmar sua presença. Tente novamente.');
    } finally {
      setReadyPending(false);
    }
  }

  const syncLabel = sync === 'demo' ? 'modo demonstração' : sync === 'live' ? 'servidor sincronizado' : sync === 'connecting' ? 'conectando…' : sync === 'reconnecting' ? 'reconectando…' : 'usando atualização periódica';
  const phaseLabel = match.status === 'COUNTDOWN'
    ? allParticipantsReady ? 'COMEÇA EM' : 'LOBBY'
    : match.status === 'RESOLVING' ? 'RESOLVENDO' : match.status === 'CANCELLED' ? 'CANCELADA' : 'AO VIVO';

  return (
    <div className="arena-page">
      <header className="arena-header">
        <div className="arena-live"><Radio size={15} /> {phaseLabel} <span className="tag ranked">{match.type === 'RANKED_PUBLIC' ? 'RANQUEADA' : match.type === 'UNRANKED_PUBLIC' ? 'UNRANKED' : 'PRIVADA'}</span></div>
        <div className={remaining < 60 ? 'arena-clock danger-text' : 'arena-clock'}>{String(Math.floor(remaining / 60)).padStart(2, '0')}:{String(remaining % 60).padStart(2, '0')}</div>
        <div className="arena-actions"><span>{sync === 'offline' ? <WifiOff size={15} /> : <ShieldCheck size={15} />}{syncLabel}</span>{match.status === 'ACTIVE' && <button type="button" onClick={() => setConfirmForfeit(true)}><Flag size={15} /> Desistir</button>}</div>
      </header>
      {confirmForfeit && <div className="forfeit-bar"><AlertTriangle size={18} /><span><strong>Desistir encerra a partida e conta como derrota.</strong> Seu código não será enviado.</span><button className="button danger" onClick={() => void forfeit()}>Confirmar desistência</button><button className="button ghost" onClick={() => setConfirmForfeit(false)}>Voltar</button></div>}
      <div className="arena-score">
        {orderedParticipants.map((participant) => <div className={participant.userId === match.currentUserId ? 'current-player' : ''} key={participant.userId}><b>{participant.username.slice(0, 2).toUpperCase()}</b><span><strong>{participant.username}</strong><small>{participant.ready ? 'pronto' : 'aguardando'} · {participant.submissions} envios</small></span><i>{participant.userId === match.currentUserId ? 'VOCÊ' : 'RIVAL'}</i></div>)}
        {publicConfig.demoMode && <Link className="result-shortcut" href={`/matches/${match.id}/result`}>Concluir demo →</Link>}
      </div>
      {match.status === 'CANCELLED' ? (
        <section className="arena-lobby"><p className="eyebrow">LOBBY ENCERRADO</p><h1>Partida cancelada</h1><p>Nem todos confirmaram presença dentro do tempo. Nenhum rating foi alterado.</p><Link className="button primary" href="/play">Voltar para Jogar X1</Link></section>
      ) : !match.problem ? (
        <section className="arena-lobby"><p className="eyebrow">CONFIRMAÇÃO DE PRESENÇA</p><h1>Pronto para o X1?</h1><p>O desafio permanece oculto até os dois jogadores confirmarem. Depois disso, começa uma contagem regressiva curta e igual para ambos.</p><div className="arena-ready-state">{orderedParticipants.map((participant) => <span key={participant.userId} className={participant.ready ? 'is-ready' : ''}>{participant.username}: {participant.ready ? 'pronto' : 'aguardando'}</span>)}</div>{readyError && <p className="form-error">{readyError}</p>}<button className="button primary" type="button" disabled={readyPending || currentParticipant?.ready === true} onClick={() => void markReady()}>{currentParticipant?.ready ? 'Presença confirmada' : readyPending ? 'Confirmando…' : 'Estou pronto'}</button></section>
      ) : (
        <div className="arena-workspace">
          <article className="arena-problem"><p className="eyebrow">DESAFIO DO X1</p><h1>{match.problem.title}</h1><ProblemMarkdown value={match.problem.statementMarkdown} /><h2>Limites</h2><ProblemMarkdown value={match.problem.constraintsMarkdown} /><h2>Seus envios</h2><div className="submission-list">{match.mySubmissions.map((submission) => <div key={submission.id}><span>#{submission.admissionSeq}</span><small>{submission.status}</small>{submission.verdict && <VerdictBadge verdict={submission.verdict} />}</div>)}</div></article>
          <CodeEditor problem={match.problem} mode="match" matchId={match.id} onMatchSubmitted={refreshAfterSubmit} disabled={match.status !== 'ACTIVE'} />
        </div>
      )}
    </div>
  );
}

function serverOffset(serverNow: string): number {
  return new Date(serverNow).getTime() - Date.now();
}

function matchTarget(match: MatchSnapshot): string {
  const allReady = match.participants.length === 2 && match.participants.every((participant) => participant.ready);
  if (match.status === 'COUNTDOWN' && !allReady) return match.lobbyExpiresAt ?? match.startsAt;
  return match.status === 'COUNTDOWN' ? match.startsAt : match.endsAt;
}

function secondsUntil(timestamp: string, serverOffsetMs: number): number {
  return Math.max(0, Math.ceil((new Date(timestamp).getTime() - (Date.now() + serverOffsetMs)) / 1_000));
}

export function isMatchSnapshot(value: unknown): value is MatchSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const snapshot = value as Partial<MatchSnapshot>;
  return typeof snapshot.id === 'string' &&
    typeof snapshot.currentUserId === 'string' &&
    typeof snapshot.version === 'number' && Number.isInteger(snapshot.version) &&
    typeof snapshot.endsAt === 'string' && !Number.isNaN(Date.parse(snapshot.endsAt)) &&
    typeof snapshot.status === 'string' &&
    (snapshot.lobbyExpiresAt === null || (typeof snapshot.lobbyExpiresAt === 'string' && !Number.isNaN(Date.parse(snapshot.lobbyExpiresAt)))) &&
    (snapshot.problem === null || (
      typeof snapshot.problem === 'object' &&
      Array.isArray(snapshot.problem.languages) && Array.isArray(snapshot.problem.examples)
    )) &&
    Array.isArray(snapshot.participants) && snapshot.participants.every(isMatchParticipant) &&
    Array.isArray(snapshot.mySubmissions);
}

function isMatchParticipant(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const participant = value as Record<string, unknown>;
  return typeof participant.userId === 'string' && typeof participant.username === 'string' &&
    typeof participant.submissions === 'number' && typeof participant.ready === 'boolean';
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
