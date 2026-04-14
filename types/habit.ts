export type HabitType = 'BOOLEAN' | 'NUMBER' | 'TEXT';

export type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface HabitBase {
  id: string;
  userId: string;
  sourceDefaultHabitId?: string | null;
  name: string;
  type: HabitType;
  frequency: Frequency;
  createdAt: string;
}

export interface Habit extends HabitBase {
  currentStreak: number;
  lastCompletedAt: string | null;
}

export interface HabitStreakResponse {
  habitId: string;
  currentStreak: number;
  lastCompletedAt: string | null;
}

export interface HabitLog {
  id: string;
  habitId: string;
  date: string;
  value: unknown;
}

export interface CreateHabitLogRequest {
  habitId: string;
  date: string;
  value: unknown;
}

export interface HabitLogQuery {
  from?: string;
  to?: string;
}

export type HabitCompletionMap = Record<string, boolean>;

export interface SimilarityCheckResult {
  habit: HabitBase;
  belongsTo: 'Default Habits' | 'My Habits';
}

export interface CreateHabitRequest {
  userId: string;
  name: string;
  type: HabitType;
  frequency: Frequency;
}

export interface UpdateHabitRequest {
  name: string;
  type: HabitType;
  frequency: Frequency;
}
