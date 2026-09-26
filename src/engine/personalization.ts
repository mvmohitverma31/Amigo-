import type {
  TaskExecution,
  BehaviorEvent,
  PersonalizationInsight,
  Adaptation,
  Task,
  DayOfWeek,
} from '../types';
import { v4 as uuidv4 } from 'uuid';

const MIN_SAMPLES_FOR_INSIGHT = 5;
const MIN_SAMPLES_FOR_ML = 10;

interface DurationStats {
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
  sampleSize: number;
}

interface TimeWindowStats {
  hour: number;
  completionRate: number;
  avgDelay: number;
  sampleSize: number;
}

function calculateDurationStats(executions: TaskExecution[]): DurationStats {
  const completed = executions.filter(
    e => e.status === 'completed' && e.actualDurationMinutes != null
  );
  
  if (completed.length === 0) {
    return { mean: 0, median: 0, stdDev: 0, min: 0, max: 0, sampleSize: 0 };
  }

  const durations = completed.map(e => e.actualDurationMinutes!);
  const sorted = [...durations].sort((a, b) => a - b);
  const mean = durations.reduce((a, b) => a + b, 0) / durations.length;
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];
  const variance = durations.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / durations.length;
  const stdDev = Math.sqrt(variance);

  return {
    mean: Math.round(mean),
    median: Math.round(median),
    stdDev: Math.round(stdDev),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    sampleSize: durations.length,
  };
}

function getTimeOfDay(hour: number): 'morning' | 'afternoon' | 'evening' | 'night' {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

function calculateTimeWindowStats(executions: TaskExecution[]): TimeWindowStats[] {
  const hourBuckets = new Map<number, { completed: number; total: number; delays: number[] }>();

  for (const exec of executions) {
    const hour = parseInt(exec.plannedStartTime.split(':')[0]);
    if (!hourBuckets.has(hour)) {
      hourBuckets.set(hour, { completed: 0, total: 0, delays: [] });
    }
    const bucket = hourBuckets.get(hour)!;
    bucket.total++;
    if (exec.status === 'completed') bucket.completed++;
    if (exec.actualStartTime) {
      const plannedMin = parseInt(exec.plannedStartTime.split(':')[0]) * 60 + parseInt(exec.plannedStartTime.split(':')[1]);
      const actualMin = parseInt(exec.actualStartTime.split(':')[0]) * 60 + parseInt(exec.actualStartTime.split(':')[1]);
      const delay = Math.max(0, actualMin - plannedMin);
      bucket.delays.push(delay);
    }
  }

  return Array.from(hourBuckets.entries()).map(([hour, data]) => ({
    hour,
    completionRate: data.total > 0 ? data.completed / data.total : 0,
    avgDelay: data.delays.length > 0 ? data.delays.reduce((a, b) => a + b, 0) / data.delays.length : 0,
    sampleSize: data.total,
  }));
}

export function analyzeBehavior(
  userId: string,
  executions: TaskExecution[],
  tasks: Task[],
  events: BehaviorEvent[]
): { insights: PersonalizationInsight[]; adaptations: Adaptation[] } {
  const insights: PersonalizationInsight[] = [];
  const adaptations: Adaptation[] = [];

  if (executions.length < MIN_SAMPLES_FOR_INSIGHT) {
    return { insights, adaptations };
  }

  // 1. Duration prediction per task
  const taskExecutions = new Map<string, TaskExecution[]>();
  for (const exec of executions) {
    if (!taskExecutions.has(exec.taskId)) {
      taskExecutions.set(exec.taskId, []);
    }
    taskExecutions.get(exec.taskId)!.push(exec);
  }

  for (const [taskId, execs] of taskExecutions) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) continue;

    const stats = calculateDurationStats(execs);
    if (stats.sampleSize >= MIN_SAMPLES_FOR_INSIGHT) {
      const diff = stats.median - task.estimatedDurationMinutes;
      const diffPercent = Math.round((diff / task.estimatedDurationMinutes) * 100);

      if (Math.abs(diffPercent) > 15) {
        const direction = diff > 0 ? 'longer' : 'shorter';
        insights.push({
          id: uuidv4(),
          userId,
          type: 'duration',
          description: `Your ${task.title} sessions average ${stats.median} minutes (${direction} than estimated ${task.estimatedDurationMinutes} min)`,
          data: { taskId, estimated: task.estimatedDurationMinutes, actual: stats.median, diff: diffPercent },
          confidence: Math.min(1, stats.sampleSize / 20),
          sampleSize: stats.sampleSize,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        adaptations.push({
          id: uuidv4(),
          type: 'duration_adjustment',
          taskId,
          description: `Adjust "${task.title}" duration from ${task.estimatedDurationMinutes} to ${stats.median} minutes`,
          reason: `Based on ${stats.sampleSize} observed sessions, your actual duration is ${Math.abs(diffPercent)}% ${direction} than estimated.`,
          confidence: Math.min(1, stats.sampleSize / 20),
          applied: false,
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  // 2. Time-of-day personalization
  const timeStats = calculateTimeWindowStats(executions);
  if (timeStats.length >= 3) {
    const bestWindows = timeStats
      .filter(s => s.sampleSize >= 3)
      .sort((a, b) => b.completionRate - a.completionRate)
      .slice(0, 3);
    
    const worstWindows = timeStats
      .filter(s => s.sampleSize >= 3)
      .sort((a, b) => a.completionRate - b.completionRate)
      .slice(0, 3);

    if (bestWindows.length > 0 && bestWindows[0].completionRate > 0.7) {
      const bestHour = bestWindows[0].hour;
      const timeOfDay = getTimeOfDay(bestHour);
      insights.push({
        id: uuidv4(),
        userId,
        type: 'time_preference',
        description: `You complete tasks most consistently around ${bestHour}:00 (${Math.round(bestWindows[0].completionRate * 100)}% completion rate)`,
        data: { bestHour, timeOfDay, completionRate: bestWindows[0].completionRate },
        confidence: Math.min(1, bestWindows[0].sampleSize / 10),
        sampleSize: bestWindows[0].sampleSize,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    if (worstWindows.length > 0 && worstWindows[0].completionRate < 0.5) {
      const worstHour = worstWindows[0].hour;
      insights.push({
        id: uuidv4(),
        userId,
        type: 'postponement_pattern',
        description: `Tasks scheduled around ${worstHour}:00 have low completion (${Math.round(worstWindows[0].completionRate * 100)}%)`,
        data: { worstHour, completionRate: worstWindows[0].completionRate },
        confidence: Math.min(1, worstWindows[0].sampleSize / 10),
        sampleSize: worstWindows[0].sampleSize,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  // 3. Day-of-week patterns
  const dayStats = new Map<DayOfWeek, { completed: number; total: number }>();
  for (const exec of executions) {
    const day = new Date(exec.date + 'T00:00:00').getDay() as DayOfWeek;
    if (!dayStats.has(day)) dayStats.set(day, { completed: 0, total: 0 });
    const stat = dayStats.get(day)!;
    stat.total++;
    if (exec.status === 'completed') stat.completed++;
  }

  const bestDays = Array.from(dayStats.entries())
    .filter(([, s]) => s.total >= 3)
    .map(([day, s]) => ({ day, rate: s.completed / s.total, total: s.total }))
    .sort((a, b) => b.rate - a.rate);

  if (bestDays.length >= 2) {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    insights.push({
      id: uuidv4(),
      userId,
      type: 'productivity_pattern',
      description: `You're most productive on ${dayNames[bestDays[0].day]}s (${Math.round(bestDays[0].rate * 100)}% completion) and least on ${dayNames[bestDays[bestDays.length - 1].day]}s (${Math.round(bestDays[bestDays.length - 1].rate * 100)}%)`,
      data: { bestDay: bestDays[0].day, worstDay: bestDays[bestDays.length - 1].day },
      confidence: Math.min(1, bestDays[0].total / 10),
      sampleSize: bestDays[0].total,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  // 4. Category-specific patterns
  const categoryExecutions = new Map<string, TaskExecution[]>();
  for (const exec of executions) {
    const task = tasks.find(t => t.id === exec.taskId);
    if (!task?.categoryId) continue;
    if (!categoryExecutions.has(task.categoryId)) {
      categoryExecutions.set(task.categoryId, []);
    }
    categoryExecutions.get(task.categoryId)!.push(exec);
  }

  for (const [catId, execs] of categoryExecutions) {
    const catTimeStats = calculateTimeWindowStats(execs);
    if (catTimeStats.length >= 2) {
      const bestCatTime = catTimeStats
        .filter(s => s.sampleSize >= 2)
        .sort((a, b) => b.completionRate - a.completionRate)[0];
      
      if (bestCatTime && bestCatTime.completionRate > 0.7) {
        insights.push({
          id: uuidv4(),
          userId,
          type: 'completion_pattern',
          description: `Category tasks complete best around ${bestCatTime.hour}:00`,
          data: { categoryId: catId, bestHour: bestCatTime.hour },
          confidence: Math.min(1, bestCatTime.sampleSize / 8),
          sampleSize: bestCatTime.sampleSize,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }

  // 5. Postponement analysis
  const postponedExecs = executions.filter(e => e.status === 'postponed');
  if (postponedExecs.length >= 3) {
    const postponedByTask = new Map<string, number>();
    for (const exec of postponedExecs) {
      postponedByTask.set(exec.taskId, (postponedByTask.get(exec.taskId) || 0) + 1);
    }
    
    const mostPostponed = Array.from(postponedByTask.entries())
      .sort((a, b) => b[1] - a[1])[0];
    
    if (mostPostponed && mostPostponed[1] >= 3) {
      const task = tasks.find(t => t.id === mostPostponed[0]);
      if (task) {
        insights.push({
          id: uuidv4(),
          userId,
          type: 'postponement_pattern',
          description: `"${task.title}" is frequently postponed (${mostPostponed[1]} times). Consider breaking it into smaller tasks or rescheduling.`,
          data: { taskId: task.id, postponementCount: mostPostponed[1] },
          confidence: Math.min(1, mostPostponed[1] / 5),
          sampleSize: mostPostponed[1],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }

  return { insights, adaptations };
}

export function getAdjustedDurations(
  tasks: Task[],
  executions: TaskExecution[]
): Map<string, number> {
  const adjusted = new Map<string, number>();

  const taskExecutions = new Map<string, TaskExecution[]>();
  for (const exec of executions) {
    if (!taskExecutions.has(exec.taskId)) {
      taskExecutions.set(exec.taskId, []);
    }
    taskExecutions.get(exec.taskId)!.push(exec);
  }

  for (const task of tasks) {
    const execs = taskExecutions.get(task.id);
    if (!execs || execs.length < MIN_SAMPLES_FOR_INSIGHT) {
      adjusted.set(task.id, task.estimatedDurationMinutes);
      continue;
    }

    const stats = calculateDurationStats(execs);
    if (stats.sampleSize >= MIN_SAMPLES_FOR_INSIGHT && stats.median > 0) {
      // Use weighted average: 60% observed, 40% estimated
      const weighted = Math.round(stats.median * 0.6 + task.estimatedDurationMinutes * 0.4);
      adjusted.set(task.id, weighted);
    } else {
      adjusted.set(task.id, task.estimatedDurationMinutes);
    }
  }

  return adjusted;
}

export function getCompletionScores(executions: TaskExecution[]): Map<string, number> {
  const scores = new Map<string, number>();
  const hourStats = new Map<number, { completed: number; total: number }>();

  for (const exec of executions) {
    const hour = parseInt(exec.plannedStartTime.split(':')[0]);
    if (!hourStats.has(hour)) {
      hourStats.set(hour, { completed: 0, total: 0 });
    }
    const stat = hourStats.get(hour)!;
    stat.total++;
    if (exec.status === 'completed') stat.completed++;
  }

  for (const [hour, stat] of hourStats) {
    if (stat.total >= 3) {
      scores.set(`${hour}:00`, stat.completed / stat.total);
    }
  }

  return scores;
}

export function hasEnoughData(executions: TaskExecution[]): boolean {
  return executions.length >= MIN_SAMPLES_FOR_ML;
}

export function getDataStatus(executions: TaskExecution[]): {
  level: 'cold_start' | 'early' | 'developing' | 'mature';
  message: string;
  percentage: number;
} {
  const count = executions.length;
  if (count < 5) return { level: 'cold_start', message: 'Not enough data yet. Using rule-based scheduling.', percentage: Math.min(100, count * 10) };
  if (count < 15) return { level: 'early', message: 'Learning your patterns. Some personalization active.', percentage: Math.min(100, 10 + count * 3) };
  if (count < 40) return { level: 'developing', message: 'Good data collected. Personalization improving.', percentage: Math.min(100, 30 + count) };
  return { level: 'mature', message: 'Strong behavioral data. Full personalization active.', percentage: 100 };
}
