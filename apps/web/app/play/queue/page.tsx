import { AppShell } from '../../../components/app-shell';
import { QueuePanel } from '../../../components/queue-panel';

export default async function MatchmakingPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const mode = (await searchParams).mode === 'unranked' ? 'UNRANKED' : 'RANKED';
  return <AppShell><QueuePanel mode={mode} /></AppShell>;
}
