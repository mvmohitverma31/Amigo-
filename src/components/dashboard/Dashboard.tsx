import React, { useMemo, useState } from 'react';
import { useApp } from '../../store/AppContext';
import { Card, Badge, Progress, Button, Metric, EmptyState, Modal } from '../ui';
import { format, isToday, parseISO } from 'date-fns';
import { timeToMinutes } from '../../engine/scheduler';
import type { SkipReason } from '../../types';

export function Dashboard() {
  const { state, actions } = useApp();
  const { scheduleItems, tasks, executions, currentDate } = state;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const todayStats = useMemo(() => {
    const total = scheduleItems.length;
    const completed = scheduleItems.filter(s => s.status === 'completed').length;
    const active = scheduleItems.find(s => s.status === 'active');
    const remaining = scheduleItems.filter(s => s.status === 'pending' && timeToMinutes(s.startTime) > currentMinutes);
    const upcoming = scheduleItems.filter(s => s.status === 'pending' && timeToMinutes(s.startTime) >= currentMinutes).sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
    const next = upcoming[0] || null;
    return { total, completed, active, remaining: remaining.length, next, upcoming: upcoming.slice(0, 5) };
  }, [scheduleItems, currentMinutes]);

  const dayProgress = todayStats.total > 0 ? (todayStats.completed / todayStats.total) * 100 : 0;

  // Skip/Postpone reason dialog
  const [reasonDialog, setReasonDialog] = useState<{ itemId: string; action: 'skip' | 'postpone' } | null>(null);
  const [selectedReason, setSelectedReason] = useState<SkipReason | ''>('');

  const handleActionWithReason = async () => {
    if (!reasonDialog) return;
    const reason = selectedReason || undefined;
    if (reasonDialog.action === 'skip') {
      await actions.skipTask(reasonDialog.itemId, reason as SkipReason);
    } else {
      await actions.postponeTask(reasonDialog.itemId, reason as SkipReason);
    }
    setReasonDialog(null);
    setSelectedReason('');
  };

  const upcomingDeadlines = useMemo(() => {
    return tasks
      .filter(t => t.deadline)
      .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
      .slice(0, 3);
  }, [tasks]);

  if (scheduleItems.length === 0) {
    return (
      <div>
        <header className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-text-primary">Dashboard</h1>
              <p className="text-sm text-text-secondary mt-0.5">
                {format(parseISO(currentDate), 'EEEE, MMMM d, yyyy')}
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-text-primary tabular-nums">
                {format(now, 'HH:mm')}
              </div>
            </div>
          </div>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <h2 className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-3">Getting Started</h2>
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 ${state.tasks.length > 0 ? 'bg-success text-white' : 'bg-surface-3 text-text-tertiary'}`}>
                  {state.tasks.length > 0 ? '✓' : '1'}
                </span>
                <div>
                  <p className="text-sm text-text-primary">Add tasks</p>
                  <p className="text-xs text-text-tertiary">Define what you want to accomplish</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 ${state.commitments.length > 0 ? 'bg-success text-white' : 'bg-surface-3 text-text-tertiary'}`}>
                  {state.commitments.length > 0 ? '✓' : '2'}
                </span>
                <div>
                  <p className="text-sm text-text-primary">Set fixed commitments</p>
                  <p className="text-xs text-text-tertiary">Classes, work, meetings</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 bg-surface-3 text-text-tertiary">3</span>
                <div>
                  <p className="text-sm text-text-primary">Generate schedule</p>
                  <p className="text-xs text-text-tertiary">Go to Calendar to generate your daily plan</p>
                </div>
              </div>
            </div>
          </Card>
          <Card>
            <h2 className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-3">Quick Stats</h2>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Tasks</span>
                <span className="text-text-primary">{state.tasks.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Fixed commitments</span>
                <span className="text-text-primary">{state.commitments.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Data points</span>
                <span className="text-text-primary">{state.executions.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Learning status</span>
                <span className="text-text-primary">
                  {state.executions.length < 5 ? 'Cold start' : state.executions.length < 15 ? 'Learning' : 'Developing'}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div>
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Dashboard</h1>
            <p className="text-sm text-text-secondary mt-0.5">
              {format(parseISO(currentDate), 'EEEE, MMMM d, yyyy')}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-text-primary tabular-nums">
              {format(now, 'HH:mm')}
            </div>
          </div>
        </div>
      </header>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <Metric label="Progress" value={`${Math.round(dayProgress)}%`} subtitle={`${todayStats.completed}/${todayStats.total} tasks`} />
        </Card>
        <Card>
          <Metric label="Completed" value={todayStats.completed} subtitle="tasks done" />
        </Card>
        <Card>
          <Metric label="Remaining" value={todayStats.remaining} subtitle="tasks left" />
        </Card>
        <Card>
          <Metric
            label="Streak"
            value={`${state.executions.filter(e => e.status === 'completed').length > 0 ? '1' : '0'}d`}
            subtitle="consecutive days"
          />
        </Card>
      </div>

      {/* Current & Next */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card>
          <h2 className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-3">Current Activity</h2>
          {todayStats.active ? (
            <div>
              <div className="text-base font-medium text-text-primary">{todayStats.active.title}</div>
              <div className="text-sm text-text-secondary mt-1">
                {todayStats.active.startTime} – {todayStats.active.endTime}
              </div>
              <div className="mt-3">
                <Progress
                  value={Math.min(100, ((currentMinutes - timeToMinutes(todayStats.active.startTime)) / todayStats.active.durationMinutes) * 100)}
                  variant="success"
                />
              </div>
              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="success" onClick={() => actions.completeTask(todayStats.active!.id)}>
                  Complete
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setReasonDialog({ itemId: todayStats.active!.id, action: 'skip' })}>
                  Skip
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-text-tertiary">
              {currentMinutes < timeToMinutes(state.preferences?.wakeUpTime || '07:00')
                ? 'Not yet started'
                : currentMinutes > timeToMinutes(state.preferences?.sleepTime || '23:00')
                ? 'Day complete'
                : 'Between activities'}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-3">Next Up</h2>
          {todayStats.next ? (
            <div>
              <div className="text-base font-medium text-text-primary">{todayStats.next.title}</div>
              <div className="text-sm text-text-secondary mt-1">
                {todayStats.next.startTime} – {todayStats.next.endTime}
                <span className="ml-2 text-text-tertiary">
                  ({todayStats.next.durationMinutes} min)
                </span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                {todayStats.next.isFixed && <Badge variant="accent">Fixed</Badge>}
                {todayStats.next.isLocked && <Badge>Locked</Badge>}
              </div>
            </div>
          ) : (
            <div className="text-sm text-text-tertiary">No more activities today</div>
          )}
        </Card>
      </div>

      {/* Day Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Card>
            <h2 className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-3">Today's Schedule</h2>
            <div className="space-y-1">
              {scheduleItems.map(item => {
                const isPast = timeToMinutes(item.endTime) < currentMinutes;
                const isCurrent = item.status === 'active';
                const statusColors = {
                  pending: 'border-border-subtle',
                  active: 'border-accent bg-accent-muted/30',
                  completed: 'border-success/30 opacity-60',
                  skipped: 'border-border-subtle opacity-40',
                  postponed: 'border-warning/30 opacity-60',
                  paused: 'border-border-subtle opacity-60',
                };

                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 px-3 py-2 rounded border-l-2 ${statusColors[item.status]} ${isCurrent ? 'ring-1 ring-accent/30' : ''}`}
                  >
                    <div className="w-14 text-xs text-text-tertiary tabular-nums shrink-0">
                      {item.startTime}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm truncate ${isPast && item.status !== 'active' ? 'text-text-tertiary line-through' : 'text-text-primary'}`}>
                        {item.title}
                      </div>
                      <div className="text-xs text-text-tertiary">
                        {item.durationMinutes} min
                        {item.isFixed && ' · Fixed'}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {item.status === 'pending' && !isPast && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => actions.completeTask(item.id)} aria-label="Complete">✓</Button>
                          <Button size="sm" variant="ghost" onClick={() => setReasonDialog({ itemId: item.id, action: 'skip' })} aria-label="Skip">⊘</Button>
                          <Button size="sm" variant="ghost" onClick={() => setReasonDialog({ itemId: item.id, action: 'postpone' })} aria-label="Postpone">⏱</Button>
                        </>
                      )}
                      {item.status === 'completed' && <Badge variant="success">Done</Badge>}
                      {item.status === 'skipped' && <Badge variant="warning">Skipped</Badge>}
                      {item.status === 'postponed' && <Badge variant="warning">Postponed</Badge>}
                      {item.status === 'active' && <Badge variant="accent">Active</Badge>}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Side panel */}
        <div className="space-y-4">
          {/* Deadlines */}
          <Card>
            <h2 className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-3">Upcoming Deadlines</h2>
            {upcomingDeadlines.length > 0 ? (
              <div className="space-y-2">
                {upcomingDeadlines.map(task => {
                  const deadline = parseISO(task.deadline!);
                  const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <div key={task.id} className="flex items-center justify-between">
                      <span className="text-sm text-text-primary truncate">{task.title}</span>
                      <Badge variant={daysLeft <= 1 ? 'danger' : daysLeft <= 3 ? 'warning' : 'default'}>
                        {daysLeft <= 0 ? 'Today' : `${daysLeft}d`}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-text-tertiary">No upcoming deadlines</p>
            )}
          </Card>

          {/* Day Progress */}
          <Card>
            <h2 className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-3">Day Progress</h2>
            <Progress value={dayProgress} variant={dayProgress > 70 ? 'success' : dayProgress > 40 ? 'default' : 'warning'} />
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-sm font-medium text-success">{todayStats.completed}</div>
                <div className="text-xs text-text-tertiary">Done</div>
              </div>
              <div>
                <div className="text-sm font-medium text-warning">{scheduleItems.filter(s => s.status === 'skipped' || s.status === 'postponed').length}</div>
                <div className="text-xs text-text-tertiary">Missed</div>
              </div>
              <div>
                <div className="text-sm font-medium text-text-primary">{todayStats.remaining}</div>
                <div className="text-xs text-text-tertiary">Left</div>
              </div>
            </div>
          </Card>

          {/* Quick Stats */}
          <Card>
            <h2 className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-3">This Week</h2>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Completion rate</span>
                <span className="text-text-primary tabular-nums">
                  {state.executions.length > 0
                    ? `${Math.round((state.executions.filter(e => e.status === 'completed').length / state.executions.length) * 100)}%`
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Avg delay</span>
                <span className="text-text-primary tabular-nums">
                  {state.executions.filter(e => e.actualStartTime).length > 0
                    ? `${Math.round(state.executions.reduce((sum, e) => {
                        if (!e.actualStartTime) return sum;
                        const planned = timeToMinutes(e.plannedStartTime);
                        const actual = timeToMinutes(e.actualStartTime);
                        return sum + Math.max(0, actual - planned);
                      }, 0) / state.executions.filter(e => e.actualStartTime).length)}m`
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Data points</span>
                <span className="text-text-primary tabular-nums">{state.executions.length}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Skip/Postpone Reason Dialog */}
      <Modal
        isOpen={reasonDialog !== null}
        onClose={() => { setReasonDialog(null); setSelectedReason(''); }}
        title={reasonDialog?.action === 'skip' ? 'Skip Task' : 'Postpone Task'}
        size="sm"
      >
        <div className="space-y-3">
          <p className="text-sm text-text-secondary">
            {reasonDialog?.action === 'skip'
              ? 'Why are you skipping this task? (Optional — helps improve future schedules)'
              : 'Why are you postponing this task? (Optional — helps improve future schedules)'}
          </p>
          <div className="space-y-1.5">
            {[
              { value: 'too_tired', label: 'Too tired' },
              { value: 'took_longer', label: 'Previous task took longer than expected' },
              { value: 'didnt_feel_like_it', label: "Didn't feel like doing it" },
              { value: 'unexpected_event', label: 'Unexpected event came up' },
              { value: 'schedule_unrealistic', label: 'Schedule was unrealistic' },
              { value: 'higher_priority', label: 'Higher-priority task appeared' },
              { value: 'other', label: 'Other' },
            ].map(reason => (
              <button
                key={reason.value}
                onClick={() => setSelectedReason(reason.value as SkipReason)}
                className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                  selectedReason === reason.value
                    ? 'bg-accent-muted text-accent border border-accent/30'
                    : 'bg-surface-2 text-text-secondary hover:bg-surface-3 border border-transparent'
                }`}
              >
                {reason.label}
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSelectedReason(''); handleActionWithReason(); }}
            >
              {reasonDialog?.action === 'skip' ? 'Skip' : 'Postpone'} without reason
            </Button>
            <Button variant="primary" size="sm" onClick={handleActionWithReason}>
              Confirm
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
