import Link from 'next/link';
import { Brand } from '../../../components/brand';
import { DemoX1 } from '../../../components/demo-x1';

export default function DemoX1Page() {
  return (
    <div className="app-frame">
      <header className="topbar demo-topbar"><Brand href="/" /><strong>X1 de demonstração</strong><Link className="button secondary" href="/demo">Treino livre</Link></header>
      <main className="app-main wide"><DemoX1 /></main>
    </div>
  );
}
