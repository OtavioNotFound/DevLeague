'use client';

import { ArrowRight, Check, Eye, LoaderCircle, LockKeyhole } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Brand } from '../../components/brand';
import { getSupabaseBrowserClient } from '../../lib/auth';
import { publicConfig } from '../../lib/config';
import { type PasswordErrors, validateNewPassword } from '../../lib/password-recovery';

type RecoveryState = 'checking' | 'ready' | 'invalid' | 'success';

export default function ResetPasswordPage() {
  const [state, setState] = useState<RecoveryState>(publicConfig.demoMode ? 'ready' : 'checking');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<PasswordErrors>({});
  const [message, setMessage] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (publicConfig.demoMode) return;
    let active = true;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setMessage('A autenticação ainda não foi configurada neste ambiente.');
      setState('invalid');
      return;
    }
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (active && (event === 'PASSWORD_RECOVERY' || session)) setState('ready');
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setState(data.session ? 'ready' : 'invalid');
      if (!data.session) setMessage('Este link de recuperação é inválido ou expirou.');
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (state !== 'checking') headingRef.current?.focus();
  }, [state]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const passwordValue = form.get('password');
    const confirmationValue = form.get('passwordConfirmation');
    const password = typeof passwordValue === 'string' ? passwordValue : '';
    const passwordConfirmation = typeof confirmationValue === 'string' ? confirmationValue : '';
    const validationErrors = validateNewPassword(password, passwordConfirmation);
    setErrors(validationErrors);
    setMessage('');
    if (validationErrors.password) {
      document.getElementById('password')?.focus();
      return;
    }
    if (validationErrors.passwordConfirmation) {
      document.getElementById('passwordConfirmation')?.focus();
      return;
    }

    setLoading(true);
    try {
      if (!publicConfig.demoMode) {
        const supabase = getSupabaseBrowserClient();
        if (!supabase) {
          setMessage('A autenticação ainda não foi configurada neste ambiente.');
          return;
        }
        const { error } = await supabase.auth.updateUser({ password });
        if (error) {
          setMessage(error.status === 429
            ? 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.'
            : 'Não foi possível atualizar a senha. Use outra senha ou solicite um novo link.');
          return;
        }
        await supabase.auth.signOut();
      }
      setState('success');
    } catch {
      setMessage('Não foi possível conectar ao serviço de autenticação. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-brand"><Brand /></div>
      <section className="auth-panel">
        {state === 'checking' && <div className="auth-state" role="status"><LoaderCircle className="spin" /><h1>VALIDANDO LINK.</h1><p>Aguarde enquanto confirmamos sua recuperação.</p></div>}
        {state === 'invalid' && <div className="auth-state"><p className="eyebrow">LINK INDISPONÍVEL</p><h1 ref={headingRef} tabIndex={-1}>SOLICITE DE NOVO.</h1><p>{message}</p><Link className="button primary large" href="/forgot-password">Enviar novo link <ArrowRight size={18} /></Link></div>}
        {state === 'success' && <div className="auth-state success"><Check size={34} /><p className="eyebrow">SENHA ATUALIZADA</p><h1 ref={headingRef} tabIndex={-1}>ACESSO RECUPERADO.</h1><p>Sua nova senha já pode ser usada para entrar.</p><Link className="button primary large" href="/login">Ir para o login <ArrowRight size={18} /></Link></div>}
        {state === 'ready' && <>
          <p className="eyebrow">NOVA SENHA</p>
          <h1 ref={headingRef} tabIndex={-1}>PROTEJA SUA CONTA.</h1>
          <p>Defina uma nova senha para voltar à arena.</p>
          <form className="form-grid" noValidate onSubmit={(event) => void submit(event)}>
            <div className="field"><label htmlFor="password">Nova senha</label><div className="input-icon"><LockKeyhole size={17} /><input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8} aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'password-error' : 'password-help'} required /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}><Eye size={17} /></button></div>{errors.password ? <small className="field-error" id="password-error">{errors.password}</small> : <small id="password-help">Use pelo menos 8 caracteres.</small>}</div>
            <div className="field"><label htmlFor="passwordConfirmation">Confirme a nova senha</label><div className="input-icon"><LockKeyhole size={17} /><input id="passwordConfirmation" name="passwordConfirmation" type={showPassword ? 'text' : 'password'} autoComplete="new-password" aria-invalid={Boolean(errors.passwordConfirmation)} aria-describedby={errors.passwordConfirmation ? 'passwordConfirmation-error' : undefined} required /></div>{errors.passwordConfirmation && <small className="field-error" id="passwordConfirmation-error">{errors.passwordConfirmation}</small>}</div>
            {message && <div className="form-message" role="alert"><span>{message}</span></div>}
            <button className="button primary large" disabled={loading}>{loading ? <><LoaderCircle className="spin" size={18} /> Atualizando…</> : 'Atualizar senha'}</button>
          </form>
        </>}
      </section>
      <aside className="auth-aside"><span>03</span><blockquote>Segurança também faz parte do jogo.</blockquote><p>O link é temporário e sua sessão de recuperação termina depois da troca.</p></aside>
    </main>
  );
}
