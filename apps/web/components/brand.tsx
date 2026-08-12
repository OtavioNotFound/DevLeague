import Link from 'next/link';

export function Brand({ compact = false, href }: { compact?: boolean; href?: string }) {
  return (
    <Link className="brand" href={href ?? (compact ? '/home' : '/')} aria-label="DevLeague — início">
      <span className="brand-mark" aria-hidden="true"><span>D</span><span>L</span></span>
      {!compact && <span className="brand-name">DEV<span>LEAGUE</span></span>}
    </Link>
  );
}
