import { AppShell } from '../../../components/app-shell';
import { MatchLoader } from '../../../components/match-loader';

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AppShell fullWidth><MatchLoader id={id} /></AppShell>;
}
