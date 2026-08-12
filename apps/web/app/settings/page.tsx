import { Bell, KeyRound, ShieldCheck, UserRound } from 'lucide-react';
import { AppShell, SignOutLink } from '../../components/app-shell';
import { PageHeader } from '../../components/ui';
import { demoMe } from '../../lib/demo-data';

export default function SettingsPage() {
  return (
    <AppShell>
      <PageHeader eyebrow="CONTA" title="Configurações" description="Preferências essenciais da sua participação na alpha fechada." />
      <div className="settings-layout">
        <nav className="settings-nav"><a href="#profile"><UserRound size={16} /> Perfil</a><a href="#notifications"><Bell size={16} /> Notificações</a><a href="#security"><KeyRound size={16} /> Segurança</a></nav>
        <div className="settings-content">
          <section id="profile" className="card"><h2>Perfil público</h2><p>Seu nome de usuário aparece no matchmaking, nas partidas e no histórico.</p><div className="field"><label htmlFor="username">Nome de usuário</label><input id="username" defaultValue={demoMe.username} /></div><button className="button primary" type="button">Salvar perfil</button></section>
          <section id="notifications" className="card"><h2>Notificações</h2><p>Controle os avisos úteis durante a alpha.</p><label className="setting-toggle"><span><strong>Som ao encontrar rival</strong><small>Reproduz um alerta curto quando a partida estiver pronta.</small></span><input type="checkbox" defaultChecked /></label><label className="setting-toggle"><span><strong>Resumo de resultado</strong><small>Mostra o impacto no rating após a partida.</small></span><input type="checkbox" defaultChecked /></label></section>
          <section id="security" className="card"><h2>Privacidade e segurança</h2><div className="consent-record"><ShieldCheck size={20} /><span><strong>Consentimentos da alpha registrados</strong><small>18+ confirmado · Termos v0.1-alpha · Privacidade v0.1-alpha</small></span></div><p>A alpha não pede documento nem biometria para confirmar idade.</p><SignOutLink /></section>
        </div>
      </div>
    </AppShell>
  );
}
