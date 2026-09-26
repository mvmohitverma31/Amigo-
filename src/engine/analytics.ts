import type {
  TaskExecution,
  Task,
  TaskCategory,
  CategoryBreakdown,
  TimeWindowScore,
} from '../types';

export interface AnalyticsSummary {
  totalPlannedMinutes: number;
  totalCompletedMinutes: number;
  completionRate: number;
  averageDelayMinutes: number;
  averageDurationDeviation: number;
  totalTasks: number;
  completedTasks: number;
  skippedTasks: number;
  postponedTasks: number;
  streakDays: number;
}

export function computeAnalyticsSummary(executions: TaskExecution[]): AnalyticsSummary {
  if (executions.length === 0) {
    return {
      totalPlannedMinutes: 0,
      totalCompletedMinutes: 0,
      completionRate: 0,
      averageDelayMinutes: 0,
      averageDurationDeviation: 0,
      totalTasks: 0,
      completedTasks: 0,
      skippedTasks: 0,
      postponedTasks: 0,
      streakDays: 0,
    };
  }

  const completed = executions.filter(e => e.status === 'completed');
  const skipped = executions.filter(e => e.status === 'skipped');
  const postponed = executions.filter(e => e.status === 'postponed');

  const totalPlanned = executions.reduce((sum, e) => sum + e.plannedDurationMinutes, 0);
  const totalCompleted = completed.reduce((sum, e) => sum + (e.actualDurationMinutes || e.plannedDurationMinutes), 0);

  // Average delay
  const delays = completed
    .filter(e => e.actualStartTime)
    .map(e => {
      const planned = parseInt(e.plannedStartTime.split(':')[0]) * 60 + parseInt(e.plannedStartTime.split(':')[1]);
      const actual = parseInt(e.actualStartTime!.split(':')[0]) * 60 + parseInt(e.actualStartTime!.split(':')[1]);
      return Math.max(0, actual - planned);
    });
  const avgDelay = delays.length > 0 ? delays.reduce((a, b) => a + b, 0) / delays.length : 0;

  // Duration deviation
  const deviations = completed
    .filter(e => e.actualDurationMinutes != null)
    .map(e => Math.abs(e.actualDurationMinutes! - e.plannedDurationMinutes));
  const avgDeviation = deviations.length > 0 ? deviations.reduce((a, b) => a + b, 0) / deviations.length : 0;

  // Streak calculation
  const dates = [...new Set(completed.map(e => e.date))].sort().reverse();
  let streak = 0;
  const today = new Date().toISOString().split('T')[0];
  const checkDate = new Date(today + 'T00:00:00');
  
  for (const date of dates) {
    const expected = checkDate.toISOString().split('T')[0];
    if (date === expected) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return {
    totalPlannedMinutes: totalPlanned,
    totalCompletedMinutes: totalCompleted,
    completionRate: executions.length > 0 ? completed.length / executions.length : 0,
    averageDelayMinutes: Math.round(avgDelay),
    averageDurationDeviation: Math.round(avgDeviation),
    totalTasks: executions.length,
    completedTasks: completed.length,
    skippedTasks: skipped.length,
    postponedTasks: postponed.length,
    streakDays: streak,
  };
}

export function computeCategoryBreakdown(
  executions: TaskExecution[],
  tasks: Task[],
  categories: TaskCategory[]
): CategoryBreakdown[] {
  const catMap = new Map<string, { planned: number; completed: number; count: number }>();

  for (const exec of executions) {
    const task = tasks.find(t => t.id === exec.taskId);
    if (!task?.categoryId) continue;

    if (!catMap.has(task.categoryId)) {
      catMap.set(task.categoryId, { planned: 0, completed: 0, count: 0 });
    }
    const cat = catMap.get(task.categoryId)!;
    cat.planned += exec.plannedDurationMinutes;
    cat.count++;
    if (exec.status === 'completed') {
      cat.completed += exec.actualDurationMinutes || exec.plannedDurationMinutes;
    }
  }

  return Array.from(catMap.entries()).map(([catId, data]) => {
    const category = categories.find(c => c.id === catId);
    return {
      categoryId: catId,
      categoryName: category?.name || 'Uncategorized',
      plannedMinutes: data.planned,
      completedMinutes: data.completed,
      completionRate: data.count > 0 ? data.completed / data.planned : 0,
    };
  });
}

export function computeTimeWindowScores(executions: TaskExecution[]): TimeWindowScore[] {
  const windows = new Map<string, { completed: number; total: number; delays: number[] }>();

  for (const exec of executions) {
    const startHour = parseInt(exec.plannedStartTime.split(':')[0]);
    const windowStart = Math.floor(startHour / 2) * 2;
    const windowKey = `${String(windowStart).padStart(2, '0')}:00-${String(windowStart + 2).padStart(2, '0')}:00`;

    if (!windows.has(windowKey)) {
      windows.set(windowKey, { completed: 0, total: 0, delays: [] });
    }
    const w = windows.get(windowKey)!;
    w.total++;
    if (exec.status === 'completed') w.completed++;

    if (exec.actualStartTime) {
      const plannedMin = parseInt(exec.plannedStartTime.split(':')[0]) * 60 + parseInt(exec.plannedStartTime.split(':')[1]);
      const actualMin = parseInt(exec.actualStartTime.split(':')[0]) * 60 + parseInt(exec.actualStartTime.split(':')[1]);
      w.delays.push(Math.max(0, actualMin - plannedMin));
    }
  }

  return Array.from(windows.entries()).map(([window, data]) => ({
    timeWindow: window,
    completionRate: data.total > 0 ? data.completed / data.total : 0,
    averageDelayMinutes: data.delays.length > 0 ? Math.round(data.delays.reduce((a, b) => a + b, 0) / data.delays.length) : 0,
    sampleSize: data.total,
  })).sort((a, b) => a.timeWindow.localeCompare(b.timeWindow));
}

export function computeHourlyProductivity(executions: TaskExecution[]): { hour: number; rate: number; count: number }[] {
  const hourData = new Map<number, { completed: number; total: number }>();

  for (const exec of executions) {
    const hour = parseInt(exec.plannedStartTime.split(':')[0]);
    if (!hourData.has(hour)) hourData.set(hour, { completed: 0, total: 0 });
    const data = hourData.get(hour)!;
    data.total++;
    if (exec.status === 'completed') data.completed++;
  }

  return Array.from(hourData.entries())
    .map(([hour, data]) => ({
      hour,
      rate: data.total > 0 ? data.completed / data.total : 0,
      count: data.total,
    }))
    .sort((a, b) => a.hour - b.hour);
}

export function computeWeeklyTrend(
  executions: TaskExecution[],
  weeks: number = 4
): { week: string; completionRate: number; totalMinutes: number }[] {
  const now = new Date();
  const trend: { week: string; completionRate: number; totalMinutes: number }[] = [];

  for (let w = weeks - 1; w >= 0; w--) {
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() - w * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const startStr = weekStart.toISOString().split('T')[0];
    const endStr = weekEnd.toISOString().split('T')[0];

    const weekExecs = executions.filter(e => e.date >= startStr && e.date <= endStr);
    const completed = weekExecs.filter(e => e.status === 'completed');
    const totalMin = completed.reduce((sum, e) => sum + (e.actualDurationMinutes || e.plannedDurationMinutes), 0);

    trend.push({
      week: `Week ${weeks - w}`,
      completionRate: weekExecs.length > 0 ? completed.length / weekExecs.length : 0,
      totalMinutes: totalMin,
    });
  }

  return trend;
}

export function computeDayOfWeekPerformance(executions: TaskExecution[]): { day: string; rate: number; count: number }[] {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayData = new Map<number, { completed: number; total: number }>();

  for (const exec of executions) {
    const day = new Date(exec.date + 'T00:00:00').getDay();
    if (!dayData.has(day)) dayData.set(day, { completed: 0, total: 0 });
    const data = dayData.get(day)!;
    data.total++;
    if (exec.status === 'completed') data.completed++;
  }

  return Array.from(dayData.entries())
    .map(([day, data]) => ({
      day: dayNames[day],
      rate: data.total > 0 ? data.completed / data.total : 0,
      count: data.total,
    }))
    .sort((a, b) => dayNames.indexOf(a.day) - dayNames.indexOf(b.day));
}
