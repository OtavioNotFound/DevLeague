import { AppShell } from '../../components/app-shell';
import { PracticeCatalog } from '../../components/practice-catalog';
import { PageHeader } from '../../components/ui';

export default function PracticePage() {
  return (
    <AppShell>
      <PageHeader eyebrow="LABORATÓRIO" title="Pratique sem pressão." description="Resolva no seu ritmo. Treinos nunca alteram seu rating e permitem testar casos antes de enviar." />
      <PracticeCatalog />
    </AppShell>
  );
}
