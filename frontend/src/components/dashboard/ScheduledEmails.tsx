import { useEffect, useState } from 'react';
import { useScheduledEmails } from '@/hooks/useEmails';
import { ScheduledEmailTable, Pagination } from './EmailTable';
import { Spinner } from '@/components/ui/Spinner';

interface ScheduledEmailsProps {
  /** Pass a refresh key — incrementing it triggers a refetch */
  refreshKey?: number;
}

export function ScheduledEmails({ refreshKey = 0 }: ScheduledEmailsProps) {
  const [page, setPage] = useState(1);
  const { data, pagination, loading, error, fetch } = useScheduledEmails();

  useEffect(() => {
    void fetch(page);
  }, [fetch, page, refreshKey]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Scheduled Emails</h2>
          {loading && <Spinner size="sm" />}
          {pagination && (
            <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-elevated)] px-2 py-0.5 rounded-full border border-[var(--border-subtle)]">
              {pagination.total}
            </span>
          )}
        </div>
        <button
          onClick={() => void fetch(page)}
          aria-label="Refresh scheduled emails"
          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
        >
          <svg className={['w-4 h-4', loading ? 'animate-spin' : ''].join(' ')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
        </button>
      </div>

      <ScheduledEmailTable
        data={data}
        loading={loading}
        error={error}
        onRetry={() => void fetch(page)}
      />

      {pagination && (
        <Pagination
          page={page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          limit={pagination.limit}
          onPageChange={(p) => setPage(p)}
        />
      )}
    </div>
  );
}
