import type { Habit, HabitLog, HabitLogQuery, HabitLogsByHabitId } from '../types/habit';

export type HabitLogsFetcher = (
  habitId: string,
  token: string,
  query?: HabitLogQuery
) => Promise<HabitLog[]>;

export const getTodayLocalDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getPeriodStartDate = (frequency: Habit['frequency'], date: Date) => {
  const start = new Date(date);

  if (frequency === 'DAILY') {
    return start;
  }

  if (frequency === 'WEEKLY') {
    const day = start.getDay();
    const shift = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + shift);
    return start;
  }

  start.setDate(1);
  return start;
};

export const getCurrentPeriodQuery = (frequency: Habit['frequency']) => {
  const today = new Date();
  return {
    from: toLocalDateString(getPeriodStartDate(frequency, today)),
    to: toLocalDateString(today),
  };
};

const getDateRangeValue = (value: string) => {
  const normalized = value.slice(0, 10);
  return Number.parseInt(normalized.replace(/-/g, ''), 10);
};

const isDateWithinQueryRange = (date: string, query: HabitLogQuery) => {
  const dateValue = getDateRangeValue(date);
  const fromValue = query.from ? getDateRangeValue(query.from) : Number.NEGATIVE_INFINITY;
  const toValue = query.to ? getDateRangeValue(query.to) : Number.POSITIVE_INFINITY;
  return dateValue >= fromValue && dateValue <= toValue;
};

export const getCurrentPeriodLogs = (habit: Habit, logs: HabitLog[] = []): HabitLog[] => {
  const query = getCurrentPeriodQuery(habit.frequency);
  return logs.filter((log) => isDateWithinQueryRange(log.date, query));
};

export const getCurrentPeriodLog = (habit: Habit, logs: HabitLog[] = []): HabitLog | null => {
  const periodLogs = getCurrentPeriodLogs(habit, logs);
  if (periodLogs.length === 0) {
    return null;
  }

  return periodLogs.reduce((latest, current) => {
    if (!latest) {
      return current;
    }

    const latestDate = getDateRangeValue(latest.date);
    const currentDate = getDateRangeValue(current.date);

    if (currentDate > latestDate) {
      return current;
    }

    if (currentDate === latestDate && current.id > latest.id) {
      return current;
    }

    return latest;
  }, null as HabitLog | null);
};

export const isHabitCompleted = (habit: Habit, logs: HabitLog[] = []): boolean =>
  getCurrentPeriodLogs(habit, logs).length > 0;

export const buildLogsByHabitId = async (
  habits: Habit[],
  token: string,
  getHabitLogs: HabitLogsFetcher
): Promise<HabitLogsByHabitId> => {
  if (habits.length === 0) {
    return {};
  }

  const logsEntries = await Promise.all(
    habits.map(async (habit) => {
      const logs = await getHabitLogs(habit.id, token);
      return [habit.id, logs] as const;
    })
  );

  return Object.fromEntries(logsEntries);
};
