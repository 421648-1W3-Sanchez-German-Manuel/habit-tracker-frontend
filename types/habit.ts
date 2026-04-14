export type HabitType = 'BOOLEAN' | 'NUMBER' | 'TEXT';

export type Frequency = 'DAILY' | 'WEEKLY';

export interface Habit {
  id: string;
  userId: string;
  name: string;
  type: HabitType;
  frequency: Frequency;
  createdAt: string;
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
