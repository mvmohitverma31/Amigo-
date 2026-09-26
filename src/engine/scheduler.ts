import type {
  Task,
  FixedCommitment,
  ScheduleItem,
  UserPreferences,
  Conflict,
  ScheduleGenerationResult,
  DayOfWeek,
  Priority,
} from '../types';
import { v4 as uuidv4 } from 'uuid';

interface TimeSlot {
  startMinutes: number; // minutes from midnight
  endMinutes: number;
}

interface ScheduledBlock {
  startMinutes: number;
  endMinutes: number;
  title: string;
  taskId?: string;
  commitmentId?: string;
  isFixed: boolean;
  isLocked: boolean;
  priority: Priority;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getDayOfWeek(dateStr: string): DayOfWeek {
  return new Date(dateStr + 'T00:00:00').getDay() as DayOfWeek;
}

function getAvailableSlots(
  dayStart: number,
  dayEnd: number,
  blockedSlots: TimeSlot[],
  minDuration: number
): TimeSlot[] {
  const sorted = [...blockedSlots].sort((a, b) => a.startMinutes - b.startMinutes);
  const available: TimeSlot[] = [];
  let cursor = dayStart;

  for (const slot of sorted) {
    if (slot.startMinutes > cursor) {
      const gap = slot.startMinutes - cursor;
      if (gap >= minDuration) {
        available.push({ startMinutes: cursor, endMinutes: slot.startMinutes });
      }
    }
    cursor = Math.max(cursor, slot.endMinutes);
  }

  if (dayEnd > cursor) {
    const gap = dayEnd - cursor;
    if (gap >= minDuration) {
      available.push({ startMinutes: cursor, endMinutes: dayEnd });
    }
  }

  return available;
}

function findBestSlot(
  availableSlots: TimeSlot[],
  duration: number,
  preferredTimeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night',
  completionScores?: Map<string, number>
): { slot: TimeSlot; startMinutes: number } | null {
  const validSlots = availableSlots.filter(s => (s.endMinutes - s.startMinutes) >= duration);
  if (validSlots.length === 0) return null;

  // Score each possible start time
  const candidates: { slot: TimeSlot; startMinutes: number; score: number }[] = [];

  for (const slot of validSlots) {
    const maxStart = slot.endMinutes - duration;
    // Try start times in 15-min increments
    for (let start = slot.startMinutes; start <= maxStart; start += 15) {
      let score = 0;

      // Prefer earlier slots (natural flow)
      score += (1440 - start) / 1440 * 10;

      // Time-of-day preference
      if (preferredTimeOfDay) {
        const hour = Math.floor(start / 60);
        if (preferredTimeOfDay === 'morning' && hour >= 6 && hour < 12) score += 20;
        if (preferredTimeOfDay === 'afternoon' && hour >= 12 && hour < 17) score += 20;
        if (preferredTimeOfDay === 'evening' && hour >= 17 && hour < 21) score += 20;
        if (preferredTimeOfDay === 'night' && (hour >= 21 || hour < 6)) score += 20;
      }

      // Completion score boost
      const timeKey = `${Math.floor(start / 60)}:00`;
      if (completionScores?.has(timeKey)) {
        score += (completionScores.get(timeKey) || 0) * 15;
      }

      candidates.push({ slot, startMinutes: start, score });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  return { slot: candidates[0].slot, startMinutes: candidates[0].startMinutes };
}

export function generateSchedule(
  date: string,
  tasks: Task[],
  commitments: FixedCommitment[],
  preferences: UserPreferences,
  completionScores?: Map<string, number>,
  adjustedDurations?: Map<string, number>
): ScheduleGenerationResult {
  const dayOfWeek = getDayOfWeek(date);
  const conflicts: Conflict[] = [];
  const warnings: string[] = [];
  const unscheduledTasks: Task[] = [];

  const dayStart = timeToMinutes(preferences.wakeUpTime);
  const dayEnd = timeToMinutes(preferences.sleepTime);
  const totalAvailable = dayEnd - dayStart;

  // Calculate total required time
  const fixedCommitments = commitments.filter(c => c.daysOfWeek.includes(dayOfWeek));
  const fixedMinutes = fixedCommitments.reduce((sum, c) => {
    return sum + (timeToMinutes(c.endTime) - timeToMinutes(c.startTime));
  }, 0);

  const flexibleTasks = tasks.filter(t => !t.isFixed);
  const taskMinutes = flexibleTasks.reduce((sum, t) => {
    const dur = adjustedDurations?.get(t.id) || t.estimatedDurationMinutes;
    return sum + dur;
  }, 0);

  const breakMinutes = Math.floor(totalAvailable / 120) * preferences.breakDurationMinutes;
  const transitionMinutes = fixedCommitments.length * preferences.transitionBufferMinutes;
  const totalRequired = fixedMinutes + taskMinutes + breakMinutes + transitionMinutes;

  if (totalRequired > totalAvailable) {
    conflicts.push({
      type: 'impossible_schedule',
      items: ['all'],
      message: `Your commitments require approximately ${Math.ceil(totalRequired / 60 * 10) / 10} hours but you have ${Math.ceil(totalAvailable / 60 * 10) / 10} hours available. Consider reducing commitments or adjusting times.`,
      totalRequiredMinutes: totalRequired,
      availableMinutes: totalAvailable,
    });
  }

  // Build blocked slots from fixed commitments
  const blockedSlots: TimeSlot[] = fixedCommitments.map(c => ({
    startMinutes: timeToMinutes(c.startTime),
    endMinutes: timeToMinutes(c.endTime),
  }));

  // Add sleep block (handle midnight crossing)
  if (dayEnd < dayStart) {
    blockedSlots.push({ startMinutes: dayEnd, endMinutes: dayStart + 1440 });
  } else {
    blockedSlots.push({ startMinutes: dayEnd, endMinutes: dayStart + 1440 });
  }

  // Add transition buffers around fixed commitments
  if (preferences.transitionBufferMinutes > 0) {
    for (const c of fixedCommitments) {
      const start = timeToMinutes(c.startTime);
      const end = timeToMinutes(c.endTime);
      blockedSlots.push({
        startMinutes: Math.max(dayStart, start - preferences.transitionBufferMinutes),
        endMinutes: start,
      });
      blockedSlots.push({
        startMinutes: end,
        endMinutes: Math.min(dayEnd, end + preferences.transitionBufferMinutes),
      });
    }
  }

  // Build schedule blocks
  const blocks: ScheduledBlock[] = [];

  // Add fixed commitments first
  for (const c of fixedCommitments) {
    blocks.push({
      startMinutes: timeToMinutes(c.startTime),
      endMinutes: timeToMinutes(c.endTime),
      title: c.title,
      commitmentId: c.id,
      isFixed: true,
      isLocked: c.isLocked,
      priority: 'critical',
    });
  }

  // Sort flexible tasks by priority and deadline
  const sortedTasks = [...flexibleTasks].sort((a, b) => {
    // Critical priority first
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (pDiff !== 0) return pDiff;

    // Then by deadline urgency
    if (a.deadline && b.deadline) {
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    }
    if (a.deadline) return -1;
    if (b.deadline) return 1;

    return 0;
  });

  // Schedule flexible tasks
  let currentBlocked = [...blockedSlots];

  for (const task of sortedTasks) {
    const duration = adjustedDurations?.get(task.id) || task.estimatedDurationMinutes;
    const available = getAvailableSlots(dayStart, dayEnd, currentBlocked, duration);

    if (available.length === 0) {
      unscheduledTasks.push(task);
      warnings.push(`Could not schedule "${task.title}" - no available slot of ${duration} minutes.`);
      continue;
    }

    const best = findBestSlot(available, duration, task.preferredTimeOfDay, completionScores);
    if (!best) {
      unscheduledTasks.push(task);
      continue;
    }

    blocks.push({
      startMinutes: best.startMinutes,
      endMinutes: best.startMinutes + duration,
      title: task.title,
      taskId: task.id,
      isFixed: false,
      isLocked: task.isLocked,
      priority: task.priority,
    });

    // Add this block to blocked slots for next iteration
    currentBlocked.push({
      startMinutes: best.startMinutes,
      endMinutes: best.startMinutes + duration,
    });

    // Add break after if needed
    if (preferences.breakDurationMinutes > 0) {
      currentBlocked.push({
        startMinutes: best.startMinutes + duration,
        endMinutes: best.startMinutes + duration + preferences.breakDurationMinutes,
      });
    }
  }

  // Convert blocks to schedule items
  blocks.sort((a, b) => a.startMinutes - b.startMinutes);
  const items: ScheduleItem[] = blocks.map((block, index) => ({
    id: uuidv4(),
    userId: preferences.userId,
    date,
    taskId: block.taskId,
    commitmentId: block.commitmentId,
    title: block.title,
    startTime: minutesToTime(block.startMinutes),
    endTime: minutesToTime(block.endMinutes),
    durationMinutes: block.endMinutes - block.startMinutes,
    isFixed: block.isFixed,
    isLocked: block.isLocked,
    status: 'pending',
    order: index,
    createdAt: new Date().toISOString(),
  }));

  // Check for overlaps
  for (let i = 0; i < items.length - 1; i++) {
    if (timeToMinutes(items[i].endTime) > timeToMinutes(items[i + 1].startTime)) {
      conflicts.push({
        type: 'overlap',
        items: [items[i].title, items[i + 1].title],
        message: `"${items[i].title}" overlaps with "${items[i + 1].title}".`,
      });
    }
  }

  return { items, conflicts, warnings, unscheduledTasks };
}

export function generateWeekSchedule(
  startDate: string,
  tasks: Task[],
  commitments: FixedCommitment[],
  preferences: UserPreferences,
  completionScores?: Map<string, number>,
  adjustedDurations?: Map<string, number>
): Map<string, ScheduleGenerationResult> {
  const results = new Map<string, ScheduleGenerationResult>();
  const start = new Date(startDate + 'T00:00:00');

  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    const result = generateSchedule(dateStr, tasks, commitments, preferences, completionScores, adjustedDurations);
    results.set(dateStr, result);
  }

  return results;
}

export function rescheduleItem(
  item: ScheduleItem,
  newStartTime: string,
  existingItems: ScheduleItem[]
): { item: ScheduleItem; conflicts: Conflict[] } {
  const newStart = timeToMinutes(newStartTime);
  const newEnd = newStart + item.durationMinutes;
  const conflicts: Conflict[] = [];

  // Check for overlaps with other items
  for (const other of existingItems) {
    if (other.id === item.id) continue;
    const otherStart = timeToMinutes(other.startTime);
    const otherEnd = timeToMinutes(other.endTime);

    if (newStart < otherEnd && newEnd > otherStart) {
      if (other.isLocked || other.isFixed) {
        conflicts.push({
          type: 'overlap',
          items: [item.title, other.title],
          message: `Cannot move "${item.title}" - it conflicts with locked activity "${other.title}".`,
        });
      }
    }
  }

  return {
    item: {
      ...item,
      startTime: newStartTime,
      endTime: minutesToTime(newEnd),
    },
    conflicts,
  };
}

export { timeToMinutes, minutesToTime, getDayOfWeek };
