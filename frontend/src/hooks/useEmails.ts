import { useState, useCallback } from 'react';
import { emailService } from '@/services/email.service';
import type {
  ScheduledEmail,
  SentEmail,
  EmailStats,
  Pagination,
} from '@/types/api';

interface EmailsState<T> {
  data: T[];
  pagination: Pagination | null;
  loading: boolean;
  error: string | null;
}

function initialState<T>(): EmailsState<T> {
  return {
    data: [],
    pagination: null,
    loading: false,
    error: null,
  };
}

export function useScheduledEmails() {
  const [state, setState] = useState<EmailsState<ScheduledEmail>>(initialState());

  const fetch = useCallback(async (page = 1, limit = 20) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const result = await emailService.getScheduled({ page, limit });
      setState({ data: result.data, pagination: result.pagination, loading: false, error: null });
    } catch {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: 'Failed to load scheduled emails. Please try again.',
      }));
    }
  }, []);

  return { ...state, fetch };
}

export function useSentEmails() {
  const [state, setState] = useState<EmailsState<SentEmail>>(initialState());

  const fetch = useCallback(async (page = 1, limit = 20) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const result = await emailService.getSent({ page, limit });
      setState({ data: result.data, pagination: result.pagination, loading: false, error: null });
    } catch {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: 'Failed to load sent emails. Please try again.',
      }));
    }
  }, []);

  return { ...state, fetch };
}

export function useEmailStats() {
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await emailService.getStats();
      const s = result.data || result.stats || (result as unknown as EmailStats);
      if (s) {
        setStats(s);
      }
    } catch {
      setError('Failed to load stats.');
    } finally {
      setLoading(false);
    }
  }, []);

  return { stats, loading, error, fetch };
}
