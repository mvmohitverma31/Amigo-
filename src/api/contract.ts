/**
 * API Contract — defines the exact shape of every endpoint the backend will expose.
 * 
 * This file serves as the "contract" between frontend and backend.
 * When the FastAPI backend is built, its Pydantic schemas must produce
 * JSON that matches these TypeScript interfaces exactly.
 * 
 * The frontend uses a Repository pattern:
 *   - IndexedDBRepository (current, offline-first)
 *   - HttpRepository (future, talks to FastAPI)
 * 
 * Both implement the same interface, so UI code doesn't change.
 */

// ============================================================================
// AUTH
// ============================================================================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  displayName?: string;
}

export interface AuthResponse {
  accessToken: string;
  user: UserPublic;
}

export interface UserPublic {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
}

export interface TokenRefreshResponse {
  accessToken: string;
}

// ============================================================================
// PREFERENCES
// ============================================================================

export interface PreferencesResponse {
  id: string;
  userId: string;
  wakeUpTime: string;       // HH:mm
  sleepTime: string;        // HH:mm
  timezone: string;
  breakDurationMinutes: number;
  transitionBufferMinutes: number;
  maxConsecutiveWorkMinutes: number;
  personalizationEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdatePreferencesRequest {
  wakeUpTime?: string;
  sleepTime?: string;
  timezone?: string;
  breakDurationMinutes?: number;
  transitionBufferMinutes?: number;
  maxConsecutiveWorkMinutes?: number;
  personalizationEnabled?: boolean;
}

// ============================================================================
// CATEGORIES
// ============================================================================

export interface CategoryResponse {
  id: string;
  userId: string;
  name: string;
  color: string;
  position: number;
  createdAt: string;
}

export interface CreateCategoryRequest {
  name: string;
  color: string;
}

// ============================================================================
// TASKS
// ============================================================================

export interface TaskResponse {
  id: string;
  userId: string;
  categoryId: string | null;
  title: string;
  description: string | null;
  estimatedDurationMinutes: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  isFixed: boolean;
  isLocked: boolean;
  isRecurring: boolean;
  recurrenceFrequency: 'daily' | 'weekly' | 'custom' | null;
  recurrenceDays: number[] | null;
  recurrenceInterval: number | null;
  preferredTimeOfDay: 'morning' | 'afternoon' | 'evening' | 'night' | null;
  deadline: string | null;  // ISO date
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskRequest {
  categoryId?: string;
  title: string;
  description?: string;
  estimatedDurationMinutes: number;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  isFixed?: boolean;
  isLocked?: boolean;
  isRecurring?: boolean;
  recurrenceFrequency?: 'daily' | 'weekly' | 'custom';
  recurrenceDays?: number[];
  recurrenceInterval?: number;
  preferredTimeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
  deadline?: string;
}

export interface UpdateTaskRequest extends Partial<CreateTaskRequest> {}

// ============================================================================
// COMMITMENTS
// ============================================================================

export interface CommitmentResponse {
  id: string;
  userId: string;
  categoryId: string | null;
  title: string;
  startTime: string;  // HH:mm
  endTime: string;    // HH:mm
  daysOfWeek: number[];
  isLocked: boolean;
  location: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCommitmentRequest {
  categoryId?: string;
  title: string;
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
  isLocked?: boolean;
  location?: string;
  notes?: string;
}

export interface UpdateCommitmentRequest extends Partial<CreateCommitmentRequest> {}

// ============================================================================
// SCHEDULE
// ============================================================================

export interface ScheduleItemResponse {
  id: string;
  userId: string;
  date: string;         // YYYY-MM-DD
  taskId: string | null;
  commitmentId: string | null;
  title: string;
  startTime: string;    // HH:mm
  endTime: string;      // HH:mm
  durationMinutes: number;
  isFixed: boolean;
  isLocked: boolean;
  status: 'pending' | 'active' | 'paused' | 'completed' | 'skipped' | 'postponed';
  sortOrder: number;
  generatedBy: 'rule' | 'personalized' | 'ml' | 'manual';
  createdAt: string;
  updatedAt: string;
}

export interface GenerateScheduleRequest {
  date: string;  // YYYY-MM-DD
}

export interface GenerateScheduleResponse {
  items: ScheduleItemResponse[];
  conflicts: ConflictResponse[];
  warnings: string[];
  unscheduledTaskIds: string[];
}

export interface ConflictResponse {
  type: 'overlap' | 'insufficient_time' | 'sleep_violation' | 'impossible_schedule';
  items: string[];
  message: string;
  totalRequiredMinutes?: number;
  availableMinutes?: number;
}

export interface UpdateScheduleItemRequest {
  startTime?: string;
  endTime?: string;
  status?: 'pending' | 'active' | 'paused' | 'completed' | 'skipped' | 'postponed';
  isLocked?: boolean;
}

// ============================================================================
// EXECUTIONS
// ============================================================================

export interface ExecutionResponse {
  id: string;
  userId: string;
  scheduleItemId: string | null;
  taskId: string;
  date: string;
  plannedStartTime: string;
  plannedEndTime: string;
  plannedDurationMinutes: number;
  actualStartTime: string | null;
  actualEndTime: string | null;
  actualDurationMinutes: number | null;
  status: 'pending' | 'active' | 'paused' | 'completed' | 'skipped' | 'postponed';
  skipReason: string | null;
  postponementCount: number;
  isManualOverride: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StartExecutionRequest {
  scheduleItemId: string;
}

export interface CompleteExecutionRequest {
  scheduleItemId: string;
}

export interface SkipExecutionRequest {
  scheduleItemId: string;
  reason?: 'too_tired' | 'took_longer' | 'didnt_feel_like_it' |
           'unexpected_event' | 'schedule_unrealistic' | 'higher_priority' | 'other';
}

export interface PostponeExecutionRequest {
  scheduleItemId: string;
  reason?: 'too_tired' | 'took_longer' | 'didnt_feel_like_it' |
           'unexpected_event' | 'schedule_unrealistic' | 'higher_priority' | 'other';
}

// ============================================================================
// ANALYTICS
// ============================================================================

export interface AnalyticsSummaryResponse {
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

export interface CategoryBreakdownResponse {
  categoryId: string;
  categoryName: string;
  plannedMinutes: number;
  completedMinutes: number;
  completionRate: number;
}

export interface TimeWindowScoreResponse {
  timeWindow: string;
  completionRate: number;
  averageDelayMinutes: number;
  sampleSize: number;
}

export interface HourlyProductivityResponse {
  hour: number;
  rate: number;
  count: number;
}

export interface WeeklyTrendResponse {
  week: string;
  completionRate: number;
  totalMinutes: number;
}

export interface DayOfWeekPerformanceResponse {
  day: string;
  rate: number;
  count: number;
}

// ============================================================================
// INSIGHTS & ADAPTATIONS
// ============================================================================

export interface InsightResponse {
  id: string;
  userId: string;
  insightType: string;
  description: string;
  data: Record<string, unknown>;
  confidence: number;
  sampleSize: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdaptationResponse {
  id: string;
  userId: string;
  adaptationType: string;
  taskId: string | null;
  description: string;
  reason: string;
  confidence: number;
  isApplied: boolean;
  isDismissed: boolean;
  createdAt: string;
}

export interface ApplyAdaptationRequest {
  adaptationId: string;
}

// ============================================================================
// WEEKLY REVIEW
// ============================================================================

export interface WeeklyReviewResponse {
  id: string;
  userId: string;
  weekStartDate: string;
  weekEndDate: string;
  totalPlannedMinutes: number;
  totalCompletedMinutes: number;
  completionRate: number;
  averageDelayMinutes: number;
  totalTasks: number;
  completedTasks: number;
  categoryBreakdown: CategoryBreakdownResponse[];
  bestTimeWindows: TimeWindowScoreResponse[];
  worstTimeWindows: TimeWindowScoreResponse[];
  dayOfWeekPerformance: DayOfWeekPerformanceResponse[];
  frequentlyPostponed: string[];
  frequentlySkipped: string[];
  createdAt: string;
}

// ============================================================================
// NATURAL LANGUAGE
// ============================================================================

export interface NLParseRequest {
  input: string;
}

export interface NLParseResponse {
  wakeUpTime: string | null;
  sleepTime: string | null;
  commitments: ParsedCommitmentResponse[];
  ambiguities: string[];
}

export interface ParsedCommitmentResponse {
  title: string;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number | null;
  isFixed: boolean;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night' | null;
}

// ============================================================================
// DATA STATUS
// ============================================================================

export interface DataStatusResponse {
  level: 'cold_start' | 'early' | 'developing' | 'mature';
  message: string;
  percentage: number;
  totalDataPoints: number;
}

// ============================================================================
// ERROR RESPONSES
// ============================================================================

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// Standard error codes:
// - 'unauthorized': No valid token
// - 'forbidden': Token valid but no permission
// - 'not_found': Resource doesn't exist (or doesn't belong to user)
// - 'validation_error': Input failed schema validation
// - 'conflict': Schedule conflict, overlap, impossible constraint
// - 'rate_limited': Too many requests
// - 'internal_error': Server error (never expose details to client)
