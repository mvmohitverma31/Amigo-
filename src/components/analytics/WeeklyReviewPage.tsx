import React, { useMemo } from 'react';
import { useApp } from '../../store/AppContext';
import { Card, Badge, Progress, EmptyState, Metric } from '../ui';
import { computeAnalyticsSummary, computeCategoryBreakdown, computeWeeklyTrend } from '../../engine/analytics';
import { startOfWeek, endOfWeek, format, subWeeks, parseISO } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export function WeeklyReviewPage() {
  const { state } = useApp();
  const { executions, tasks, categories } = state;

  // Current week
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekEndStr = format(weekEnd, 'yyyy-MM-dd');

  const weekExecutions = useMemo(() => {
    return executions.filter(e => e.date >= weekStartStr && e.date <= weekEndStr);
  }, [executions, weekStartStr, weekEndStr]);

  const weekSummary = useMemo(() => computeAnalyticsSummary(weekExecutions), [weekExecutions]);
  const categoryBreakdown = useMemo(
    () => computeCategoryBreakdown(weekExecutions, tasks, categories),
    [weekExecutions, tasks, categories]
  );
  const weeklyTrend = useMemo(() => computeWeeklyTrend(executions, 4), [executions]);

  // Best and worst time windows this week
  const timeWindowData = useMemo(() => {
    const windows = new Map<string, { completed: number; total: number }>();
    for (const exec of weekExecutions) {
      const hour = parseInt(exec.plannedStartTime.split(':')[0]);
      const windowKey = `${Math.floor(hour / 3) * 3}:00-${Math.floor(hour / 3) * 3 + 3}:00`;
      if (!windows.has(windowKey)) windows.set(windowKey, { completed: 0, total: 0 });
      const w = windows.get(windowKey)!;
      w.total++;
      if (exec.status === 'completed') w.completed++;
    }
    return Array.from(windows.entries())
      .filter(([, d]) => d.total >= 2)
      .map(([window, data]) => ({
        window,
        rate: data.completed / data.total,
        count: data.total,
      }))
      .sort((a, b) => b.rate - a.rate);
  }, [weekExecutions]);

  const bestWindows = timeWindowData.slice(0, 3);
  const worstWindows = timeWindowData.slice(-3).reverse();

  // Most postponed/skipped tasks
  const taskStats = useMemo(() => {
    const stats = new Map<string, { title: string; completed: number; skipped: number; postponed: number }>();
    for (const exec of weekExecutions) {
      const task = tasks.find(t => t.id === exec.taskId);
      if (!task) continue;
      if (!stats.has(task.id)) {
        stats.set(task.id, { title: task.title, completed: 0, skipped: 0, postponed: 0 });
      }
      const s = stats.get(task.id)!;
      if (exec.status === 'completed') s.completed++;
      if (exec.status === 'skipped') s.skipped++;
      if (exec.status === 'postponed') s.postponed++;
    }
    return Array.from(stats.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => (b.skipped + b.postponed) - (a.skipped + a.postponed));
  }, [weekExecutions, tasks]);

  const hasData = weekExecutions.length > 0;

  if (!hasData) {
    return (
      <div>
        <header className="mb-6">
          <h1 className="text-lg font-semibold text-text-primary">Weekly Review</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
          </p>
        </header>
        <EmptyState
          title="No data this week"
          description="Complete some tasks this week to see your review here. The system will analyze your patterns and suggest improvements."
        />
      </div>
    );
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-lg font-semibold text-text-primary">Weekly Review</h1>
        <p className="text-sm text-text-secondary mt-0.5">
          {format(weekStart, 'EEEE, MMM d')} – {format(weekEnd, 'EEEE, MMM d, yyyy')}
        </p>
      </header>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <Metric label="Planned" value={`${Math.round(weekSummary.totalPlannedMinutes / 60 * 10) / 10}h`} />
        </Card>
        <Card>
          <Metric label="Completed" value={`${Math.round(weekSummary.totalCompletedMinutes / 60 * 10) / 10}h`} />
        </Card>
        <Card>
          <Metric
            label="Completion"
            value={`${Math.round(weekSummary.completionRate * 100)}%`}
            subtitle={`${weekSummary.completedTasks}/${weekSummary.totalTasks}`}
          />
        </Card>
        <Card>
          <Metric label="Avg Delay" value={`${weekSummary.averageDelayMinutes}m`} />
        </Card>
        <Card>
          <Metric label="Streak" value={`${weekSummary.streakDays}d`} />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Weekly Trend Chart */}
        <Card>
          <h2 className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-4">4-Week Trend</h2>
          {weeklyTrend.length > 0 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyTrend} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2f" />
                  <XAxis dataKey="week" tick={{ fill: '#6b6b75', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#6b6b75', fontSize: 11 }} tickFormatter={(v) => `${Math.round(v * 100)}%`} domain={[0, 1]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1a1a1d', border: '1px solid #3a3a40', borderRadius: '4px', fontSize: '12px' }}
                    labelStyle={{ color: '#a0a0a8' }}
                    formatter={(value: number) => [`${Math.round(value * 100)}%`, 'Completion']}
                  />
                  <Bar dataKey="completionRate" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-text-tertiary">Not enough weeks of data</p>
          )}
        </Card>

        {/* Category Breakdown */}
        <Card>
          <h2 className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-4">Category Performance</h2>
          {categoryBreakdown.length > 0 ? (
            <div className="space-y-3">
              {categoryBreakdown.map(cat => (
                <div key={cat.categoryId}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-text-primary">{cat.categoryName}</span>
                    <div className="flex items-center gap-2 text-xs text-text-tertiary">
                      <span>{Math.round(cat.completedMinutes / 60 * 10) / 10}h planned</span>
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
            <p className="text-sm text-text-tertiary">No categorized tasks this week</p>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Best Time Windows */}
        <Card>
          <h2 className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-4">Best Time Windows</h2>
          {bestWindows.length > 0 ? (
            <div className="space-y-2">
              {bestWindows.map(w => (
                <div key={w.window} className="flex items-center justify-between px-3 py-2 bg-surface-2 rounded">
                  <span className="text-sm text-text-primary">{w.window}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-success">{Math.round(w.rate * 100)}%</span>
                    <span className="text-xs text-text-tertiary">({w.count} tasks)</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-tertiary">Not enough data to identify best windows</p>
          )}
        </Card>

        {/* Worst Time Windows */}
        <Card>
          <h2 className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-4">Challenging Time Windows</h2>
          {worstWindows.length > 0 ? (
            <div className="space-y-2">
              {worstWindows.map(w => (
                <div key={w.window} className="flex items-center justify-between px-3 py-2 bg-surface-2 rounded">
                  <span className="text-sm text-text-primary">{w.window}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-warning">{Math.round(w.rate * 100)}%</span>
                    <span className="text-xs text-text-tertiary">({w.count} tasks)</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-tertiary">Not enough data to identify challenging windows</p>
          )}
        </Card>
      </div>

      {/* Task Performance */}
      <Card>
        <h2 className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-4">Task Performance</h2>
        {taskStats.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="text-left py-2 text-xs text-text-tertiary font-medium">Task</th>
                  <th className="text-right py-2 text-xs text-text-tertiary font-medium">Done</th>
                  <th className="text-right py-2 text-xs text-text-tertiary font-medium">Skipped</th>
                  <th className="text-right py-2 text-xs text-text-tertiary font-medium">Postponed</th>
                  <th className="text-right py-2 text-xs text-text-tertiary font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {taskStats.slice(0, 10).map(task => (
                  <tr key={task.id} className="border-b border-border-subtle/50">
                    <td className="py-2 text-text-primary">{task.title}</td>
                    <td className="py-2 text-right text-success tabular-nums">{task.completed}</td>
                    <td className="py-2 text-right text-warning tabular-nums">{task.skipped}</td>
                    <td className="py-2 text-right text-text-secondary tabular-nums">{task.postponed}</td>
                    <td className="py-2 text-right">
                      <Badge variant={task.completed > task.skipped + task.postponed ? 'success' : 'warning'}>
                        {task.completed > task.skipped + task.postponed ? 'On track' : 'Needs attention'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-text-tertiary">No task data this week</p>
        )}
      </Card>
    </div>
  );
}
