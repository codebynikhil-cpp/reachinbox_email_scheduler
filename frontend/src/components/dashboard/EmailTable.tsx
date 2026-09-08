import { Badge, statusToBadgeVariant } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDateTime } from '@/utils/date';
import type { ScheduledEmail, SentEmail } from '@/types/api';

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr>
      <td className="px-4 py-3.5"><div className="skeleton h-4 w-40 rounded" /></td>
      <td className="px-4 py-3.5"><div className="skeleton h-4 w-32 rounded" /></td>
      <td className="px-4 py-3.5"><div className="skeleton h-4 w-28 rounded" /></td>
      <td className="px-4 py-3.5"><div className="skeleton h-5 w-20 rounded-full" /></td>
    </tr>
  );
}

// ─── Error row ────────────────────────────────────────────────────────────────

interface ErrorRowProps {
  message: string;
  colSpan?: number;
  onRetry?: () => void;
}

export function ErrorRow({ message, colSpan = 4, onRetry }: ErrorRowProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-16 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">{message}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="text-xs text-indigo-400 hover:text-indigo-300 underline transition-colors"
            >
              Try again
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Scheduled Email Table ────────────────────────────────────────────────────

interface ScheduledTableProps {
  data: ScheduledEmail[];
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
}

export function ScheduledEmailTable({ data, loading, error, onRetry }: ScheduledTableProps) {
  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label="Scheduled emails">
          <thead>
            <tr className="border-b border-[var(--border-subtle)]">
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Recipient</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Subject</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Scheduled At</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {loading && data.length === 0 ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
            ) : error ? (
              <ErrorRow message={error} onRetry={onRetry} />
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <EmptyState
                    title="No scheduled emails"
                    description="Your scheduled emails will appear here once you compose and schedule a campaign."
                  />
                </td>
              </tr>
            ) : (
              data.map((email) => (
                <tr
                  key={email.id}
                  className="hover:bg-[var(--bg-elevated)] transition-colors group"
                >
                  <td className="px-4 py-3.5 font-mono text-xs text-[var(--text-primary)] max-w-[200px] truncate">
                    {email.recipient}
                  </td>
                  <td className="px-4 py-3.5 text-[var(--text-secondary)] max-w-[200px] truncate">
                    {email.subject}
                  </td>
                  <td className="px-4 py-3.5 text-[var(--text-muted)] whitespace-nowrap">
                    {formatDateTime(email.scheduledAt)}
                  </td>
                  <td className="px-4 py-3.5">
                    <Badge variant={statusToBadgeVariant(email.status)}>
                      {email.status}
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Sent Email Table ─────────────────────────────────────────────────────────

interface SentTableProps {
  data: SentEmail[];
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
}

export function SentEmailTable({ data, loading, error, onRetry }: SentTableProps) {
  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label="Sent emails">
          <thead>
            <tr className="border-b border-[var(--border-subtle)]">
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Recipient</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Subject</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Sent At</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Preview</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {loading && data.length === 0 ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
            ) : error ? (
              <ErrorRow message={error} colSpan={5} onRetry={onRetry} />
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <EmptyState
                    title="No sent emails yet"
                    description="Emails you send will appear here once they are processed and dispatched."
                    icon={
                      <svg className="w-10 h-10 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                      </svg>
                    }
                  />
                </td>
              </tr>
            ) : (
              data.map((email) => (
                <tr
                  key={email.id}
                  className="hover:bg-[var(--bg-elevated)] transition-colors"
                >
                  <td className="px-4 py-3.5 font-mono text-xs text-[var(--text-primary)] max-w-[200px] truncate">
                    {email.recipient}
                  </td>
                  <td className="px-4 py-3.5 text-[var(--text-secondary)] max-w-[200px] truncate">
                    {email.subject}
                  </td>
                  <td className="px-4 py-3.5 text-[var(--text-muted)] whitespace-nowrap">
                    {formatDateTime(email.sentAt)}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-col gap-1">
                      <Badge variant={statusToBadgeVariant(email.status)}>
                        {email.status}
                      </Badge>
                      {email.status === 'FAILED' && email.error && (
                        <p
                          className="text-xs text-red-400/80 max-w-[180px] truncate"
                          title={email.error}
                        >
                          {email.error}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    {email.messageId && email.messageId.startsWith('http') ? (
                      <a
                        href={email.messageId}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors"
                        title="Open email preview"
                      >
                        <span>{email.messageId.includes('ethereal.email') ? 'View on Ethereal' : 'View Preview'}</span>
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                        </svg>
                      </a>
                    ) : email.messageId ? (
                      <span className="font-mono text-xs text-[var(--text-muted)] max-w-[140px] truncate block" title={email.messageId}>
                        {email.messageId}
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--text-muted)]">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, total, limit, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between mt-4 px-1">
      <p className="text-xs text-[var(--text-muted)]">
        Showing <span className="text-[var(--text-secondary)]">{start}–{end}</span> of <span className="text-[var(--text-secondary)]">{total}</span>
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1.5 text-xs rounded-lg border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Previous
        </button>
        <span className="px-3 py-1.5 text-xs text-[var(--text-muted)]">{page} / {totalPages}</span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="px-3 py-1.5 text-xs rounded-lg border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}
