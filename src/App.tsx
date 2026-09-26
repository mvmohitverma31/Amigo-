import React, { useState, useEffect, useMemo } from 'react';
import { AppProvider, useApp } from './store/AppContext';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './components/dashboard/Dashboard';
import { CalendarPage } from './components/calendar/CalendarPage';
import { TasksPage } from './components/tasks/TasksPage';
import { AnalyticsPage } from './components/analytics/AnalyticsPage';
import { WeeklyReviewPage } from './components/analytics/WeeklyReviewPage';
import { InsightsPage } from './components/insights/InsightsPage';
import { SettingsPage } from './components/settings/SettingsPage';
import { OnboardingPage } from './components/onboarding/OnboardingPage';
import { AuthPage } from './components/auth/AuthPage';
import { ToastProvider, useToast } from './components/ui/ToastProvider';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { getDemoAuthState, demoLogin, demoRegister, demoLogout, type DemoUser } from './auth/demoAuth';

function AppContent() {
  const { state } = useApp();
  const { addToast } = useToast();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [authState, setAuthState] = useState(getDemoAuthState());
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Keyboard shortcuts
  const shortcuts = useMemo(() => [
    { key: '1', ctrl: true, description: 'Dashboard', action: () => setCurrentPage('dashboard') },
    { key: '2', ctrl: true, description: 'Calendar', action: () => setCurrentPage('calendar') },
    { key: '3', ctrl: true, description: 'Tasks', action: () => setCurrentPage('tasks') },
    { key: '4', ctrl: true, description: 'Analytics', action: () => setCurrentPage('analytics') },
    { key: '5', ctrl: true, description: 'Review', action: () => setCurrentPage('review') },
    { key: '6', ctrl: true, description: 'Adaptation', action: () => setCurrentPage('insights') },
    { key: '7', ctrl: true, description: 'Settings', action: () => setCurrentPage('settings') },
    { key: 'n', ctrl: true, description: 'New task', action: () => setCurrentPage('tasks') },
    { key: '?', shift: true, description: 'Show shortcuts', action: () => addToast('Shortcuts: Ctrl+1-7 for navigation, Ctrl+N for new task', 'info', 5000) },
  ], [addToast]);

  useKeyboardShortcuts(shortcuts);

  // Handle login
  const handleLogin = async (data: { email: string; password: string }) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const result = await demoLogin(data.email, data.password);
      setAuthState(result);
      addToast(`Welcome back, ${result.user?.displayName || 'User'}!`, 'success');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Login failed');
    }
    setAuthLoading(false);
  };

  // Handle register
  const handleRegister = async (data: { email: string; password: string; displayName?: string }) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const result = await demoRegister(data.email, data.password, data.displayName || '');
      setAuthState(result);
      addToast(`Account created! Welcome, ${result.user?.displayName || 'User'}.`, 'success');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Registration failed');
    }
    setAuthLoading(false);
  };

  // Handle logout
  const handleLogout = async () => {
    await demoLogout();
    setAuthState({ user: null, isAuthenticated: false });
    addToast('Signed out successfully', 'info');
  };

  // Not authenticated — show auth screen
  if (!authState.isAuthenticated) {
    return (
      <AuthPage
        mode={authMode}
        onSwitchMode={() => { setAuthMode(m => m === 'login' ? 'register' : 'login'); setAuthError(null); }}
        onSubmit={authMode === 'login' ? handleLogin : handleRegister}
        error={authError}
        loading={authLoading}
      />
    );
  }

  // Loading state
  if (state.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-0">
        <div className="text-center">
          <div className="text-lg font-bold text-text-primary mb-2">Amigo</div>
          <div className="text-sm text-text-tertiary">Loading your data...</div>
        </div>
      </div>
    );
  }

  // Onboarding
  if (!state.onboardingComplete) {
    return <OnboardingPage />;
  }

  // Main app
  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard />;
      case 'calendar': return <CalendarPage />;
      case 'tasks': return <TasksPage />;
      case 'analytics': return <AnalyticsPage />;
      case 'review': return <WeeklyReviewPage />;
      case 'insights': return <InsightsPage />;
      case 'settings': return <SettingsPage onLogout={handleLogout} userEmail={authState.user?.email} />;
      default: return <Dashboard />;
    }
  };

  return (
    <Layout currentPage={currentPage} onNavigate={setCurrentPage} user={authState.user} onLogout={handleLogout}>
      {renderPage()}
    </Layout>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ToastProvider>
  );
}
