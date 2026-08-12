'use client';

import { ArrowLeft, Check, LoaderCircle, Mail } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Brand } from '../../components/brand';
import { getSupabaseBrowserClient } from '../../lib/auth';
import { publicConfig } from '../../lib/config';
import { validateRecoveryEmail } from '../../lib/password-recovery';

type Feedback = { kind: 'error' | 'success'; text: string } | null;

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [feedback, setFeedback] = useState<Feedback>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (feedback) feedbackRef.current?.focus();
  }, [feedback]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = form.get('email');
    const email = typeof value === 'string' ? value.trim() : '';
    const validationError = validateRecoveryEmail(email);
    setEmailError(validationError ?? '');
    setFeedback(null);
    if (validationError) {
      document.getElementById('email')?.focus();
      return;
    }

    setLoading(true);
    try {
      if (!publicConfig.demoMode) {
        const supabase = getSupabaseBrowserClient();
        if (!supabase) {
          setFeedback({ kind: 'error', text: 'A autenticação ainda não foi configurada neste ambiente.' });
          return;
        }
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`
        });
        if (error) {
          setFeedback(error.status === 429
            ? { kind: 'error', text: 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.' }
            : { kind: 'error', text: 'Não foi possível enviar as instruções agora. Verifique sua conexão e tente novamente.' });
          return;
        }
      }
      setFeedback({
        kind: 'success',
        text: 'Se houver uma conta com esse e-mail, as instruções de recuperação serão enviadas.'
      });
    } catch {
      setFeedback({ kind: 'error', text: 'Não foi possível conectar ao serviço de autenticação. Tente novamente.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-brand"><Brand /></div>
      <section className="auth-panel">
        <p className="eyebrow">RECUPERAÇÃO</p>
        <h1>VOLTE AO JOGO.</h1>
        <p>Informe seu e-mail. Se a conta existir, enviaremos as instruções de recuperação.</p>
        <form className="form-grid" noValidate onSubmit={(event) => void submit(event)}>
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <div className="input-icon"><Mail size={17} /><input id="email" name="email" type="email" autoComplete="email" placeholder="voce@email.com" aria-invalid={Boolean(emailError)} aria-describedby={emailError ? 'email-error' : undefined} required /></div>
            {emailError && <small className="field-error" id="email-error">{emailError}</small>}
          </div>
          {feedback && <div ref={feedbackRef} tabIndex={-1} className={`form-message ${feedback.kind === 'success' ? 'success' : ''}`} role={feedback.kind === 'error' ? 'alert' : 'status'}>{feedback.kind === 'success' && <Check size={17} />}<span>{feedback.text}</span></div>}
          <button className="button primary large" disabled={loading}>{loading ? <><LoaderCircle className="spin" size={18} /> Enviando…</> : 'Enviar instruções'}</button>
        </form>
        <p className="auth-switch"><Link href="/login"><ArrowLeft size={14} /> Voltar para o login</Link></p>
      </section>
      <aside className="auth-aside"><span>02</span><blockquote>Seu progresso continua aqui quando você voltar.</blockquote><p>Recupere o acesso sem perder histórico ou rating.</p></aside>
    </main>
  );
}
