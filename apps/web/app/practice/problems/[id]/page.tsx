import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { AppShell } from '../../../../components/app-shell';
import { PracticeProblemLoader } from '../../../../components/practice-problem-loader';

export default async function PracticeProblemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AppShell fullWidth>
      <div className="workspace-topline"><Link className="text-link" href="/practice"><ArrowLeft size={16} /> Catálogo</Link><span className="tag">TREINO · SEM RATING</span></div>
      <PracticeProblemLoader id={id} />
    </AppShell>
  );
}
