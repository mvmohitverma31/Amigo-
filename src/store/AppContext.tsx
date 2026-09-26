import React, { createContext, useContext, useReducer, useEffect, useCallback, type ReactNode } from 'react';
import type {
  UserPreferences,
  Task,
  TaskCategory,
  FixedCommitment,
  ScheduleItem,
  TaskExecution,
  BehaviorEvent,
  PersonalizationInsight,
  Adaptation,
  TaskStatus,
  SkipReason,
} from '../types';
import { db, dbHelpers } from '../db';
import { v4 as uuidv4 } from 'uuid';

const CURRENT_USER_ID = 'local-user';

interface AppState {
  preferences: UserPreferences | null;
  tasks: Task[];
  categories: TaskCategory[];
  commitments: FixedCommitment[];
  scheduleItems: ScheduleItem[];
  executions: TaskExecution[];
  behaviorEvents: BehaviorEvent[];
  insights: PersonalizationInsight[];
  adaptations: Adaptation[];
  isLoading: boolean;
  currentDate: string;
  onboardingComplete: boolean;
}

type Action =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_PREFERENCES'; payload: UserPreferences | null }
  | { type: 'SET_TASKS'; payload: Task[] }
  | { type: 'SET_CATEGORIES'; payload: TaskCategory[] }
  | { type: 'SET_COMMITMENTS'; payload: FixedCommitment[] }
  | { type: 'SET_SCHEDULE'; payload: ScheduleItem[] }
  | { type: 'SET_EXECUTIONS'; payload: TaskExecution[] }
  | { type: 'SET_EVENTS'; payload: BehaviorEvent[] }
  | { type: 'SET_INSIGHTS'; payload: PersonalizationInsight[] }
  | { type: 'SET_ADAPTATIONS'; payload: Adaptation[] }
  | { type: 'SET_DATE'; payload: string }
  | { type: 'SET_ONBOARDING'; payload: boolean }
  | { type: 'ADD_TASK'; payload: Task }
  | { type: 'UPDATE_TASK'; payload: Task }
  | { type: 'DELETE_TASK'; payload: string }
  | { type: 'ADD_CATEGORY'; payload: TaskCategory }
  | { type: 'ADD_COMMITMENT'; payload: FixedCommitment }
  | { type: 'UPDATE_COMMITMENT'; payload: FixedCommitment }
  | { type: 'DELETE_COMMITMENT'; payload: string }
  | { type: 'UPDATE_SCHEDULE_ITEM'; payload: ScheduleItem }
  | { type: 'ADD_EXECUTION'; payload: TaskExecution }
  | { type: 'UPDATE_EXECUTION'; payload: TaskExecution }
  | { type: 'ADD_EVENT'; payload: BehaviorEvent }
  | { type: 'ADD_INSIGHT'; payload: PersonalizationInsight }
  | { type: 'ADD_ADAPTATION'; payload: Adaptation }
  | { type: 'UPDATE_ADAPTATION'; payload: Adaptation };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_LOADING': return { ...state, isLoading: action.payload };
    case 'SET_PREFERENCES': return { ...state, preferences: action.payload };
    case 'SET_TASKS': return { ...state, tasks: action.payload };
    case 'SET_CATEGORIES': return { ...state, categories: action.payload };
    case 'SET_COMMITMENTS': return { ...state, commitments: action.payload };
    case 'SET_SCHEDULE': return { ...state, scheduleItems: action.payload };
    case 'SET_EXECUTIONS': return { ...state, executions: action.payload };
    case 'SET_EVENTS': return { ...state, behaviorEvents: action.payload };
    case 'SET_INSIGHTS': return { ...state, insights: action.payload };
    case 'SET_ADAPTATIONS': return { ...state, adaptations: action.payload };
    case 'SET_DATE': return { ...state, currentDate: action.payload };
    case 'SET_ONBOARDING': return { ...state, onboardingComplete: action.payload };
    case 'ADD_TASK': return { ...state, tasks: [...state.tasks, action.payload] };
    case 'UPDATE_TASK': return { ...state, tasks: state.tasks.map(t => t.id === action.payload.id ? action.payload : t) };
    case 'DELETE_TASK': return { ...state, tasks: state.tasks.filter(t => t.id !== action.payload) };
    case 'ADD_CATEGORY': return { ...state, categories: [...state.categories, action.payload] };
    case 'ADD_COMMITMENT': return { ...state, commitments: [...state.commitments, action.payload] };
    case 'UPDATE_COMMITMENT': return { ...state, commitments: state.commitments.map(c => c.id === action.payload.id ? action.payload : c) };
    case 'DELETE_COMMITMENT': return { ...state, commitments: state.commitments.filter(c => c.id !== action.payload) };
    case 'UPDATE_SCHEDULE_ITEM': return { ...state, scheduleItems: state.scheduleItems.map(s => s.id === action.payload.id ? action.payload : s) };
    case 'ADD_EXECUTION': return { ...state, executions: [...state.executions, action.payload] };
    case 'UPDATE_EXECUTION': return { ...state, executions: state.executions.map(e => e.id === action.payload.id ? action.payload : e) };
    case 'ADD_EVENT': return { ...state, behaviorEvents: [...state.behaviorEvents, action.payload] };
    case 'ADD_INSIGHT': return { ...state, insights: [...state.insights, action.payload] };
    case 'ADD_ADAPTATION': return { ...state, adaptations: [...state.adaptations, action.payload] };
    case 'UPDATE_ADAPTATION': return { ...state, adaptations: state.adaptations.map(a => a.id === action.payload.id ? action.payload : a) };
    default: return state;
  }
}

const initialState: AppState = {
  preferences: null,
  tasks: [],
  categories: [],
  commitments: [],
  scheduleItems: [],
  executions: [],
  behaviorEvents: [],
  insights: [],
  adaptations: [],
  isLoading: true,
  currentDate: new Date().toISOString().split('T')[0],
  onboardingComplete: false,
};

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  actions: {
    loadAllData: () => Promise<void>;
    savePreferences: (prefs: Partial<UserPreferences>) => Promise<void>;
    addTask: (task: Omit<Task, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<Task>;
    updateTask: (task: Task) => Promise<void>;
    deleteTask: (id: string) => Promise<void>;
    addCategory: (name: string, color: string) => Promise<TaskCategory>;
    addCommitment: (commitment: Omit<FixedCommitment, 'id' | 'userId' | 'createdAt'>) => Promise<FixedCommitment>;
    updateCommitment: (commitment: FixedCommitment) => Promise<void>;
    deleteCommitment: (id: string) => Promise<void>;
    updateScheduleItem: (item: ScheduleItem) => Promise<void>;
    startTask: (scheduleItemId: string) => Promise<void>;
    completeTask: (scheduleItemId: string) => Promise<void>;
    skipTask: (scheduleItemId: string, reason?: SkipReason) => Promise<void>;
    postponeTask: (scheduleItemId: string, reason?: SkipReason) => Promise<void>;
    setCurrentDate: (date: string) => void;
    deleteAllData: () => Promise<void>;
  };
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const loadAllData = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const prefs = await dbHelpers.getUserPreferences(CURRENT_USER_ID);
      const tasks = await dbHelpers.getTasks(CURRENT_USER_ID);
      const categories = await dbHelpers.getCategories(CURRENT_USER_ID);
      const commitments = await dbHelpers.getFixedCommitments(CURRENT_USER_ID);
      const schedule = await dbHelpers.getScheduleForDate(CURRENT_USER_ID, state.currentDate);
      const executions = await dbHelpers.getRecentExecutions(CURRENT_USER_ID, 90);
      const events = await dbHelpers.getBehaviorEvents(CURRENT_USER_ID);
      const insights = await dbHelpers.getInsights(CURRENT_USER_ID);
      const adaptations = await dbHelpers.getAdaptations(CURRENT_USER_ID);

      dispatch({ type: 'SET_PREFERENCES', payload: prefs || null });
      dispatch({ type: 'SET_TASKS', payload: tasks });
      dispatch({ type: 'SET_CATEGORIES', payload: categories });
      dispatch({ type: 'SET_COMMITMENTS', payload: commitments });
      dispatch({ type: 'SET_SCHEDULE', payload: schedule });
      dispatch({ type: 'SET_EXECUTIONS', payload: executions });
      dispatch({ type: 'SET_EVENTS', payload: events });
      dispatch({ type: 'SET_INSIGHTS', payload: insights });
      dispatch({ type: 'SET_ADAPTATIONS', payload: adaptations });
      dispatch({ type: 'SET_ONBOARDING', payload: !!prefs });
    } catch (err) {
      console.error('Failed to load data:', err);
    }
    dispatch({ type: 'SET_LOADING', payload: false });
  }, [state.currentDate]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const actions = {
    loadAllData,

    async savePreferences(prefs: Partial<UserPreferences>) {
      const existing = state.preferences;
      const updated: UserPreferences = {
        id: existing?.id || uuidv4(),
        userId: CURRENT_USER_ID,
        wakeUpTime: prefs.wakeUpTime || existing?.wakeUpTime || '07:00',
        sleepTime: prefs.sleepTime || existing?.sleepTime || '23:00',
        preferredProductivityWindows: prefs.preferredProductivityWindows || existing?.preferredProductivityWindows || [],
        breakDurationMinutes: prefs.breakDurationMinutes ?? existing?.breakDurationMinutes ?? 10,
        transitionBufferMinutes: prefs.transitionBufferMinutes ?? existing?.transitionBufferMinutes ?? 10,
        maxConsecutiveWorkMinutes: prefs.maxConsecutiveWorkMinutes ?? existing?.maxConsecutiveWorkMinutes ?? 90,
        personalizationEnabled: prefs.personalizationEnabled ?? existing?.personalizationEnabled ?? true,
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await db.userPreferences.put(updated);
      dispatch({ type: 'SET_PREFERENCES', payload: updated });
      dispatch({ type: 'SET_ONBOARDING', payload: true });
    },

    async addTask(taskData: Omit<Task, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) {
      const task: Task = {
        ...taskData,
        id: uuidv4(),
        userId: CURRENT_USER_ID,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await db.tasks.put(task);
      dispatch({ type: 'ADD_TASK', payload: task });
      return task;
    },

    async updateTask(task: Task) {
      const updated = { ...task, updatedAt: new Date().toISOString() };
      await db.tasks.put(updated);
      dispatch({ type: 'UPDATE_TASK', payload: updated });
    },

    async deleteTask(id: string) {
      await db.tasks.delete(id);
      dispatch({ type: 'DELETE_TASK', payload: id });
    },

    async addCategory(name: string, color: string) {
      const category: TaskCategory = {
        id: uuidv4(),
        userId: CURRENT_USER_ID,
        name,
        color,
        createdAt: new Date().toISOString(),
      };
      await db.taskCategories.put(category);
      dispatch({ type: 'ADD_CATEGORY', payload: category });
      return category;
    },

    async addCommitment(data: Omit<FixedCommitment, 'id' | 'userId' | 'createdAt'>) {
      const commitment: FixedCommitment = {
        ...data,
        id: uuidv4(),
        userId: CURRENT_USER_ID,
        createdAt: new Date().toISOString(),
      };
      await db.fixedCommitments.put(commitment);
      dispatch({ type: 'ADD_COMMITMENT', payload: commitment });
      return commitment;
    },

    async updateCommitment(commitment: FixedCommitment) {
      await db.fixedCommitments.put(commitment);
      dispatch({ type: 'UPDATE_COMMITMENT', payload: commitment });
    },

    async deleteCommitment(id: string) {
      await db.fixedCommitments.delete(id);
      dispatch({ type: 'DELETE_COMMITMENT', payload: id });
    },

    async updateScheduleItem(item: ScheduleItem) {
      await db.scheduleItems.put(item);
      dispatch({ type: 'UPDATE_SCHEDULE_ITEM', payload: item });
    },

    async startTask(scheduleItemId: string) {
      const item = state.scheduleItems.find(s => s.id === scheduleItemId);
      if (!item) return;

      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const updatedItem = { ...item, status: 'active' as TaskStatus };
      await db.scheduleItems.put(updatedItem);
      dispatch({ type: 'UPDATE_SCHEDULE_ITEM', payload: updatedItem });

      const execution: TaskExecution = {
        id: uuidv4(),
        userId: CURRENT_USER_ID,
        scheduleItemId: item.id,
        taskId: item.taskId || '',
        date: state.currentDate,
        plannedStartTime: item.startTime,
        plannedEndTime: item.endTime,
        plannedDurationMinutes: item.durationMinutes,
        actualStartTime: currentTime,
        status: 'active',
        postponementCount: 0,
        isManualOverride: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await db.taskExecutions.put(execution);
      dispatch({ type: 'ADD_EXECUTION', payload: execution });
    },

    async completeTask(scheduleItemId: string) {
      const item = state.scheduleItems.find(s => s.id === scheduleItemId);
      if (!item) return;

      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const updatedItem = { ...item, status: 'completed' as TaskStatus };
      await db.scheduleItems.put(updatedItem);
      dispatch({ type: 'UPDATE_SCHEDULE_ITEM', payload: updatedItem });

      // Find or create execution
      let execution = state.executions.find(e => e.scheduleItemId === scheduleItemId);
      if (execution) {
        const startMin = execution.actualStartTime
          ? parseInt(execution.actualStartTime.split(':')[0]) * 60 + parseInt(execution.actualStartTime.split(':')[1])
          : parseInt(item.startTime.split(':')[0]) * 60 + parseInt(item.startTime.split(':')[1]);
        const endMin = now.getHours() * 60 + now.getMinutes();
        const actualDuration = Math.max(1, endMin - startMin);

        const updated = {
          ...execution,
          actualEndTime: currentTime,
          actualDurationMinutes: actualDuration,
          status: 'completed' as TaskStatus,
          updatedAt: new Date().toISOString(),
        };
        await db.taskExecutions.put(updated);
        dispatch({ type: 'UPDATE_EXECUTION', payload: updated });
      } else if (item.taskId) {
        const newExec: TaskExecution = {
          id: uuidv4(),
          userId: CURRENT_USER_ID,
          scheduleItemId: item.id,
          taskId: item.taskId,
          date: state.currentDate,
          plannedStartTime: item.startTime,
          plannedEndTime: item.endTime,
          plannedDurationMinutes: item.durationMinutes,
          actualStartTime: item.startTime,
          actualEndTime: currentTime,
          actualDurationMinutes: item.durationMinutes,
          status: 'completed',
          postponementCount: 0,
          isManualOverride: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await db.taskExecutions.put(newExec);
        dispatch({ type: 'ADD_EXECUTION', payload: newExec });
      }

      // Record behavior event
      if (item.taskId && state.preferences?.personalizationEnabled) {
        const hour = parseInt(item.startTime.split(':')[0]);
        const event: BehaviorEvent = {
          id: uuidv4(),
          userId: CURRENT_USER_ID,
          date: state.currentDate,
          eventType: 'completion',
          taskId: item.taskId,
          timeOfDay: hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night',
          dayOfWeek: new Date(state.currentDate + 'T00:00:00').getDay() as any,
          metadata: { duration: item.durationMinutes },
          createdAt: new Date().toISOString(),
        };
        await db.behaviorEvents.put(event);
        dispatch({ type: 'ADD_EVENT', payload: event });
      }
    },

    async skipTask(scheduleItemId: string, reason?: SkipReason) {
      const item = state.scheduleItems.find(s => s.id === scheduleItemId);
      if (!item) return;

      const updatedItem = { ...item, status: 'skipped' as TaskStatus };
      await db.scheduleItems.put(updatedItem);
      dispatch({ type: 'UPDATE_SCHEDULE_ITEM', payload: updatedItem });

      if (item.taskId) {
        const execution: TaskExecution = {
          id: uuidv4(),
          userId: CURRENT_USER_ID,
          scheduleItemId: item.id,
          taskId: item.taskId,
          date: state.currentDate,
          plannedStartTime: item.startTime,
          plannedEndTime: item.endTime,
          plannedDurationMinutes: item.durationMinutes,
          status: 'skipped',
          skipReason: reason,
          postponementCount: 0,
          isManualOverride: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await db.taskExecutions.put(execution);
        dispatch({ type: 'ADD_EXECUTION', payload: execution });

        if (state.preferences?.personalizationEnabled) {
          const hour = parseInt(item.startTime.split(':')[0]);
          const event: BehaviorEvent = {
            id: uuidv4(),
            userId: CURRENT_USER_ID,
            date: state.currentDate,
            eventType: 'skip',
            taskId: item.taskId,
            timeOfDay: hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night',
            dayOfWeek: new Date(state.currentDate + 'T00:00:00').getDay() as any,
            metadata: { reason: reason || 'unspecified' },
            createdAt: new Date().toISOString(),
          };
          await db.behaviorEvents.put(event);
          dispatch({ type: 'ADD_EVENT', payload: event });
        }
      }
    },

    async postponeTask(scheduleItemId: string, reason?: SkipReason) {
      const item = state.scheduleItems.find(s => s.id === scheduleItemId);
      if (!item) return;

      const updatedItem = { ...item, status: 'postponed' as TaskStatus };
      await db.scheduleItems.put(updatedItem);
      dispatch({ type: 'UPDATE_SCHEDULE_ITEM', payload: updatedItem });

      if (item.taskId) {
        const existingExec = state.executions.find(e => e.scheduleItemId === scheduleItemId);
        const postponementCount = (existingExec?.postponementCount || 0) + 1;

        const execution: TaskExecution = {
          id: uuidv4(),
          userId: CURRENT_USER_ID,
          scheduleItemId: item.id,
          taskId: item.taskId,
          date: state.currentDate,
          plannedStartTime: item.startTime,
          plannedEndTime: item.endTime,
          plannedDurationMinutes: item.durationMinutes,
          status: 'postponed',
          skipReason: reason,
          postponementCount,
          isManualOverride: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await db.taskExecutions.put(execution);
        dispatch({ type: 'ADD_EXECUTION', payload: execution });

        if (state.preferences?.personalizationEnabled) {
          const hour = parseInt(item.startTime.split(':')[0]);
          const event: BehaviorEvent = {
            id: uuidv4(),
            userId: CURRENT_USER_ID,
            date: state.currentDate,
            eventType: 'postpone',
            taskId: item.taskId,
            timeOfDay: hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night',
            dayOfWeek: new Date(state.currentDate + 'T00:00:00').getDay() as any,
            metadata: { reason: reason || 'unspecified', count: postponementCount },
            createdAt: new Date().toISOString(),
          };
          await db.behaviorEvents.put(event);
          dispatch({ type: 'ADD_EVENT', payload: event });
        }
      }
    },

    setCurrentDate(date: string) {
      dispatch({ type: 'SET_DATE', payload: date });
    },

    async deleteAllData() {
      await dbHelpers.deleteUserData(CURRENT_USER_ID);
      dispatch({ type: 'SET_PREFERENCES', payload: null });
      dispatch({ type: 'SET_TASKS', payload: [] });
      dispatch({ type: 'SET_CATEGORIES', payload: [] });
      dispatch({ type: 'SET_COMMITMENTS', payload: [] });
      dispatch({ type: 'SET_SCHEDULE', payload: [] });
      dispatch({ type: 'SET_EXECUTIONS', payload: [] });
      dispatch({ type: 'SET_EVENTS', payload: [] });
      dispatch({ type: 'SET_INSIGHTS', payload: [] });
      dispatch({ type: 'SET_ADAPTATIONS', payload: [] });
      dispatch({ type: 'SET_ONBOARDING', payload: false });
    },
  };

  return (
    <AppContext.Provider value={{ state, dispatch, actions }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}

export { CURRENT_USER_ID };
