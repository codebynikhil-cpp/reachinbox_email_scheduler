import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { SlackConnectModal } from '@/components/slack/SlackConnectModal';

interface HeaderProps {
  onComposeClick: () => void;
}

export function Header({ onComposeClick }: HeaderProps) {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [loggingOut, setLoggingOut] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [slackModalOpen, setSlackModalOpen] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      toast('Logout failed. Please try again.', 'error');
    } finally {
      setLoggingOut(false);
    }
  };

  const initials = user?.name
    ? user.name
        .split(' ')
        .slice(0, 2)
        .map((n) => n[0])
        .join('')
        .toUpperCase()
    : '?';

  return (
    <>
      <header className="sticky top-0 z-30 h-16 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-900/40">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
            <div className="hidden sm:block">
              <span className="text-sm font-bold text-[var(--text-primary)] tracking-tight">ReachInbox</span>
              <span className="ml-1.5 text-xs text-[var(--text-muted)]">Scheduler</span>
            </div>
          </div>

          {/* Right section */}
          <div className="flex items-center gap-3">

            {/* Connect Slack button */}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSlackModalOpen(true)}
              className="flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5 text-[#E01E5A]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" />
              </svg>
              <span className="hidden sm:inline">Slack Alerts</span>
            </Button>

            {/* Compose button */}
            <Button
              variant="primary"
              size="sm"
              onClick={onComposeClick}
              id="compose-email-btn"
              leftIcon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              }
            >
              <span className="hidden sm:inline">Compose</span>
            </Button>

          {/* User info */}
          <div className="flex items-center gap-2.5 pl-3 border-l border-[var(--border-subtle)]">
            {/* Avatar */}
            <div className="relative w-8 h-8 rounded-full overflow-hidden bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
              {user?.avatarUrl && !avatarError ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="w-full h-full object-cover"
                  onError={() => setAvatarError(true)}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="text-xs font-semibold text-indigo-300">{initials}</span>
              )}
            </div>

            {/* Name / Email */}
            <div className="hidden md:block leading-tight min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)] truncate max-w-[140px]">
                {user?.name ?? <Spinner size="sm" />}
              </p>
              <p className="text-xs text-[var(--text-muted)] truncate max-w-[140px]">
                {user?.email ?? ''}
              </p>
            </div>

            {/* Logout */}
            <button
              id="logout-btn"
              onClick={handleLogout}
              disabled={loggingOut}
              aria-label="Logout"
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              {loggingOut ? (
                <Spinner size="sm" />
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>

    <SlackConnectModal
      isOpen={slackModalOpen}
      onClose={() => setSlackModalOpen(false)}
    />
  </>
  );
}
