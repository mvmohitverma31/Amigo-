import React, { useState } from 'react';
import { useApp } from '../../store/AppContext';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: '⊞' },
  { id: 'calendar', label: 'Calendar', icon: '▦' },
  { id: 'tasks', label: 'Tasks', icon: '✓' },
  { id: 'analytics', label: 'Analytics', icon: '◫' },
  { id: 'review', label: 'Review', icon: '◷' },
  { id: 'insights', label: 'Adaptation', icon: '◈' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
];

export function Layout({ children, currentPage, onNavigate }: LayoutProps) {
  const { state } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-56 bg-surface-1 border-r border-border-subtle shrink-0">
        <div className="p-4 border-b border-border-subtle">
          <h1 className="text-base font-bold text-text-primary tracking-tight">Amigo</h1>
          <p className="text-xs text-text-tertiary mt-0.5">Adaptive Scheduler</p>
        </div>
        <nav className="flex-1 py-2 px-2" aria-label="Main navigation">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-colors text-left ${
                currentPage === item.id
                  ? 'bg-surface-3 text-text-primary'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-2'
              }`}
              aria-current={currentPage === item.id ? 'page' : undefined}
            >
              <span className="text-base w-5 text-center">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-border-subtle">
          <div className="text-xs text-text-tertiary">
            <div className="flex justify-between">
              <span>Data level</span>
              <span className="text-text-secondary">
                {state.executions.length < 5 ? 'Cold start' : state.executions.length < 15 ? 'Learning' : state.executions.length < 40 ? 'Developing' : 'Mature'}
              </span>
            </div>
            <div className="h-1 bg-surface-3 rounded mt-1.5">
              <div
                className="h-full bg-accent rounded transition-all"
                style={{ width: `${Math.min(100, state.executions.length * 2.5)}%` }}
              />
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-surface-1 border-b border-border-subtle">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-sm font-bold text-text-primary">Amigo</h1>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-tertiary tabular-nums">{timeStr}</span>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-text-secondary p-1"
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <nav className="px-2 pb-3 border-t border-border-subtle" aria-label="Mobile navigation">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => { onNavigate(item.id); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-sm text-left ${
                  currentPage === item.id ? 'bg-surface-3 text-text-primary' : 'text-text-secondary'
                }`}
              >
                <span className="text-base w-5 text-center">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>
        )}
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
