'use client';

import { ArrowRight, Check, Eye, LoaderCircle, LockKeyhole, Mail, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Brand } from '../../components/brand';
import { ApiError } from '../../lib/api';
import { createApi, getSupabaseBrowserClient } from '../../lib/auth';
import { publicConfig } from '../../lib/config';
import { firstSignupError, type SignupErrors, validateSignup } from '../../lib/signup';

type Feedback = { kind: 'error' | 'success'; text: string } | null;

function textField(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}

export default function SignupPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<SignupErrors>({});
  const [feedback, setFeedback] = useState<Feedback>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (feedback) feedbackRef.current?.focus();
  }, [feedback]);

  async function finishProfile(username: string) {
    const api = createApi();
    await api.bootstrapUser(username);
    const me = await api.recordConsents();
    window.location.href = me.activeMatchId ? `/matches/${me.activeMatchId}` : '/home';
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const input = {
      email: textField(form, 'email').trim(),
      username: textField(form, 'username').trim(),
      password: textField(form, 'password'),
      passwordConfirmation: textField(form, 'passwordConfirmation'),
      over18: form.get('over18') === 'on',
      terms: form.get('terms') === 'on'
    };
    const validationErrors = validateSignup(input);
    setErrors(validationErrors);
    setFeedback(null);
    const firstError = firstSignupError(validationErrors);
    if (firstError) {
      document.getElementById(firstError)?.focus();
      return;
    }

    setLoading(true);
    try {
      if (publicConfig.demoMode) {
        await finishProfile(input.username);
        return;
      }
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        setFeedback({ kind: 'error', text: 'A autenticação ainda não foi configurada neste ambiente.' });
        return;
      }

      const currentSession = await supabase.auth.getSession();
      if (currentSession.data.session) {
        const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
        if (signOutError) {
          setFeedback({ kind: 'error', text: 'NÃ£o foi possÃ­vel encerrar a conta atual. Saia da conta e tente novamente.' });
          return;
        }
      }

      const { data, error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          emailRedirectTo: `${window.location.origin}/onboarding`,
          data: { desired_username: input.username }
        }
      });
      if (error) {
        setFeedback({ kind: 'error', text: 'Não foi possível criar a conta. Tente entrar ou recuperar o acesso.' });
        return;
      }
      if (!data.session) {
        setFeedback({ kind: 'success', text: 'Confira seu e-mail para confirmar a conta. Depois, concluiremos seu perfil e os aceites com uma sessão válida.' });
        formElement.reset();
        return;
      }
      await finishProfile(input.username);
    } catch (error: unknown) {
      if (error instanceof ApiError && error.code === 'USERNAME_TAKEN') {
        setErrors({ username: 'Esse nome de usuário já está em uso. Escolha outro.' });
        document.getElementById('username')?.focus();
      } else if (error instanceof ApiError && error.code === 'CONSENT_VERSION_MISMATCH') {
        setFeedback({ kind: 'error', text: 'Os documentos foram atualizados. Recarregue a página antes de aceitar.' });
      } else {
        setFeedback({ kind: 'error', text: 'Não foi possível concluir o cadastro agora. Tente novamente.' });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page signup-page">
      <div className="auth-brand"><Brand /></div>
      <section className="auth-panel">
        <p className="eyebrow">ALPHA FECHADA · 18+</p>
        <h1>CRIE SUA CONTA.</h1>
        <p>Seu rating começa em 0. Vença partidas ranqueadas para conquistar pontos.</p>
        <form className="form-grid" noValidate onSubmit={(event) => void submit(event)}>
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <div className="input-icon"><Mail size={17} /><input id="email" name="email" type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'email-error' : undefined} required /></div>
            {errors.email && <small className="field-error" id="email-error">{errors.email}</small>}
          </div>
          <div className="field">
            <label htmlFor="username">Nome de usuário</label>
            <div className="input-icon"><UserRound size={17} /><input id="username" name="username" autoComplete="username" maxLength={24} aria-invalid={Boolean(errors.username)} aria-describedby={errors.username ? 'username-error' : 'username-help'} required /></div>
            {errors.username ? <small className="field-error" id="username-error">{errors.username}</small> : <small id="username-help">3–24 letras, números ou underscore. Será público.</small>}
          </div>
          <div className="field">
            <label htmlFor="password">Senha</label>
            <div className="input-icon"><LockKeyhole size={17} /><input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8} aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'password-error' : 'password-help'} required /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}><Eye size={17} /></button></div>
            {errors.password ? <small className="field-error" id="password-error">{errors.password}</small> : <small id="password-help">Use pelo menos 8 caracteres.</small>}
          </div>
          <div className="field">
            <label htmlFor="passwordConfirmation">Confirme a senha</label>
            <div className="input-icon"><LockKeyhole size={17} /><input id="passwordConfirmation" name="passwordConfirmation" type={showPassword ? 'text' : 'password'} autoComplete="new-password" aria-invalid={Boolean(errors.passwordConfirmation)} aria-describedby={errors.passwordConfirmation ? 'passwordConfirmation-error' : undefined} required /></div>
            {errors.passwordConfirmation && <small className="field-error" id="passwordConfirmation-error">{errors.passwordConfirmation}</small>}
          </div>
          <div className="signup-consents">
            <label className="checkbox-row"><input id="over18" name="over18" type="checkbox" aria-invalid={Boolean(errors.over18)} aria-describedby={errors.over18 ? 'over18-error' : undefined} /><span><strong>Tenho 18 anos ou mais</strong><small>A alpha não pede documento ou biometria.</small></span></label>
            {errors.over18 && <small className="field-error" id="over18-error">{errors.over18}</small>}
            <label className="checkbox-row"><input id="terms" name="terms" type="checkbox" aria-invalid={Boolean(errors.terms)} aria-describedby={errors.terms ? 'terms-error' : undefined} /><span>Li e aceito os <Link href="/terms" target="_blank" rel="noreferrer">Termos</Link> e o <Link href="/privacy" target="_blank" rel="noreferrer">Aviso de Privacidade</Link> <small>Versões {publicConfig.termsVersion} e {publicConfig.privacyVersion}.</small></span></label>
            {errors.terms && <small className="field-error" id="terms-error">{errors.terms}</small>}
          </div>
          {feedback && <div ref={feedbackRef} tabIndex={-1} className={`form-message ${feedback.kind === 'success' ? 'success' : ''}`} role={feedback.kind === 'error' ? 'alert' : 'status'}>{feedback.kind === 'success' && <Check size={17} />}<span>{feedback.text}</span></div>}
          <button className="button primary large" disabled={loading || feedback?.kind === 'success'}>{loading ? <><LoaderCircle className="spin" size={18} /> Criando conta…</> : <>Criar conta <ArrowRight size={18} /></>}</button>
        </form>
        <p className="auth-switch">Já tem conta? <Link href="/login">Entrar</Link></p>
      </section>
      <aside className="auth-aside"><span>00</span><blockquote>Uma conta. Um problema. Seu próximo rival.</blockquote><p>Cadastro simples, competição transparente e nenhum pay-to-win.</p></aside>
    </main>
  );
}
