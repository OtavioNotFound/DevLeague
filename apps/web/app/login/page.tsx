'use client';

import { ArrowRight, Eye, LockKeyhole, Mail } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Brand } from '../../components/brand';
import { ApiError } from '../../lib/api';
import { createApi, getSupabaseBrowserClient, setRememberSession } from '../../lib/auth';
import { publicConfig } from '../../lib/config';

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (publicConfig.demoMode) { window.location.href = '/home'; return; }
    const form = new FormData(event.currentTarget);
    const email = form.get('email');
    const password = form.get('password');
    const remember = form.get('remember') === 'on';
    if (typeof email !== 'string' || typeof password !== 'string') {
      setMessage('Preencha e-mail e senha para continuar.');
      return;
    }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setMessage('Autenticação ainda não configurada.'); return; }
    setRememberSession(remember);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email, password
    });
    setLoading(false);
    if (error) setMessage('Não foi possível entrar. Confira seus dados e tente novamente.');
    else {
      try {
        const me = await createApi().me();
        window.location.href = me.eligibility.eligible ? (me.activeMatchId ? `/matches/${me.activeMatchId}` : '/home') : '/onboarding';
      } catch (apiError: unknown) {
        window.location.href = apiError instanceof ApiError && apiError.code === 'USER_NOT_BOOTSTRAPPED' ? '/onboarding' : '/home';
      }
    }
  }

  return <main className="auth-page"><div className="auth-brand"><Brand /></div><section className="auth-panel"><p className="eyebrow">BEM-VINDO DE VOLTA</p><h1>ENTRE NA ARENA.</h1><p>Continue praticando ou encontre seu próximo rival.</p><form className="form-grid" onSubmit={(event) => void submit(event)}>
    <div className="field"><label htmlFor="email">E-mail</label><div className="input-icon"><Mail size={17} /><input id="email" name="email" type="email" autoComplete="email" placeholder="voce@email.com" required /></div></div>
    <div className="field"><label htmlFor="password">Senha</label><div className="input-icon"><LockKeyhole size={17} /><input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}><Eye size={17} /></button></div></div>
    <div className="auth-meta"><label className="checkbox-row"><input name="remember" type="checkbox" defaultChecked /> Manter conectado</label><Link href="/forgot-password">Esqueci minha senha</Link></div>
    {message && <p className="form-message" role="alert">{message}</p>}
    <button className="button primary large" disabled={loading}>{loading ? 'Entrando…' : <>Entrar <ArrowRight size={18} /></>}</button>
  </form><p className="auth-switch">Ainda não tem conta? <Link href="/signup">Começar agora</Link></p></section><aside className="auth-aside"><span>01</span><blockquote>“A melhor forma de descobrir onde você trava é resolver sob pressão justa.”</blockquote><p>Uma partida. Um problema. Sem distrações.</p></aside></main>;
}
