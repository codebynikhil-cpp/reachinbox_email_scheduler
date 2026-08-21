import type { EmailStatus } from '@/types/api';

type BadgeVariant = 'scheduled' | 'processing' | 'sent' | 'failed' | 'default';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  scheduled: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/25',
  processing: 'bg-blue-500/15 text-blue-300 border border-blue-500/25',
  sent: 'bg-green-500/15 text-green-300 border border-green-500/25',
  failed: 'bg-red-500/15 text-red-300 border border-red-500/25',
  default: 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border-default)]',
};

const dotColors: Record<BadgeVariant, string> = {
  scheduled: 'bg-indigo-400',
  processing: 'bg-blue-400 animate-pulse',
  sent: 'bg-green-400',
  failed: 'bg-red-400',
  default: 'bg-[var(--text-muted)]',
};

export function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium',
        variantStyles[variant],
        className,
      ].join(' ')}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} aria-hidden="true" />
      {children}
    </span>
  );
}

/**
 * Maps an EmailStatus string to a Badge variant
 */
export function statusToBadgeVariant(status: EmailStatus | string): BadgeVariant {
  switch (status) {
    case 'SCHEDULED': return 'scheduled';
    case 'PROCESSING': return 'processing';
    case 'SENT': return 'sent';
    case 'FAILED': return 'failed';
    default: return 'default';
  }
}
