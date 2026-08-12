'use client';

import type { MatchSnapshot, ProblemDetail } from '@devleague/contracts';
import { AlertTriangle, Flag, Radio, ShieldCheck, WifiOff } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { createApi, getAccessToken } from '../lib/auth';
import { publicConfig } from '../lib/config';
import { demoProblem } from '../lib/demo-data';
import { CodeEditor } from './code-editor';
import { VerdictBadge } from './ui';

type SyncState = 'demo' | 'connecting' | 'live' | 'reconnecting' | 'offline';
interface SnapshotAck { readonly ok: boolean; readonly snapshot?: MatchSnapshot }

export function MatchArena({ initialMatch }: { initialMatch: MatchSnapshot }) {
  const [match, setMatch] = useState(initialMatch);
  const [remaining, setRemaining] = useState(() => secondsUntil(initialMatch.endsAt));
  const [confirmForfeit, setConfirmForfeit] = useState(false);
  const [sync, setSync] = useState<SyncState>(publicConfig.demoMode ? 'demo' : 'connecting');
  const api = useMemo(() => createApi(), []);
  const router = useRouter();
  const problem: ProblemDetail = { ...demoProblem, versionId: match.problem.versionId, title: match.problem.title, statementMarkdown: match.problem.statementMarkdown, constraintsMarkdown: match.problem.constraintsMarkdown };

  const applySnapshot = useCallback((snapshot: MatchSnapshot) => {
    setMatch((current) => snapshot.version >= current.version ? snapshot : current);
    setRemaining(secondsUntil(snapshot.endsAt));
    if (snapshot.status === 'FINISHED' && snapshot.result) router.replace(`/matches/${snapshot.id}/result`);
  }, [router]);

  const refresh = useCallback(async () => {
    const snapshot = await api.match(match.id);
    applySnapshot(snapshot);
  }, [api, applySnapshot, match.id]);

  useEffect(() => {
    const clock = window.setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1_000);
    return () => window.clearInterval(clock);
  }, []);

  useEffect(() => {
    if (publicConfig.demoMode) return;
    let active = true;
    let socket: ReturnType<typeof io> | undefined;
    void getAccessToken().then((token) => {
      if (!active || !token) { setSync('offline'); return; }
      socket = io(publicConfig.socketUrl, { auth: { token }, transports: ['websocket'], reconnection: true });
      socket.on('connect', () => {
        setSync('live');
        socket?.emit('match.join', { matchId: match.id, lastEventSeq: initialMatch.version }, (ack: SnapshotAck) => { if (ack.ok && ack.snapshot) applySnapshot(ack.snapshot); });
      });
      socket.on('disconnect', () => setSync('reconnecting'));
      socket.on('connect_error', () => setSync('offline'));
      socket.on('match.snapshot', applySnapshot);
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
  }

  async function forfeit() {
    await api.forfeitMatch(match.id);
    router.replace(`/matches/${match.id}/result?outcome=forfeit`);
  }

  const syncLabel = sync === 'demo' ? 'modo demonstração' : sync === 'live' ? 'servidor sincronizado' : sync === 'connecting' ? 'conectando…' : sync === 'reconnecting' ? 'reconectando…' : 'usando atualização periódica';
  return (
    <div className="arena-page">
      <header className="arena-header">
        <div className="arena-live"><Radio size={15} /> AO VIVO <span className="tag ranked">{match.type === 'RANKED_PUBLIC' ? 'RANQUEADA' : 'PRIVADA'}</span></div>
        <div className={remaining < 60 ? 'arena-clock danger-text' : 'arena-clock'}>{String(Math.floor(remaining / 60)).padStart(2, '0')}:{String(remaining % 60).padStart(2, '0')}</div>
        <div className="arena-actions"><span>{sync === 'offline' ? <WifiOff size={15} /> : <ShieldCheck size={15} />}{syncLabel}</span><button type="button" onClick={() => setConfirmForfeit(true)}><Flag size={15} /> Desistir</button></div>
      </header>
      {confirmForfeit && <div className="forfeit-bar"><AlertTriangle size={18} /><span><strong>Desistir encerra a partida e conta como derrota.</strong> Seu código não será enviado.</span><button className="button danger" onClick={() => void forfeit()}>Confirmar desistência</button><button className="button ghost" onClick={() => setConfirmForfeit(false)}>Voltar</button></div>}
      <div className="arena-score">
        {match.participants.map((participant, index) => <div className={index === 0 ? 'current-player' : ''} key={participant.userId}><b>{participant.username.slice(0,2).toUpperCase()}</b><span><strong>{participant.username}</strong><small>{participant.submissions} envios</small></span><i>{index === 0 ? 'VOCÊ' : 'ONLINE'}</i></div>)}
        {publicConfig.demoMode && <Link className="result-shortcut" href={`/matches/${match.id}/result`}>Concluir demo →</Link>}
      </div>
      <div className="arena-workspace">
        <article className="arena-problem"><p className="eyebrow">DESAFIO DO X1</p><h1>{match.problem.title}</h1><p>{match.problem.statementMarkdown}</p><h2>Limites</h2><pre>{match.problem.constraintsMarkdown}</pre><h2>Seus envios</h2><div className="submission-list">{match.mySubmissions.map((submission) => <div key={submission.id}><span>#{submission.admissionSeq}</span><small>{submission.status}</small>{submission.verdict && <VerdictBadge verdict={submission.verdict} />}</div>)}</div></article>
        <CodeEditor problem={problem} mode="match" matchId={match.id} onMatchSubmitted={refreshAfterSubmit} />
      </div>
    </div>
  );
}

function secondsUntil(timestamp: string): number {
  return Math.max(0, Math.floor((new Date(timestamp).getTime() - Date.now()) / 1_000));
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
