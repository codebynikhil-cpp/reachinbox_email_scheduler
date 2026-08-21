import React from 'react';
import { Header } from './Header';

interface DashboardLayoutProps {
  children: React.ReactNode;
  onComposeClick: () => void;
}

export function DashboardLayout({ children, onComposeClick }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex flex-col">
      <Header onComposeClick={onComposeClick} />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        {children}
      </main>
    </div>
  );
}
