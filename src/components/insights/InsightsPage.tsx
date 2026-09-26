import React, { useEffect, useMemo } from 'react';
import { useApp } from '../../store/AppContext';
import { Card, Badge, Button, EmptyState, Metric } from '../ui';
import { analyzeBehavior, getAdjustedDurations, getDataStatus, hasEnoughData } from '../../engine/personalization';
import { computeAnalyticsSummary } from '../../engine/analytics';
import { db } from '../../db';
import { v4 as uuidv4 } from 'uuid';
import { CURRENT_USER_ID } from '../../store/AppContext';

export function InsightsPage() {
  const { state, dispatch } = useApp();
  const { executions, tasks, insights, adaptations } = state;

  const dataStatus = useMemo(() => getDataStatus(executions), [executions]);
  const summary = useMemo(() => computeAnalyticsSummary(executions), [executions]);

  // Analyze and generate insights
  useEffect(() => {
    if (executions.length >= 5 && state.preferences?.personalizationEnabled) {
      const { insights: newInsights, adaptations: newAdaptations } = analyzeBehavior(
        CURRENT_USER_ID,
        executions,
        tasks,
        state.behaviorEvents
      );

      // Store new insights (avoid duplicates by checking descriptions)
      const existingDescriptions = new Set(insights.map(i => i.description));
      for (const insight of newInsights) {
        if (!existingDescriptions.has(insight.description)) {
          db.personalizationInsights.put(insight);
          dispatch({ type: 'ADD_INSIGHT', payload: insight });
        }
      }

      const existingAdaptations = new Set(adaptations.map(a => a.description));
      for (const adaptation of newAdaptations) {
        if (!existingAdaptations.has(adaptation.description)) {
          db.adaptations.put(adaptation);
          dispatch({ type: 'ADD_ADAPTATION', payload: adaptation });
        }
      }
    }
  }, [executions.length]);

  const pendingAdaptations = adaptations.filter(a => !a.applied);
  const appliedAdaptations = adaptations.filter(a => a.applied);

  const handleApplyAdaptation = async (adaptationId: string) => {
    const adaptation = adaptations.find(a => a.id === adaptationId);
    if (!adaptation) return;

    // Apply the adaptation
    if (adaptation.taskId && adaptation.type === 'duration_adjustment') {
      const task = tasks.find(t => t.id === adaptation.taskId);
      if (task) {
        const match = adaptation.description.match(/to (\d+) minutes/);
        if (match) {
          const newDuration = parseInt(match[1]);
          const updatedTask = { ...task, estimatedDurationMinutes: newDuration, updatedAt: new Date().toISOString() };
          await db.tasks.put(updatedTask);
          dispatch({ type: 'UPDATE_TASK', payload: updatedTask });
        }
      }
    }

    // Mark as applied
    const updated = { ...adaptation, applied: true };
    await db.adaptations.put(updated);
    dispatch({ type: 'UPDATE_ADAPTATION', payload: updated });
  };

  const handleDismissAdaptation = async (adaptationId: string) => {
    await db.adaptations.delete(adaptationId);
    dispatch({
      type: 'SET_ADAPTATIONS',
      payload: adaptations.filter(a => a.id !== adaptationId),
    });
  };

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-lg font-semibold text-text-primary">Adaptation Center</h1>
        <p className="text-sm text-text-secondary mt-0.5">
          What the system has learned from your behavior
        </p>
      </header>

      {/* Data Status */}
      <Card className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-medium text-text-primary">Learning Status</h2>
            <p className="text-xs text-text-secondary mt-0.5">{dataStatus.message}</p>
          </div>
          <Badge variant={dataStatus.level === 'mature' ? 'success' : dataStatus.level === 'developing' ? 'accent' : dataStatus.level === 'early' ? 'warning' : 'default'}>
            {dataStatus.level.replace('_', ' ')}
          </Badge>
        </div>
        <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-500"
            style={{ width: `${dataStatus.percentage}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-text-tertiary">
          <span>{executions.length} data points</span>
          <span>{dataStatus.percentage}% confidence</span>
        </div>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <Metric label="Completion" value={`${Math.round(summary.completionRate * 100)}%`} />
        </Card>
        <Card>
          <Metric label="Tasks Done" value={summary.completedTasks} />
        </Card>
        <Card>
          <Metric label="Skipped" value={summary.skippedTasks} />
        </Card>
        <Card>
          <Metric label="Postponed" value={summary.postponedTasks} />
        </Card>
      </div>

      {/* Insights */}
      <div className="mb-6">
        <h2 className="text-sm font-medium text-text-primary mb-3">What I Learned</h2>
        {insights.length > 0 ? (
          <div className="space-y-2">
            {insights.sort((a, b) => b.confidence - a.confidence).map(insight => (
              <Card key={insight.id} className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-accent mt-1.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-text-primary">{insight.description}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-text-tertiary">
                      Confidence: {Math.round(insight.confidence * 100)}%
                    </span>
                    <span className="text-xs text-text-muted">·</span>
                    <span className="text-xs text-text-tertiary">
                      {insight.sampleSize} samples
                    </span>
                    <span className="text-xs text-text-muted">·</span>
                    <span className="text-xs text-text-tertiary">
                      {insight.type.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <p className="text-sm text-text-tertiary text-center py-4">
              {executions.length < 5
                ? 'Not enough data to generate insights yet. Complete more tasks.'
                : 'No significant patterns detected yet. Keep using the scheduler.'}
            </p>
          </Card>
        )}
      </div>

      {/* Pending Adaptations */}
      <div className="mb-6">
        <h2 className="text-sm font-medium text-text-primary mb-3">
          Suggested Changes
          {pendingAdaptations.length > 0 && (
            <Badge variant="accent" className="ml-2">{pendingAdaptations.length}</Badge>
          )}
        </h2>
        {pendingAdaptations.length > 0 ? (
          <div className="space-y-2">
            {pendingAdaptations.map(adaptation => (
              <Card key={adaptation.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm text-text-primary">{adaptation.description}</p>
                    <p className="text-xs text-text-secondary mt-1">{adaptation.reason}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-text-tertiary">
                        Confidence: {Math.round(adaptation.confidence * 100)}%
                      </span>
                      <Badge variant={adaptation.confidence > 0.7 ? 'success' : 'warning'}>
                        {adaptation.type.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="primary" onClick={() => handleApplyAdaptation(adaptation.id)}>
                      Apply
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDismissAdaptation(adaptation.id)}>
                      Dismiss
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <p className="text-sm text-text-tertiary text-center py-4">
              {executions.length < 5
                ? 'Not enough data to suggest changes yet.'
                : 'No pending suggestions. The schedule is working well for you.'}
            </p>
          </Card>
        )}
      </div>

      {/* Applied Adaptations */}
      {appliedAdaptations.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-text-primary mb-3">Applied Changes</h2>
          <div className="space-y-2">
            {appliedAdaptations.slice(0, 5).map(adaptation => (
              <div key={adaptation.id} className="flex items-center gap-2 px-3 py-2 rounded bg-surface-2">
                <span className="text-success text-xs">✓</span>
                <span className="text-sm text-text-secondary">{adaptation.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
