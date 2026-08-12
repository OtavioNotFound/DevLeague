import { ArrowRight, Braces, CheckCircle2, ShieldCheck, Swords, TimerReset, Trophy } from 'lucide-react';
import Link from 'next/link';
import { Brand } from '../components/brand';

export default function LandingPage() {
  return (
    <div className="landing">
      <header className="landing-nav"><Brand /><nav><Link href="#como-funciona">Como funciona</Link><Link href="/practice">Praticar</Link><Link className="button secondary" href="/login">Entrar</Link></nav></header>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">COMPITA. RESOLVA. EVOLUA.</p>
            <h1>PROGRAMAÇÃO<br />É MELHOR <span>NO X1.</span></h1>
            <p className="hero-lead">Um problema. Dois devs. Dez minutos. Vença com lógica, não com sorte.</p>
            <div className="hero-actions"><Link className="button primary large" href="/signup">Começar agora <ArrowRight size={19} /></Link><Link className="button ghost large" href="/practice">Explorar problemas</Link></div>
            <div className="language-strip"><span>PYTHON</span><span>JAVA</span><span>JAVASCRIPT</span><span>C++</span></div>
          </div>
          <div className="duel-visual" aria-label="Demonstração de uma partida em andamento">
            <div className="duel-top"><span className="live-dot">AO VIVO</span><span className="duel-clock">06:42</span><span className="tag ranked">RANQUEADA</span></div>
            <div className="duel-players"><div><span className="player-avatar blue">OT</span><strong>otaviocode</strong><small>1248</small></div><span className="versus">VS</span><div><span className="player-avatar purple">BB</span><strong>bytebruna</strong><small>1261</small></div></div>
            <div className="code-preview"><div className="code-tabs"><span>main.py</span><span>Python 3.13</span></div><pre><code><i>1</i> n = int(input()){`\n`}<i>2</i> values = list(map(int, input().split())){`\n`}<i>3</i>{`\n`}<i>4</i> <b>for</b> i <b>in</b> range(n - 1, -1, -1):{`\n`}<i>5</i>   print(values[i], end=<em>&apos; &apos;</em>)</code></pre></div>
            <div className="duel-status"><CheckCircle2 size={17} /><span>2/4 casos passaram</span><span className="status-line"><i /></span></div>
          </div>
        </section>
        <section className="proof-bar"><div><strong>10 min</strong><span>por partida</span></div><div><strong>4</strong><span>linguagens</span></div><div><strong>100%</strong><span>foco em lógica</span></div><div><strong>0</strong><span>pay-to-win</span></div></section>
        <section id="como-funciona" className="how-section"><p className="eyebrow">O LOOP CENTRAL</p><h2>DA FILA AO VEREDITO.</h2><div className="how-grid">
          <article><span>01</span><Swords /><h3>Encontre um rival</h3><p>Matchmaking por rating encontra alguém no seu nível.</p></article>
          <article><span>02</span><TimerReset /><h3>Resolva no tempo</h3><p>Mesmo problema, linguagens independentes e relógio justo.</p></article>
          <article><span>03</span><Trophy /><h3>Suba no rating</h3><p>A primeira solução correta admitida pelo servidor vence.</p></article>
        </div></section>
        <section className="trust-section"><div><p className="eyebrow">COMPETIÇÃO SEM ATALHOS</p><h2>O CÓDIGO FALA.<br />O SERVIDOR DECIDE.</h2></div><div className="trust-list"><p><ShieldCheck /> Execução isolada e sem acesso à rede</p><p><Braces /> Mesmo problema e limites para os dois lados</p><p><CheckCircle2 /> Partidas privadas nunca mexem no rating</p></div></section>
        <section className="final-cta"><Swords size={38} /><h2>PRONTO PARA O PRIMEIRO X1?</h2><p>A alpha fechada é temporariamente restrita a participantes 18+.</p><Link className="button primary large" href="/signup">Entrar na arena <ArrowRight size={19} /></Link></section>
      </main>
      <footer className="landing-footer"><Brand /><p>DevLeague é um codinome provisório.</p><div><Link href="/terms">Termos</Link><Link href="/privacy">Privacidade</Link></div></footer>
    </div>
  );
}
