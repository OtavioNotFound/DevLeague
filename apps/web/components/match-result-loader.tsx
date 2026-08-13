'use client';

import type { MatchSnapshot } from '@devleague/contracts';
import { ArrowRight, Code2, Gauge, Home, LoaderCircle, RotateCcw, Trophy } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createApi } from '../lib/auth';
import { publicConfig } from '../lib/config';
import { demoMatch } from '../lib/demo-data';
import { useAccount } from './session-gate';

export function MatchResultLoader({ id, demoOutcome }: { id: string; demoOutcome?: string }) {
  const account = useAccount();
  const [match, setMatch] = useState<MatchSnapshot | null>(publicConfig.demoMode ? demoResult(id, account.id, demoOutcome) : null);
  const [failure, setFailure] = useState('');
  const api = useMemo(() => createApi(), []);

  useEffect(() => {
    if (publicConfig.demoMode) return;
    let active = true;
    void pollResult(api, id).then((snapshot) => { if (active) setMatch(snapshot); }).catch(() => { if (active) setFailure('Não foi possível confirmar o resultado desta partida.'); });
    return () => { active = false; };
  }, [api, id]);

  if (failure) return <div className="session-state"><strong>Resultado indisponível</strong><p>{failure}</p><Link className="button secondary" href="/home">Voltar ao início</Link></div>;
  if (!match?.result) return <div className="session-state"><LoaderCircle className="spin" /><strong>Confirmando o veredito do servidor…</strong></div>;

  const result = match.result;
  const won = result.winnerUserId === account.id;
  const draw = result.winnerUserId === null;
  const mine = result.ratingChanges.find((change) => change.userId === account.id);
  const opponent = match.participants.find((participant) => participant.userId !== account.id) ?? match.participants[1];
  const title = draw ? 'EMPATE.' : won ? 'VITÓRIA.' : 'DERROTA.';
  const browserVerified = result.verification === 'BROWSER_PUBLIC_EXAMPLES';
  const description = result.reason === 'VOID_SYSTEM' ? 'A partida foi anulada por uma falha sistêmica e nenhum rating foi alterado.' : result.reason === 'DRAW_TIMEOUT' ? 'O tempo terminou sem uma solução aceita.' : result.reason === 'FORFEIT' ? 'A partida terminou por desistência.' : browserVerified && won ? 'Seu navegador validou primeiro todos os exemplos públicos. Este resultado casual não é verificado e não altera rating.' : browserVerified ? 'O navegador do rival registrou primeiro a aprovação nos exemplos públicos. Este resultado casual não é verificado e não altera rating.' : won ? 'Sua solução foi a primeira resposta aceita pelo servidor.' : 'Seu rival teve a primeira solução aceita pelo servidor.';

  return <><section className={`result-hero ${draw ? 'draw' : won ? 'won' : 'lost'}`}>{won ? <Trophy size={48} /> : <Code2 size={48} />}<p className="eyebrow">PARTIDA ENCERRADA</p><h1>{title}</h1><p>{description}</p><div className="result-versus"><span><b>{account.username.slice(0,2).toUpperCase()}</b><strong>{account.username}</strong><small>{won ? 'VENCEDOR' : draw ? 'EMPATE' : 'FINALIZADO'}</small></span><i>{draw ? '—' : won ? '1 — 0' : '0 — 1'}</i><span><b>{opponent?.username.slice(0,2).toUpperCase() ?? '??'}</b><strong>{opponent?.username ?? 'rival'}</strong><small>{!won && !draw ? 'VENCEDOR' : 'FINALIZADO'}</small></span></div></section><section className="result-stats"><article><Gauge size={19} /><span><small>RATING</small><strong>{mine ? `${mine.before} → ${mine.after}` : `${account.rating}`}</strong></span><b className={(mine?.delta ?? 0) >= 0 ? 'positive' : 'negative'}>{formatDelta(mine?.delta ?? 0)}</b></article><article><Code2 size={19} /><span><small>SEUS ENVIOS</small><strong>{match.mySubmissions.length} tentativas</strong></span><b>{browserVerified ? 'Wasm não verificado' : match.type === 'RANKED_PUBLIC' ? 'Ranked' : 'Unranked'}</b></article><article><Trophy size={19} /><span><small>DECISÃO</small><strong>{reasonLabel(result.reason)}</strong></span><b>{new Date(result.finishedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</b></article></section><div className="result-actions"><Link className="button primary large" href="/play/queue"><RotateCcw size={18} /> Jogar novamente</Link><Link className="button secondary large" href="/practice"><Code2 size={18} /> Praticar</Link><Link className="text-link" href="/home"><Home size={16} /> Voltar ao início <ArrowRight size={15} /></Link></div><p className="match-id">Partida {id} · resultado baseado na ordem de admissão registrada pelo servidor · {browserVerified ? 'validação Wasm não verificada' : 'veredito autoritativo'}</p></>;
}

async function pollResult(api: ReturnType<typeof createApi>, id: string): Promise<MatchSnapshot> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const snapshot = await api.match(id);
    if (snapshot.status === 'FINISHED' && snapshot.result) return snapshot;
    await new Promise((resolve) => window.setTimeout(resolve, 1_000));
  }
  throw new Error('resultado não confirmado');
}

function demoResult(id: string, userId: string, outcome?: string): MatchSnapshot {
  const won = outcome !== 'forfeit';
  return { ...demoMatch, id, status: 'FINISHED', result: { matchId: id, reason: won ? 'ACCEPTED' : 'FORFEIT', winnerUserId: won ? userId : demoMatch.participants[1]?.userId ?? null, winningSubmissionId: won ? 'sub-3' : null, finishedAt: new Date().toISOString(), verification: won ? 'BROWSER_PUBLIC_EXAMPLES' : 'SERVER_RULE', ratingChanges: [] } };
}

function formatDelta(delta: number): string { return delta > 0 ? `+${delta}` : delta === 0 ? '±0' : `−${Math.abs(delta)}`; }
function reasonLabel(reason: NonNullable<MatchSnapshot['result']>['reason']): string { return ({ ACCEPTED: 'Solução aceita', FORFEIT: 'Desistência', DRAW_TIMEOUT: 'Tempo esgotado', VOID_SYSTEM: 'Partida anulada' })[reason]; }
