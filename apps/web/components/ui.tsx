import { AlertTriangle, ArrowRight, Check, Clock3, WifiOff } from 'lucide-react';
import Link from 'next/link';
import type { Difficulty, SubmissionVerdict } from '@devleague/contracts';

export function PageHeader({ eyebrow, title, description, action }: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-header">
      <div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p>{description}</p>}</div>
      {action && <div className="page-header-action">{action}</div>}
    </div>
  );
}

export function DifficultyBadge({ value }: { value: Difficulty }) {
  const label = value === 'EASY' ? 'Fácil' : value === 'MEDIUM' ? 'Médio' : 'Difícil';
  return <span className={`difficulty ${value.toLowerCase()}`}>{label}</span>;
}

export function VerdictBadge({ verdict }: { verdict: SubmissionVerdict }) {
  const labels: Record<SubmissionVerdict, string> = {
    ACCEPTED: 'Aceito', WRONG_ANSWER: 'Resposta incorreta', COMPILE_ERROR: 'Erro de compilação',
    RUNTIME_ERROR: 'Erro em execução', TIME_LIMIT_EXCEEDED: 'Tempo excedido',
    MEMORY_LIMIT_EXCEEDED: 'Memória excedida', OUTPUT_LIMIT_EXCEEDED: 'Saída excedida',
    SYSTEM_ERROR: 'Falha no avaliador', CANCELLED: 'Cancelada'
  };
  return <span className={`verdict verdict-${verdict.toLowerCase()}`}>{verdict === 'ACCEPTED' ? <Check size={13} /> : null}{labels[verdict]}</span>;
}

export function InlineAlert({ tone = 'warning', children }: {
  tone?: 'warning' | 'danger' | 'offline'; children: React.ReactNode;
}) {
  const Icon = tone === 'offline' ? WifiOff : AlertTriangle;
  return <div className={`inline-alert ${tone}`} role="status"><Icon size={18} /><span>{children}</span></div>;
}

export function EmptyState({ title, description, href, action }: {
  title: string; description: string; href?: string; action?: string;
}) {
  return (
    <div className="empty-state"><Clock3 size={28} /><h2>{title}</h2><p>{description}</p>
      {href && action && <Link className="button secondary" href={href}>{action}<ArrowRight size={16} /></Link>}
    </div>
  );
}
