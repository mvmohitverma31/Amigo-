/**
 * Repository Pattern — Abstracts data access so the UI doesn't care
 * whether data comes from IndexedDB (offline) or HTTP (backend).
 * 
 * Current implementation: IndexedDBRepository
 * Future implementation: HttpRepository (when FastAPI backend is deployed)
 */

import type {
  PreferencesResponse,
  UpdatePreferencesRequest,
  CategoryResponse,
  CreateCategoryRequest,
  TaskResponse,
  CreateTaskRequest,
  UpdateTaskRequest,
  CommitmentResponse,
  CreateCommitmentRequest,
  UpdateCommitmentRequest,
  ScheduleItemResponse,
  UpdateScheduleItemRequest,
  ExecutionResponse,
  InsightResponse,
  AdaptationResponse,
  AnalyticsSummaryResponse,
  CategoryBreakdownResponse,
  TimeWindowScoreResponse,
  HourlyProductivityResponse,
  WeeklyTrendResponse,
  DayOfWeekPerformanceResponse,
  WeeklyReviewResponse,
  DataStatusResponse,
  GenerateScheduleResponse,
} from './contract';

// ============================================================================
// REPOSITORY INTERFACES
// ============================================================================

export interface PreferencesRepository {
  get(): Promise<PreferencesResponse | null>;
  update(data: UpdatePreferencesRequest): Promise<PreferencesResponse>;
}

export interface CategoriesRepository {
  list(): Promise<CategoryResponse[]>;
  create(data: CreateCategoryRequest): Promise<CategoryResponse>;
  delete(id: string): Promise<void>;
}

export interface TasksRepository {
  list(): Promise<TaskResponse[]>;
  create(data: CreateTaskRequest): Promise<TaskResponse>;
  update(id: string, data: UpdateTaskRequest): Promise<TaskResponse>;
  delete(id: string): Promise<void>;
}

export interface CommitmentsRepository {
  list(): Promise<CommitmentResponse[]>;
  create(data: CreateCommitmentRequest): Promise<CommitmentResponse>;
  update(id: string, data: UpdateCommitmentRequest): Promise<CommitmentResponse>;
  delete(id: string): Promise<void>;
}

export interface ScheduleRepository {
  getForDate(date: string): Promise<ScheduleItemResponse[]>;
  getForWeek(startDate: string, endDate: string): Promise<ScheduleItemResponse[]>;
  generate(date: string): Promise<GenerateScheduleResponse>;
  updateItem(id: string, data: UpdateScheduleItemRequest): Promise<ScheduleItemResponse>;
}

export interface ExecutionsRepository {
  listRecent(days: number): Promise<ExecutionResponse[]>;
  listForTask(taskId: string): Promise<ExecutionResponse[]>;
  start(scheduleItemId: string): Promise<ExecutionResponse>;
  complete(scheduleItemId: string): Promise<ExecutionResponse>;
  skip(scheduleItemId: string, reason?: string): Promise<ExecutionResponse>;
  postpone(scheduleItemId: string, reason?: string): Promise<ExecutionResponse>;
}

export interface InsightsRepository {
  list(): Promise<InsightResponse[]>;
}

export interface AdaptationsRepository {
  list(pending?: boolean): Promise<AdaptationResponse[]>;
  apply(id: string): Promise<AdaptationResponse>;
  dismiss(id: string): Promise<void>;
}

export interface AnalyticsRepository {
  getSummary(): Promise<AnalyticsSummaryResponse>;
  getCategoryBreakdown(): Promise<CategoryBreakdownResponse[]>;
  getTimeWindowScores(): Promise<TimeWindowScoreResponse[]>;
  getHourlyProductivity(): Promise<HourlyProductivityResponse[]>;
  getWeeklyTrend(weeks?: number): Promise<WeeklyTrendResponse[]>;
  getDayOfWeekPerformance(): Promise<DayOfWeekPerformanceResponse[]>;
}

export interface WeeklyReviewsRepository {
  getCurrent(): Promise<WeeklyReviewResponse | null>;
  getHistory(limit?: number): Promise<WeeklyReviewResponse[]>;
}

export interface DataStatusRepository {
  getStatus(): Promise<DataStatusResponse>;
}

// ============================================================================
// AGGREGATE REPOSITORY
// ============================================================================

export interface AppRepositories {
  preferences: PreferencesRepository;
  categories: CategoriesRepository;
  tasks: TasksRepository;
  commitments: CommitmentsRepository;
  schedule: ScheduleRepository;
  executions: ExecutionsRepository;
  insights: InsightsRepository;
  adaptations: AdaptationsRepository;
  analytics: AnalyticsRepository;
  weeklyReviews: WeeklyReviewsRepository;
  dataStatus: DataStatusRepository;
}

// ============================================================================
// DATA SOURCE SWITCH
// ============================================================================

/**
 * Returns the appropriate repository set based on configuration.
 * 
 * Currently: IndexedDB (offline-first, single user)
 * When backend is deployed: switch to 'http' and provide the API base URL.
 */
export type DataSource = 'indexeddb' | 'http';

export function getRepositories(source: DataSource, apiBaseUrl?: string): AppRepositories {
  switch (source) {
    case 'indexeddb':
      // Lazy import to avoid bundling IndexedDB code when using HTTP
      return getIndexedDBRepositories();
    case 'http':
      if (!apiBaseUrl) throw new Error('apiBaseUrl required for HTTP data source');
      return getHttpRepositories(apiBaseUrl);
    default:
      throw new Error(`Unknown data source: ${source}`);
  }
}

// Placeholder — will be implemented in src/data/indexeddb/
function getIndexedDBRepositories(): AppRepositories {
  throw new Error('IndexedDB repositories not yet wired. Use the existing AppContext for now.');
}

// Placeholder — will be implemented in src/data/http/
function getHttpRepositories(_apiBaseUrl: string): AppRepositories {
  throw new Error('HTTP repositories not yet implemented. Backend required.');
}
