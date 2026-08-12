import { notFound } from 'next/navigation';
import { AppShell } from '../../components/app-shell';
import { PublicProfile } from '../../components/public-profile';

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const rawUsername = (await params).username;
  const username = decodeURIComponent(rawUsername);
  if (!username.startsWith('@')) notFound();
  return <AppShell><PublicProfile username={username.slice(1)} /></AppShell>;
}
