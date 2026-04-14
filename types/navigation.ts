import type { Habit } from './habit';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type MainTabParamList = {
  Habits: undefined;
  Home: undefined;
  Profile: undefined;
};

export type HabitsTopTabParamList = {
  DefaultHabits: undefined;
  MyHabits: undefined;
};

export type HabitsStackParamList = {
  HabitsHome: undefined;
  CreateHabit:
    | {
        mode?: 'create' | 'edit' | 'view';
        habit?: Habit;
      }
    | undefined;
};
