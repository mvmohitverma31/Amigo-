// Core domain types for Amigo Adaptive Personal Scheduler

export type Priority = 'critical' | 'high' | 'medium' | 'low';
export type TaskStatus = 'pending' | 'active' | 'paused' | 'completed' | 'skipped' | 'postponed';
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Sunday

export interface UserPreferences {
  id: string;
  userId: string;
  wakeUpTime: string; // HH:mm
  sleepTime: string; // HH:mm
  preferredProductivityWindows: string[]; // e.g., ["morning", "evening"]
  breakDurationMinutes: number;
  transitionBufferMinutes: number;
  maxConsecutiveWorkMinutes: number;
  personalizationEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TaskCategory {
  id: string;
  userId: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  description?: string;
  categoryId?: string;
  estimatedDurationMinutes: number;
  priority: Priority;
  isFixed: boolean;
  isLocked: boolean;
  isRecurring: boolean;
  recurrencePattern?: RecurrencePattern;
  deadline?: string; // ISO date
  preferredTimeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
  createdAt: string;
  updatedAt: string;
}

export interface RecurrencePattern {
  frequency: 'daily' | 'weekly' | 'custom';
  daysOfWeek?: DayOfWeek[];
  interval?: number;
}

export interface FixedCommitment {
  id: string;
  userId: string;
  title: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  daysOfWeek: DayOfWeek[];
  isLocked: boolean;
  categoryId?: string;
  createdAt: string;
}

export interface ScheduleItem {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  taskId?: string;
  commitmentId?: string;
  title: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  durationMinutes: number;
  isFixed: boolean;
  isLocked: boolean;
  status: TaskStatus;
  order: number;
  createdAt: string;
}

export interface TaskExecution {
  id: string;
  userId: string;
  scheduleItemId: string;
  taskId: string;
  date: string;
  plannedStartTime: string;
  plannedEndTime: string;
  plannedDurationMinutes: number;
  actualStartTime?: string;
  actualEndTime?: string;
  actualDurationMinutes?: number;
  status: TaskStatus;
  skipReason?: SkipReason;
  postponementCount: number;
  isManualOverride: boolean;
  createdAt: string;
  updatedAt: string;
}

export type SkipReason = 
  | 'too_tired'
  | 'took_longer'
  | 'didnt_feel_like_it'
  | 'unexpected_event'
  | 'schedule_unrealistic'
  | 'higher_priority'
  | 'other';

export interface BehaviorEvent {
  id: string;
  userId: string;
  date: string;
  eventType: 'completion' | 'skip' | 'postpone' | 'start_delay' | 'duration_deviation' | 'manual_override';
  taskId?: string;
  categoryId?: string;
  timeOfDay: string; // "morning" | "afternoon" | "evening" | "night"
  dayOfWeek: DayOfWeek;
  metadata: Record<string, string | number | boolean>;
  createdAt: string;
}

export interface WeeklyReview {
  id: string;
  userId: string;
  weekStartDate: string; // Monday
  weekEndDate: string; // Sunday
  totalPlannedMinutes: number;
  totalCompletedMinutes: number;
  completionRate: number;
  averageDelayMinutes: number;
  categoryBreakdown: CategoryBreakdown[];
  bestTimeWindows: TimeWindowScore[];
  worstTimeWindows: TimeWindowScore[];
  frequentlyPostponedTasks: string[];
  frequentlySkippedTasks: string[];
  adaptations: Adaptation[];
  createdAt: string;
}

export interface CategoryBreakdown {
  categoryId: string;
  categoryName: string;
  plannedMinutes: number;
  completedMinutes: number;
  completionRate: number;
}

export interface TimeWindowScore {
  timeWindow: string; // e.g., "07:00-09:00"
  completionRate: number;
  averageDelayMinutes: number;
  sampleSize: number;
}

export interface Adaptation {
  id: string;
  type: 'time_shift' | 'duration_adjustment' | 'frequency_change' | 'priority_adjustment' | 'buffer_addition';
  taskId?: string;
  description: string;
  reason: string;
  confidence: number; // 0-1
  applied: boolean;
  createdAt: string;
}

export interface PersonalizationInsight {
  id: string;
  userId: string;
  type: 'duration' | 'time_preference' | 'completion_pattern' | 'postponement_pattern' | 'productivity_pattern';
  description: string;
  data: Record<string, any>;
  confidence: number;
  sampleSize: number;
  createdAt: string;
  updatedAt: string;
}

export interface Conflict {
  type: 'overlap' | 'insufficient_time' | 'sleep_violation' | 'impossible_schedule';
  items: string[];
  message: string;
  totalRequiredMinutes?: number;
  availableMinutes?: number;
}

export interface ScheduleGenerationResult {
  items: ScheduleItem[];
  conflicts: Conflict[];
  warnings: string[];
  unscheduledTasks: Task[];
}
