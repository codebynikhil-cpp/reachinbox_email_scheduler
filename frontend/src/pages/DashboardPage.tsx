import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Stats } from '@/components/dashboard/Stats';
import { ScheduledEmails } from '@/components/dashboard/ScheduledEmails';
import { SentEmails } from '@/components/dashboard/SentEmails';
import { ComposeEmail } from '@/components/compose/ComposeEmail';
import { PageSpinner } from '@/components/ui/Spinner';

type Tab = 'scheduled' | 'sent';

export function DashboardPage() {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<Tab>('scheduled');
  const [composeOpen, setComposeOpen] = useState(false);
  // Increment to trigger child refresh after campaign is scheduled
  const [refreshKey, setRefreshKey] = useState(0);

  // Guard: redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      void navigate('/login', { replace: true });
    }
  }, [isAuthenticated, loading, navigate]);

  if (loading) return <PageSpinner />;
  if (!isAuthenticated) return null;

  const handleCampaignSuccess = () => {
    setActiveTab('scheduled');
    setRefreshKey((k) => k + 1);
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'scheduled', label: 'Scheduled' },
    { id: 'sent', label: 'Sent' },
  ];

  return (
    <DashboardLayout onComposeClick={() => setComposeOpen(true)}>
      <div className="space-y-8 animate-fade-in">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Dashboard</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Manage and monitor your email campaigns
          </p>
        </div>

        {/* Stats */}
        <Stats refreshKey={refreshKey} />

        {/* Tab navigation + table */}
        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-1 w-fit">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={[
                  'px-4 py-2 text-sm font-medium rounded-lg transition-all duration-150',
                  activeTab === tab.id
                    ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm border border-[var(--border-default)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/50',
                ].join(' ')}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab panels */}
          <div role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
            {activeTab === 'scheduled' ? (
              <ScheduledEmails refreshKey={refreshKey} />
            ) : (
              <SentEmails refreshKey={refreshKey} />
            )}
          </div>
        </div>
      </div>

      {/* Compose Modal */}
      <ComposeEmail
        isOpen={composeOpen}
        onClose={() => setComposeOpen(false)}
        onSuccess={handleCampaignSuccess}
      />
    </DashboardLayout>
  );
}
