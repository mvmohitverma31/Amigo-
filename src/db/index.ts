import Dexie, { type Table } from 'dexie';
import type {
  UserPreferences,
  TaskCategory,
  Task,
  FixedCommitment,
  ScheduleItem,
  TaskExecution,
  BehaviorEvent,
  WeeklyReview,
  PersonalizationInsight,
  Adaptation,
} from '../types';

export class AmigoDatabase extends Dexie {
  userPreferences!: Table<UserPreferences, string>;
  taskCategories!: Table<TaskCategory, string>;
  tasks!: Table<Task, string>;
  fixedCommitments!: Table<FixedCommitment, string>;
  scheduleItems!: Table<ScheduleItem, string>;
  taskExecutions!: Table<TaskExecution, string>;
  behaviorEvents!: Table<BehaviorEvent, string>;
  weeklyReviews!: Table<WeeklyReview, string>;
  personalizationInsights!: Table<PersonalizationInsight, string>;
  adaptations!: Table<Adaptation, string>;

  constructor() {
    super('amigo_db');
    this.version(1).stores({
      userPreferences: 'id, userId',
      taskCategories: 'id, userId',
      tasks: 'id, userId, categoryId, priority, isRecurring, deadline',
      fixedCommitments: 'id, userId, categoryId',
      scheduleItems: 'id, userId, date, taskId, commitmentId, status',
      taskExecutions: 'id, userId, taskId, scheduleItemId, date, status',
      behaviorEvents: 'id, userId, date, taskId, categoryId, eventType',
      weeklyReviews: 'id, userId, weekStartDate',
      personalizationInsights: 'id, userId, type',
      adaptations: 'id, userId, taskId, type, applied',
    });
  }
}

export const db = new AmigoDatabase();

// Helper functions for common queries
export const dbHelpers = {
  async getUserPreferences(userId: string): Promise<UserPreferences | undefined> {
    return db.userPreferences.where('userId').equals(userId).first();
  },

  async getTasks(userId: string): Promise<Task[]> {
    return db.tasks.where('userId').equals(userId).toArray();
  },

  async getFixedCommitments(userId: string): Promise<FixedCommitment[]> {
    return db.fixedCommitments.where('userId').equals(userId).toArray();
  },

  async getScheduleForDate(userId: string, date: string): Promise<ScheduleItem[]> {
    return db.scheduleItems
      .where('userId')
      .equals(userId)
      .and(item => item.date === date)
      .sortBy('order');
  },

  async getScheduleForWeek(userId: string, startDate: string, endDate: string): Promise<ScheduleItem[]> {
    return db.scheduleItems
      .where('userId')
      .equals(userId)
      .and(item => item.date >= startDate && item.date <= endDate)
      .sortBy('order');
  },

  async getExecutionsForTask(userId: string, taskId: string): Promise<TaskExecution[]> {
    return db.taskExecutions
      .where({ userId, taskId })
      .reverse()
      .sortBy('createdAt');
  },

  async getBehaviorEvents(userId: string, sinceDate?: string): Promise<BehaviorEvent[]> {
    let query = db.behaviorEvents.where('userId').equals(userId);
    if (sinceDate) {
      return query.and(e => e.date >= sinceDate).toArray();
    }
    return query.toArray();
  },

  async getRecentExecutions(userId: string, days: number = 30): Promise<TaskExecution[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().split('T')[0];
    return db.taskExecutions
      .where('userId')
      .equals(userId)
      .and(e => e.date >= sinceStr)
      .toArray();
  },

  async getCategories(userId: string): Promise<TaskCategory[]> {
    return db.taskCategories.where('userId').equals(userId).toArray();
  },

  async getInsights(userId: string): Promise<PersonalizationInsight[]> {
    return db.personalizationInsights.where('userId').equals(userId).toArray();
  },

  async getAdaptations(userId: string, applied?: boolean): Promise<Adaptation[]> {
    let query = db.adaptations.where('userId').equals(userId);
    if (applied !== undefined) {
      return query.and(a => a.applied === applied).toArray();
    }
    return query.toArray();
  },

  async deleteUserData(userId: string): Promise<void> {
    await db.transaction('rw', 
      [db.userPreferences, db.taskCategories, db.tasks, db.fixedCommitments,
       db.scheduleItems, db.taskExecutions, db.behaviorEvents, 
       db.weeklyReviews, db.personalizationInsights, db.adaptations],
      async () => {
        await db.userPreferences.where('userId').equals(userId).delete();
        await db.taskCategories.where('userId').equals(userId).delete();
        await db.tasks.where('userId').equals(userId).delete();
        await db.fixedCommitments.where('userId').equals(userId).delete();
        await db.scheduleItems.where('userId').equals(userId).delete();
        await db.taskExecutions.where('userId').equals(userId).delete();
        await db.behaviorEvents.where('userId').equals(userId).delete();
        await db.weeklyReviews.where('userId').equals(userId).delete();
        await db.personalizationInsights.where('userId').equals(userId).delete();
        await db.adaptations.where('userId').equals(userId).delete();
      }
    );
  },
};
