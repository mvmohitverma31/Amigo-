import React, { useState } from 'react';
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

function AppContent() {
  const { state } = useApp();
  const [currentPage, setCurrentPage] = useState('dashboard');

  if (state.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-0">
        <div className="text-center">
          <div className="text-lg font-bold text-text-primary mb-2">Amigo</div>
          <div className="text-sm text-text-tertiary">Loading...</div>
        </div>
      </div>
    );
  }

  if (!state.onboardingComplete) {
    return <OnboardingPage />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard />;
      case 'calendar': return <CalendarPage />;
      case 'tasks': return <TasksPage />;
      case 'analytics': return <AnalyticsPage />;
      case 'review': return <WeeklyReviewPage />;
      case 'insights': return <InsightsPage />;
      case 'settings': return <SettingsPage />;
      default: return <Dashboard />;
    }
  };

  return (
    <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
      {renderPage()}
    </Layout>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
