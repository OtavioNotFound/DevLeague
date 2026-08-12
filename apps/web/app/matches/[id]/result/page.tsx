import { AppShell } from '../../../../components/app-shell';
import { MatchResultLoader } from '../../../../components/match-result-loader';

export default async function MatchResultPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ outcome?: string }> }) {
  const { id } = await params;
  const { outcome } = await searchParams;
  return <AppShell><MatchResultLoader id={id} {...(outcome ? { demoOutcome: outcome } : {})} /></AppShell>;
}
