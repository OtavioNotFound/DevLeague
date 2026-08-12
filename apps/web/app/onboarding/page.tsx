'use client';

import { ArrowRight, Check, Code2, LoaderCircle, Scale, ShieldCheck, Swords } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Brand } from '../../components/brand';
import { ApiError } from '../../lib/api';
import { createApi, getSupabaseBrowserClient } from '../../lib/auth';
import { publicConfig } from '../../lib/config';

export default function OnboardingPage() {
  const [username, setUsername] = useState('');
  const [over18, setOver18] = useState(false);
  const [terms, setTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const api = useMemo(() => createApi(), []);

  useEffect(() => {
    if (publicConfig.demoMode) return;
    void getSupabaseBrowserClient()?.auth.getUser().then(({ data }) => {
      const metadata: unknown = data.user?.user_metadata;
      const desiredUsername = typeof metadata === 'object' && metadata !== null && 'desired_username' in metadata
        ? metadata.desired_username
        : undefined;
      if (typeof desiredUsername === 'string' && /^[A-Za-z0-9_]{3,24}$/.test(desiredUsername)) {
        setUsername((current) => current || desiredUsername);
      }
    });
  }, []);

  async function complete() {
    if (!over18 || !terms || !/^[A-Za-z0-9_]{3,24}$/.test(username)) return;
    setLoading(true);
    setMessage('');
    try {
      if (!publicConfig.demoMode) {
        const session = await getSupabaseBrowserClient()?.auth.getSession();
        if (!session?.data.session) { window.location.href = '/login'; return; }
      }
      await api.bootstrapUser(username);
      const me = await api.recordConsents();
      window.location.href = me.activeMatchId ? `/matches/${me.activeMatchId}` : '/home';
    } catch (error: unknown) {
      if (error instanceof ApiError && error.code === 'USERNAME_TAKEN') setMessage('Esse nome de usuário já está em uso.');
      else if (error instanceof ApiError && error.code === 'CONSENT_VERSION_MISMATCH') setMessage('Os documentos foram atualizados. Recarregue a página antes de aceitar.');
      else setMessage('Não foi possível concluir o cadastro agora. Tente novamente.');
      setLoading(false);
    }
  }

  const validUsername = /^[A-Za-z0-9_]{3,24}$/.test(username);
  return (
    <main className="onboarding-page">
      <header><Brand /><span>ALPHA FECHADA · ETAPA ÚNICA</span></header>
      <div className="onboarding-grid">
        <section>
          <p className="eyebrow">ANTES DO PRIMEIRO X1</p><h1>COMPETIÇÃO<br />COMBINADA.</h1>
          <p className="onboarding-lead">A DevLeague mede resolução de problemas em partidas curtas. Não é prova profissional, certificação ou aposta.</p>
          <div className="principle-list"><div><Swords /><span><strong>Ranked é público</strong><small>Só partidas do matchmaking alteram rating.</small></span></div><div><Scale /><span><strong>Privado é sem rating</strong><small>Desafie amigos sem arriscar pontuação.</small></span></div><div><ShieldCheck /><span><strong>Fair play</strong><small>Sem LLM ou ajuda externa durante o X1.</small></span></div><div><Code2 /><span><strong>Sua linguagem</strong><small>Python, Java, JavaScript ou C++.</small></span></div></div>
        </section>
        <section className="consent-card">
          <span className="consent-step">IDENTIDADE E CONSENTIMENTO</span><h2>Confirme para continuar</h2><p>Na alpha, reduzimos o escopo jurídico enquanto validamos o X1.</p>
          <div className="field"><label htmlFor="username">Nome de usuário</label><input id="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="seu_username" autoComplete="username" maxLength={24} /><small>3–24 letras, números ou underscore. Será público.</small></div>
          <div className="consent-options"><label className={over18 ? 'consent-option checked' : 'consent-option'}><input type="checkbox" checked={over18} onChange={(event) => setOver18(event.target.checked)} /><span className="check-box">{over18 && <Check />}</span><span><strong>Tenho 18 anos ou mais</strong><small>Não pediremos documento ou biometria.</small></span></label><label className={terms ? 'consent-option checked' : 'consent-option'}><input type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} /><span className="check-box">{terms && <Check />}</span><span><strong>Aceito os Termos e a Privacidade</strong><small>Versões {publicConfig.termsVersion}. Você poderá consultar depois.</small></span></label></div>
          {message && <p className="form-message" role="alert">{message}</p>}
          <button className="button primary large" disabled={!over18 || !terms || !validUsername || loading} onClick={() => void complete()}>{loading ? <><LoaderCircle className="spin" size={18} /> Preparando conta…</> : <>Continuar <ArrowRight size={18} /></>}</button>
          <p className="consent-note">A DevLeague não é um produto permanentemente 18+. Esta restrição vale apenas para a alpha fechada.</p>
        </section>
      </div>
    </main>
  );
}
