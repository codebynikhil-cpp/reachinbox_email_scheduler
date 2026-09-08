import { useEffect, useState } from 'react';
import { useScheduledEmails } from '@/hooks/useEmails';
import { emailService } from '@/services/email.service';
import { ScheduledEmailTable, Pagination } from './EmailTable';
import { Spinner } from '@/components/ui/Spinner';

interface ScheduledEmailsProps {
  /** Pass a refresh key — incrementing it triggers a refetch */
  refreshKey?: number;
}

export function ScheduledEmails({ refreshKey = 0 }: ScheduledEmailsProps) {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [searchTotal, setSearchTotal] = useState<number | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchSource, setSearchSource] = useState<string | null>(null);

  const { data, pagination, loading, error, fetch } = useScheduledEmails();

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      setSearchTotal(null);
      setSearchSource(null);
      void fetch(page);
    } else {
      const timer = setTimeout(async () => {
        try {
          setSearchLoading(true);
          const res = await emailService.searchEmails({
            q: searchQuery.trim(),
            status: 'SCHEDULED',
            page,
            limit: 20,
          });
          setSearchResults(res.emails);
          setSearchTotal(res.pagination.total);
          setSearchSource(res.source);
        } catch {
          // fallback to regular list on error
        } finally {
          setSearchLoading(false);
        }
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [fetch, page, refreshKey, searchQuery]);

  // Periodic background sync so scheduled emails disappear dynamically once sent
  useEffect(() => {
    const interval = setInterval(() => {
      if (!searchQuery.trim()) {
        void fetch(page, 20, true);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [fetch, page, searchQuery]);

  const displayData = searchResults !== null ? searchResults : data;
  const isSearching = Boolean(searchQuery.trim());
  const isLoading = loading || searchLoading;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Scheduled Emails</h2>
          {isLoading && <Spinner size="sm" />}
          <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-elevated)] px-2 py-0.5 rounded-full border border-[var(--border-subtle)]">
            {isSearching ? searchTotal ?? 0 : pagination?.total ?? 0}
          </span>
          {searchSource && (
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {searchSource === 'elasticsearch' ? '⚡ Elasticsearch' : 'DB Indexed'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Search recipient, subject..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 pl-8 text-xs rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus:border-indigo-500 focus:outline-none text-[var(--text-primary)] w-52 sm:w-64 placeholder-[var(--text-muted)]"
            />
            <svg
              className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[var(--text-muted)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          <button
            onClick={() => {
              if (isSearching) {
                setSearchQuery('');
              }
              void fetch(page);
            }}
            aria-label="Refresh scheduled emails"
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
          >
            <svg
              className={['w-4 h-4', isLoading ? 'animate-spin' : ''].join(' ')}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
              />
            </svg>
          </button>
        </div>
      </div>

      <ScheduledEmailTable
        data={displayData}
        loading={isLoading}
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
