import { ArrowLeft, Mail } from 'lucide-react';
import Link from 'next/link';
import { Brand } from '../../components/brand';

export default function ForgotPasswordPage() {
  return <main className="auth-page"><div className="auth-brand"><Brand /></div><section className="auth-panel"><p className="eyebrow">RECUPERAÇÃO</p><h1>VOLTE AO JOGO.</h1><p>Informe seu e-mail. Se a conta existir, enviaremos as instruções de recuperação.</p><form className="form-grid"><div className="field"><label htmlFor="email">E-mail</label><div className="input-icon"><Mail size={17} /><input id="email" type="email" placeholder="voce@email.com" required /></div></div><button className="button primary large">Enviar instruções</button></form><p className="auth-switch"><Link href="/login"><ArrowLeft size={14} /> Voltar para o login</Link></p></section><aside className="auth-aside"><span>02</span><blockquote>Seu progresso continua aqui quando você voltar.</blockquote><p>Recupere o acesso sem perder histórico ou rating.</p></aside></main>;
}
