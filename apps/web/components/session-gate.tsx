'use client';

import type { MeResponse } from '@devleague/contracts';
import { LoaderCircle } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ApiError } from '../lib/api';
import { createApi, getSupabaseBrowserClient } from '../lib/auth';
import { publicConfig } from '../lib/config';
import { demoMe } from '../lib/demo-data';

const AccountContext = createContext<MeResponse>(demoMe);

export function useAccount(): MeResponse {
  return useContext(AccountContext);
}

export function SessionGate({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<MeResponse | null>(publicConfig.demoMode ? demoMe : null);
  const [failure, setFailure] = useState('');
  const router = useRouter();
  const pathname = usePathname();
  const api = useMemo(() => createApi(), []);

  useEffect(() => {
    if (publicConfig.demoMode) return;
    let active = true;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setFailure('A autenticação ainda não foi configurada neste ambiente.');
      return;
    }
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      if (!data.session) { router.replace('/login'); return; }
      try {
        const me = await api.me();
        if (!active) return;
        if (!me.eligibility.eligible) { router.replace('/onboarding'); return; }
        if (me.activeMatchId && pathname === '/play/queue') {
          router.replace(`/matches/${me.activeMatchId}`);
          return;
        }
        setAccount(me);
      } catch (error: unknown) {
        if (error instanceof ApiError && error.code === 'USER_NOT_BOOTSTRAPPED') {
          router.replace('/onboarding');
          return;
        }
        if (error instanceof ApiError && error.status === 401) { router.replace('/login'); return; }
        setFailure('Não foi possível validar sua sessão. Tente novamente.');
      }
    });
    return () => { active = false; };
  }, [api, pathname, router]);

  if (failure) return <div className="session-state"><strong>Sessão indisponível</strong><p>{failure}</p><button className="button secondary" onClick={() => window.location.reload()}>Tentar novamente</button></div>;
  if (!account) return <div className="session-state"><LoaderCircle className="spin" /><strong>Preparando sua arena…</strong></div>;
  return <AccountContext.Provider value={account}>{children}</AccountContext.Provider>;
}
