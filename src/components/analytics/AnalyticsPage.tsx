import React, { useMemo } from 'react';
import { useApp } from '../../store/AppContext';
import { Card, Badge, EmptyState, Metric, Progress } from '../ui';
import {
  computeAnalyticsSummary,
  computeCategoryBreakdown,
  computeTimeWindowScores,
  computeHourlyProductivity,
  computeWeeklyTrend,
  computeDayOfWeekPerformance,
} from '../../engine/analytics';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';

export function AnalyticsPage() {
  const { state } = useApp();
  const { executions, tasks, categories } = state;

  const summary = useMemo(() => computeAnalyticsSummary(executions), [executions]);
  const categoryBreakdown = useMemo(() => computeCategoryBreakdown(executions, tasks, categories), [executions, tasks, categories]);
  const timeWindows = useMemo(() => computeTimeWindowScores(executions), [executions]);
  const hourlyProd = useMemo(() => computeHourlyProductivity(executions), [executions]);
  const weeklyTrend = useMemo(() => computeWeeklyTrend(executions), [executions]);
  const dayPerformance = useMemo(() => computeDayOfWeekPerformance(executions), [executions]);

  const hasData = executions.length >= 3;

  if (!hasData) {
    return (
      <div>
        <header className="mb-6">
          <h1 className="text-lg font-semibold text-text-primary">Analytics</h1>
          <p className="text-sm text-text-secondary mt-0.5">Performance insights from your scheduling data</p>
        </header>
        <EmptyState
          title="Not enough data yet"
          description={`You need at least 3 task completions to see analytics. Currently: ${executions.length} data points. Complete some tasks to start building insights.`}
        />
      </div>
    );
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-lg font-semibold text-text-primary">Analytics</h1>
        <p className="text-sm text-text-secondary mt-0.5">
          Based on {executions.length} recorded task executions
        </p>
      </header>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <Metric
            label="Completion Rate"
            value={`${Math.round(summary.completionRate * 100)}%`}
            subtitle={`${summary.completedTasks}/${summary.totalTasks}`}
          />
        </Card>
        <Card>
          <Metric
            label="Avg Delay"
            value={`${summary.averageDelayMinutes}m`}
            subtitle="average start delay"
          />
        </Card>
        <Card>
          <Metric
            label="Duration Accuracy"
            value={`${summary.averageDurationDeviation}m`}
            subtitle="avg deviation"
          />
        </Card>
        <Card>
          <Metric
            label="Streak"
            value={`${summary.streakDays}d`}
            subtitle="consecutive days"
          />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Hourly Productivity */}
        <Card>
          <h2 className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-4">Productivity by Hour</h2>
          {hourlyProd.length > 0 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyProd} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2f" />
                  <XAxis dataKey="hour" tick={{ fill: '#6b6b75', fontSize: 11 }} tickFormatter={(v) => `${v}:00`} />
                  <YAxis tick={{ fill: '#6b6b75', fontSize: 11 }} tickFormatter={(v) => `${Math.round(v * 100)}%`} domain={[0, 1]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1a1a1d', border: '1px solid #3a3a40', borderRadius: '4px', fontSize: '12px' }}
                    labelStyle={{ color: '#a0a0a8' }}
                    formatter={(value: number) => [`${Math.round(value * 100)}%`, 'Completion']}
                    labelFormatter={(label) => `${label}:00`}
                  />
                  <Bar dataKey="rate" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-text-tertiary">Not enough data</p>
          )}
        </Card>

        {/* Weekly Trend */}
        <Card>
          <h2 className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-4">Weekly Trend</h2>
          {weeklyTrend.length > 0 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyTrend} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2f" />
                  <XAxis dataKey="week" tick={{ fill: '#6b6b75', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#6b6b75', fontSize: 11 }} tickFormatter={(v) => `${Math.round(v * 100)}%`} domain={[0, 1]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1a1a1d', border: '1px solid #3a3a40', borderRadius: '4px', fontSize: '12px' }}
                    labelStyle={{ color: '#a0a0a8' }}
                    formatter={(value: number) => [`${Math.round(value * 100)}%`, 'Completion']}
                  />
                  <Line type="monotone" dataKey="completionRate" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-text-tertiary">Not enough data</p>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Day of Week Performance */}
        <Card>
          <h2 className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-4">Day of Week</h2>
          {dayPerformance.length > 0 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dayPerformance} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2f" />
                  <XAxis dataKey="day" tick={{ fill: '#6b6b75', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#6b6b75', fontSize: 11 }} tickFormatter={(v) => `${Math.round(v * 100)}%`} domain={[0, 1]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1a1a1d', border: '1px solid #3a3a40', borderRadius: '4px', fontSize: '12px' }}
                    labelStyle={{ color: '#a0a0a8' }}
                    formatter={(value: number, name: string, props: any) => [
                      `${Math.round(value * 100)}% (${props.payload.count} tasks)`,
                      'Completion'
                    ]}
                  />
                  <Bar dataKey="rate" fill="#22c55e" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-text-tertiary">Not enough data</p>
          )}
        </Card>

        {/* Time Window Scores */}
        <Card>
          <h2 className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-4">Time Windows</h2>
          {timeWindows.length > 0 ? (
            <div className="space-y-2">
              {timeWindows.filter(tw => tw.sampleSize >= 2).map(tw => (
                <div key={tw.timeWindow} className="flex items-center gap-3">
                  <span className="text-xs text-text-tertiary w-24 tabular-nums">{tw.timeWindow}</span>
                  <div className="flex-1">
                    <Progress
                      value={tw.completionRate * 100}
                      max={100}
                      showValue={false}
                      variant={tw.completionRate > 0.7 ? 'success' : tw.completionRate > 0.4 ? 'default' : 'danger'}
                    />
                  </div>
                  <span className="text-xs text-text-secondary tabular-nums w-10 text-right">
                    {Math.round(tw.completionRate * 100)}%
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-tertiary">Not enough data</p>
          )}
        </Card>
      </div>

      {/* Category Breakdown */}
      <Card>
        <h2 className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-4">Category Performance</h2>
        {categoryBreakdown.length > 0 ? (
          <div className="space-y-3">
            {categoryBreakdown.map(cat => (
              <div key={cat.categoryId}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-text-primary">{cat.categoryName}</span>
                  <div className="flex items-center gap-3 text-xs text-text-tertiary">
                    <span>{Math.round(cat.completedMinutes / 60 * 10) / 10}h / {Math.round(cat.plannedMinutes / 60 * 10) / 10}h</span>
                    <Badge variant={cat.completionRate > 0.7 ? 'success' : cat.completionRate > 0.4 ? 'default' : 'warning'}>
                      {Math.round(cat.completionRate * 100)}%
                    </Badge>
                  </div>
                </div>
                <Progress
                  value={cat.completionRate * 100}
                  max={100}
                  showValue={false}
                  variant={cat.completionRate > 0.7 ? 'success' : cat.completionRate > 0.4 ? 'default' : 'warning'}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-tertiary">No categorized tasks yet</p>
        )}
      </Card>
    </div>
  );
}
