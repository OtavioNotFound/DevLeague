'use client';

import { BookOpen, House, LogOut, Settings, Swords, UserRound } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Brand } from './brand';
import { SessionGate, useAccount } from './session-gate';
import { publicConfig } from '../lib/config';

const items = [
  { href: '/home', label: 'Início', icon: House },
  { href: '/practice', label: 'Praticar', icon: BookOpen },
  { href: '/play/queue', label: 'Jogar X1', icon: Swords }
] as const;

export function AppShell({ children, fullWidth = false }: {
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  return <SessionGate><AuthenticatedShell fullWidth={fullWidth}>{children}</AuthenticatedShell></SessionGate>;
}

function AuthenticatedShell({ children, fullWidth = false }: { children: React.ReactNode; fullWidth?: boolean }) {
  const pathname = usePathname();
  const account = useAccount();
  return (
    <div className="app-frame">
      <header className="topbar">
        <Brand />
        <nav className="topnav" aria-label="Navegação principal">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link key={item.href} className={active ? 'nav-link active' : 'nav-link'} href={item.href}>
                <Icon size={17} aria-hidden="true" />{item.label}
              </Link>
            );
          })}
        </nav>
        <div className="account-cluster">
          {publicConfig.demoMode && <span className="demo-flag">DEMO</span>}
          <Link className="icon-link" href="/settings" aria-label="Configurações"><Settings size={18} /></Link>
          <Link className="avatar-link" href={`/@${account.username}`} aria-label="Seu perfil"><UserRound size={18} /></Link>
        </div>
      </header>
      <main className={fullWidth ? 'app-main wide' : 'app-main'}>{children}</main>
      <nav className="mobile-nav" aria-label="Navegação móvel">
        {items.map((item) => {
          const Icon = item.icon;
          return <Link key={item.href} href={item.href}><Icon size={20} /><span>{item.label}</span></Link>;
        })}
      </nav>
    </div>
  );
}

export function SignOutLink() {
  async function signOut() {
    const { getSupabaseBrowserClient } = await import('../lib/auth');
    await getSupabaseBrowserClient()?.auth.signOut();
    window.location.href = '/';
  }
  return <button className="text-link danger-text signout-button" type="button" onClick={() => void signOut()}><LogOut size={16} /> Sair</button>;
}
