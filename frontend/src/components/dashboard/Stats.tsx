import { useEffect } from 'react';
import { useEmailStats } from '@/hooks/useEmails';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
}

function StatCard({ label, value, icon, color, bgColor, borderColor }: StatCardProps) {
  return (
    <div
      className={`glass-card p-5 flex items-center gap-4 border ${borderColor} transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5`}
    >
      <div
        className={`w-11 h-11 rounded-xl ${bgColor} flex items-center justify-center shrink-0`}
      >
        <span className={color}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-[var(--text-primary)] leading-tight">{value}</p>
        <p className="text-xs font-medium text-[var(--text-secondary)] mt-0.5 uppercase tracking-wide">{label}</p>
      </div>
    </div>
  );
}

function StatSkeleton() {
  return (
    <div className="glass-card p-5 flex items-center gap-4">
      <div className="skeleton w-11 h-11 rounded-xl" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-7 w-16 rounded" />
        <div className="skeleton h-3 w-24 rounded" />
      </div>
    </div>
  );
}

interface StatsProps {
  refreshKey?: number;
}

export function Stats({ refreshKey }: StatsProps = {}) {
  const { stats, loading, fetch } = useEmailStats();

  useEffect(() => {
    void fetch();
  }, [fetch, refreshKey]);

  useEffect(() => {
    const interval = setInterval(() => {
      void fetch();
    }, 4000);
    return () => clearInterval(interval);
  }, [fetch]);

  const cards = [
    {
      label: 'Total',
      value: stats?.total ?? 0,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      color: 'text-indigo-400',
      bgColor: 'bg-indigo-500/10',
      borderColor: 'border-indigo-500/20',
    },
    {
      label: 'Scheduled',
      value: stats?.scheduled ?? 0,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/20',
    },
    {
      label: 'Processing',
      value: stats?.processing ?? 0,
      icon: (
        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ),
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/20',
    },
    {
      label: 'Sent',
      value: stats?.sent ?? 0,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/20',
    },
    {
      label: 'Failed',
      value: stats?.failed ?? 0,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      ),
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/20',
    },
  ];

  if (loading && !stats) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[0, 1, 2, 3, 4].map((i) => <StatSkeleton key={i} />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((card) => (
        <StatCard key={card.label} {...card} />
      ))}
    </div>
  );
}
