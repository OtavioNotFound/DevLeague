import { AppShell } from '../../../components/app-shell';
import { QueuePanel } from '../../../components/queue-panel';

export default function MatchmakingPage() {
  return <AppShell><QueuePanel mode="UNRANKED" /></AppShell>;
}
