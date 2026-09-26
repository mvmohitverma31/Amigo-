import React, { useState, useMemo } from 'react';
import { useApp } from '../../store/AppContext';
import { Card, Badge, Button, Tabs } from '../ui';
import { format, addDays, subDays, startOfWeek, addWeeks, subWeeks, parseISO, isSameDay } from 'date-fns';
import { timeToMinutes, minutesToTime, generateSchedule } from '../../engine/scheduler';
import { getAdjustedDurations, getCompletionScores } from '../../engine/personalization';

export function CalendarPage() {
  const { state, actions, dispatch } = useApp();
  const [view, setView] = useState<'day' | 'week'>('day');
  const [selectedDate, setSelectedDate] = useState(new Date());

  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  const weekDates = useMemo(() => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [selectedDate]);

  const scheduleResult = useMemo(() => {
    if (!state.preferences) return null;
    const adjustedDurations = getAdjustedDurations(state.tasks, state.executions);
    const completionScores = getCompletionScores(state.executions);
    return generateSchedule(
      dateStr,
      state.tasks,
      state.commitments,
      state.preferences,
      completionScores,
      state.preferences.personalizationEnabled ? adjustedDurations : undefined
    );
  }, [dateStr, state.tasks, state.commitments, state.preferences, state.executions]);

  const displayItems = state.scheduleItems.length > 0 && isSameDay(parseISO(state.currentDate), selectedDate)
    ? state.scheduleItems
    : scheduleResult?.items || [];

  const conflicts = scheduleResult?.conflicts || [];
  const warnings = scheduleResult?.warnings || [];

  const handleGenerate = () => {
    if (!state.preferences || !scheduleResult) return;
    // Save generated schedule items
    const items = scheduleResult.items;
    items.forEach(item => {
      actions.updateScheduleItem(item);
    });
  };

  const hours = Array.from({ length: 18 }, (_, i) => i + 5); // 5am to 10pm

  return (
    <div>
      <header className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Calendar</h1>
            <p className="text-sm text-text-secondary mt-0.5">
              {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => setSelectedDate(d => subDays(d, view === 'week' ? 7 : 1))}>←</Button>
            <Button size="sm" variant="secondary" onClick={() => setSelectedDate(new Date())}>Today</Button>
            <Button size="sm" variant="secondary" onClick={() => setSelectedDate(d => addDays(d, view === 'week' ? 7 : 1))}>→</Button>
            <div className="ml-2">
              <Tabs
                tabs={[{ id: 'day', label: 'Day' }, { id: 'week', label: 'Week' }]}
                activeTab={view}
                onChange={(id) => setView(id as 'day' | 'week')}
              />
            </div>
          </div>
        </div>
      </header>

      {conflicts.length > 0 && (
        <Card className="mb-4 border-warning/30">
          <div className="flex items-start gap-2">
            <span className="text-warning">⚠</span>
            <div>
              <h3 className="text-sm font-medium text-warning">Scheduling Conflicts</h3>
              {conflicts.map((c, i) => (
                <p key={i} className="text-xs text-text-secondary mt-1">{c.message}</p>
              ))}
            </div>
          </div>
        </Card>
      )}

      {view === 'day' ? (
        <Card padding={false}>
          <div className="overflow-x-auto">
            <div className="min-w-[500px]">
              {hours.map(hour => {
                const hourItems = displayItems.filter(item => {
                  const start = timeToMinutes(item.startTime);
                  return start >= hour * 60 && start < (hour + 1) * 60;
                });
                const isCurrentHour = new Date().getHours() === hour && isSameDay(selectedDate, new Date());

                return (
                  <div key={hour} className={`flex border-b border-border-subtle ${isCurrentHour ? 'bg-accent-muted/10' : ''}`}>
                    <div className="w-16 shrink-0 py-2 px-3 text-xs text-text-tertiary tabular-nums border-r border-border-subtle">
                      {String(hour).padStart(2, '0')}:00
                    </div>
                    <div className="flex-1 py-1 px-2 min-h-[44px]">
                      {hourItems.map(item => (
                        <div
                          key={item.id}
                          className={`px-2 py-1.5 rounded text-xs mb-1 border-l-2 ${
                            item.status === 'completed' ? 'bg-success-muted/30 border-success text-text-secondary' :
                            item.status === 'skipped' ? 'bg-surface-3 border-warning text-text-tertiary opacity-60' :
                            item.status === 'active' ? 'bg-accent-muted/30 border-accent text-text-primary' :
                            item.isFixed ? 'bg-surface-3 border-text-tertiary text-text-primary' :
                            'bg-surface-2 border-accent/50 text-text-primary'
                          }`}
                        >
                          <div className="font-medium">{item.title}</div>
                          <div className="text-text-tertiary mt-0.5">
                            {item.startTime}–{item.endTime} · {item.durationMinutes}m
                            {item.isFixed && ' · Fixed'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {weekDates.map(date => {
            const ds = format(date, 'yyyy-MM-dd');
            const dayItems = ds === dateStr ? displayItems : [];
            const isCurrentDay = isSameDay(date, new Date());
            const isSelected = isSameDay(date, selectedDate);

            return (
              <button
                key={ds}
                onClick={() => setSelectedDate(date)}
                className={`p-2 rounded text-left min-h-[120px] border transition-colors ${
                  isSelected ? 'border-accent bg-accent-muted/10' :
                  isCurrentDay ? 'border-accent/30 bg-surface-1' :
                  'border-border-subtle bg-surface-1 hover:bg-surface-2'
                }`}
              >
                <div className={`text-xs font-medium mb-1 ${isCurrentDay ? 'text-accent' : 'text-text-secondary'}`}>
                  {format(date, 'EEE d')}
                </div>
                <div className="space-y-0.5">
                  {dayItems.slice(0, 4).map(item => (
                    <div key={item.id} className="text-xs truncate text-text-tertiary">
                      {item.startTime} {item.title}
                    </div>
                  ))}
                  {dayItems.length > 4 && (
                    <div className="text-xs text-text-muted">+{dayItems.length - 4} more</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {displayItems.length === 0 && (
        <Card className="mt-4">
          <div className="text-center py-6">
            <p className="text-sm text-text-secondary mb-3">No schedule generated for this date.</p>
            {state.preferences && state.tasks.length > 0 && (
              <Button variant="primary" onClick={handleGenerate}>Generate Schedule</Button>
            )}
            {state.tasks.length === 0 && (
              <p className="text-xs text-text-tertiary">Add tasks first to generate a schedule.</p>
            )}
          </div>
        </Card>
      )}

      {warnings.length > 0 && (
        <div className="mt-4 space-y-2">
          {warnings.map((w, i) => (
            <div key={i} className="text-xs text-text-tertiary flex items-center gap-2">
              <span className="text-text-muted">ℹ</span> {w}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
