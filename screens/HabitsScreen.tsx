import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { habitService } from '../services/habitService';
import {
  buildLogsByHabitId,
  getCurrentPeriodLog,
  getTodayLocalDate,
  isHabitCompleted,
} from '../services/completionService';
import { useAuthStore } from '../store/authStore';
import { isApiError } from '../types/api';
import type { Habit, HabitLog, HabitLogsByHabitId, HabitStreakResponse } from '../types/habit';
import type { HabitsStackParamList, HabitsTopTabParamList } from '../types/navigation';
import { DefaultHabitsScreen } from './DefaultHabitsScreen';
import { MyHabitsScreen } from './MyHabitsScreen';

const Tab = createMaterialTopTabNavigator<HabitsTopTabParamList>();

const normalizeName = (value: string) => value.trim().toLowerCase();

const toLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getWeekStartDate = (date: Date) => {
  const start = new Date(date);
  const day = start.getDay();
  const shift = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + shift);
  start.setHours(0, 0, 0, 0);
  return start;
};

const getRolloverKey = (habits: Habit[], date = new Date()) => {
  if (habits.length === 0) {
    return '';
  }

  const frequencies = new Set(habits.map((habit) => habit.frequency));
  const keyParts: string[] = [];

  if (frequencies.has('DAILY')) {
    keyParts.push(`D:${toLocalDateString(date)}`);
  }

  if (frequencies.has('WEEKLY')) {
    keyParts.push(`W:${toLocalDateString(getWeekStartDate(date))}`);
  }

  if (frequencies.has('MONTHLY')) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    keyParts.push(`M:${year}-${month}`);
  }

  return keyParts.join('|');
};

const getNextBoundaryForFrequency = (frequency: Habit['frequency'], date = new Date()) => {
  const boundary = new Date(date);

  if (frequency === 'DAILY') {
    boundary.setDate(boundary.getDate() + 1);
    boundary.setHours(0, 0, 0, 0);
    return boundary;
  }

  if (frequency === 'WEEKLY') {
    const day = boundary.getDay();
    const daysUntilMonday = day === 0 ? 1 : 8 - day;
    boundary.setDate(boundary.getDate() + daysUntilMonday);
    boundary.setHours(0, 0, 0, 0);
    return boundary;
  }

  boundary.setMonth(boundary.getMonth() + 1, 1);
  boundary.setHours(0, 0, 0, 0);
  return boundary;
};

const getNextRolloverBoundary = (habits: Habit[], date = new Date()) => {
  if (habits.length === 0) {
    return null;
  }

  const frequencies = new Set(habits.map((habit) => habit.frequency));
  const boundaries = Array.from(frequencies).map((frequency) => getNextBoundaryForFrequency(frequency, date));

  return boundaries.reduce((earliest, current) => {
    if (current.getTime() < earliest.getTime()) {
      return current;
    }
    return earliest;
  });
};

const getDefaultCompletionValue = (habitType: Habit['type']): unknown => {
  switch (habitType) {
    case 'BOOLEAN':
      return true;
    case 'NUMBER':
      return 1;
    case 'TEXT':
      return 'completed';
  }
};

const isDuplicateCompletionError = (status: number | undefined, message: string) => {
  if (status === 409) {
    return true;
  }

  const normalized = message.toLowerCase();
  return (
    normalized.includes('duplicate') ||
    normalized.includes('already') ||
    normalized.includes('e11000') ||
    normalized.includes('conflict')
  );
};

const applyStreaks = (habits: Habit[], streaks: HabitStreakResponse[]): Habit[] => {
  const streakByHabitId = new Map(streaks.map((entry) => [entry.habitId, entry]));

  return habits.map((habit) => {
    const streak = streakByHabitId.get(habit.id);
    return {
      ...habit,
      currentStreak: streak?.currentStreak ?? 0,
      lastCompletedAt: streak?.lastCompletedAt ?? null,
    };
  });
};

const mergeHabitLog = (logs: HabitLog[], log: HabitLog): HabitLog[] => {
  const withoutDuplicatedLog = logs.filter((entry) => entry.id !== log.id);
  return [log, ...withoutDuplicatedLog];
};

export const HabitsScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<HabitsStackParamList, 'HabitsHome'>>();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const fetchCurrentUser = useAuthStore((state) => state.fetchCurrentUser);
  const isFirstFocus = useRef(true);
  const rolloverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRolloverKeyRef = useRef<string>('');

  const [defaultHabits, setDefaultHabits] = useState<Habit[]>([]);
  const [myHabits, setMyHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [addingHabitIds, setAddingHabitIds] = useState<string[]>([]);
  const [removingHabitIds, setRemovingHabitIds] = useState<string[]>([]);
  const [logsByHabitId, setLogsByHabitId] = useState<HabitLogsByHabitId>({});
  const [logsLoaded, setLogsLoaded] = useState<boolean>(false);
  const [completingHabitIds, setCompletingHabitIds] = useState<string[]>([]);

  useEffect(() => {
    console.log('[HabitsScreen] logsByHabitId', logsByHabitId);
  }, [logsByHabitId]);

  useEffect(() => {
    if (!logsLoaded) {
      return;
    }

    myHabits.forEach((habit) => {
      console.log('[HabitsScreen] isHabitCompleted', {
        habitId: habit.id,
        completed: isHabitCompleted(habit, logsByHabitId[habit.id] ?? []),
      });
    });
  }, [logsByHabitId, logsLoaded, myHabits]);

  const refreshLogsForHabits = useCallback(
    async (habits: Habit[], showLoader = false) => {
      if (!token) {
        setLogsByHabitId({});
        setLogsLoaded(true);
        return;
      }

      if (showLoader) {
        setLogsLoaded(false);
      }

      if (habits.length === 0) {
        setLogsByHabitId({});
        setLogsLoaded(true);
        return;
      }

      try {
        const nextLogsByHabitId = await buildLogsByHabitId(habits, token, habitService.getHabitLogs);
        setLogsByHabitId(nextLogsByHabitId);
      } catch {
        setLogsByHabitId((previous) => {
          const next: HabitLogsByHabitId = {};
          for (const habit of habits) {
            next[habit.id] = previous[habit.id] ?? [];
          }
          return next;
        });
      } finally {
        setLogsLoaded(true);
      }
    },
    [token]
  );

  const refreshLogsForHabit = useCallback(
    async (habit: Habit) => {
      if (!token) {
        return;
      }

      try {
        const logs = await habitService.getHabitLogs(habit.id, token);
        setLogsByHabitId((previous) => ({
          ...previous,
          [habit.id]: logs,
        }));
      } catch {
        // Keep last known logs for this habit if refresh fails.
      }
    },
    [token]
  );

  const isHabitCompletedForHabit = useCallback(
    (habit: Habit) => isHabitCompleted(habit, logsByHabitId[habit.id] ?? []),
    [logsByHabitId]
  );

  const resolveUserId = useCallback(async (): Promise<string | null> => {
    if (user?.id) {
      return user.id;
    }

    const currentUser = await fetchCurrentUser();
    return currentUser?.id ?? null;
  }, [fetchCurrentUser, user?.id]);

  const loadHabits = useCallback(
    async (isManualRefresh = false) => {
      if (!token) {
        setDefaultHabits([]);
        setMyHabits([]);
        setLogsByHabitId({});
        setLogsLoaded(true);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setLogsLoaded(false);

      setError(null);

      try {
        const userId = await resolveUserId();

        if (!userId) {
          throw new Error('Could not identify the current user.');
        }

        const [defaultData, myData, streaks] = await Promise.all([
          habitService.getDefaultHabits(token),
          habitService.getUserHabits(userId, token),
          habitService.getHabitsWithStreaks(token),
        ]);

        const nextDefaultHabits = applyStreaks(defaultData, streaks);
        const nextMyHabits = applyStreaks(myData, streaks);

        setDefaultHabits(nextDefaultHabits);
        setMyHabits(nextMyHabits);
        lastRolloverKeyRef.current = getRolloverKey(nextMyHabits);
        await refreshLogsForHabits(nextMyHabits, true);
      } catch (fetchError) {
        const message = isApiError(fetchError)
          ? fetchError.message
          : 'Could not load habits. Please try again.';
        setError(message);
        setLogsLoaded(true);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [refreshLogsForHabits, resolveUserId, token]
  );

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    if (!token) {
      setDefaultHabits([]);
      setMyHabits([]);
      setLogsByHabitId({});
      setLogsLoaded(true);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    void loadHabits();
  }, [hasHydrated, loadHabits, token]);

  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }

      if (!hasHydrated || !token) {
        return;
      }

      void loadHabits(true);
    }, [hasHydrated, loadHabits, token])
  );

  useEffect(() => {
    if (!hasHydrated || !token || myHabits.length === 0) {
      if (rolloverTimerRef.current) {
        clearTimeout(rolloverTimerRef.current);
        rolloverTimerRef.current = null;
      }
      return;
    }

    let cancelled = false;

    const scheduleNextRollover = () => {
      if (cancelled) {
        return;
      }

      const nextBoundary = getNextRolloverBoundary(myHabits);
      if (!nextBoundary) {
        return;
      }

      const delayMs = Math.max(nextBoundary.getTime() - Date.now() + 250, 250);

      rolloverTimerRef.current = setTimeout(() => {
        if (cancelled) {
          return;
        }

        lastRolloverKeyRef.current = getRolloverKey(myHabits);
        void refreshLogsForHabits(myHabits).finally(() => {
          scheduleNextRollover();
        });
      }, delayMs);
    };

    lastRolloverKeyRef.current = getRolloverKey(myHabits);
    scheduleNextRollover();

    return () => {
      cancelled = true;
      if (rolloverTimerRef.current) {
        clearTimeout(rolloverTimerRef.current);
        rolloverTimerRef.current = null;
      }
    };
  }, [hasHydrated, myHabits, refreshLogsForHabits, token]);

  useEffect(() => {
    if (!hasHydrated || !token) {
      return;
    }

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        return;
      }

      const nextRolloverKey = getRolloverKey(myHabits);
      if (nextRolloverKey === lastRolloverKeyRef.current) {
        return;
      }

      lastRolloverKeyRef.current = nextRolloverKey;
      void refreshLogsForHabits(myHabits);
    });

    return () => {
      subscription.remove();
    };
  }, [hasHydrated, myHabits, refreshLogsForHabits, token]);

  const myHabitNames = useMemo(
    () => new Set(myHabits.map((habit) => normalizeName(habit.name))),
    [myHabits]
  );

  const handleAddFromDefault = useCallback(
    async (habit: Habit) => {
      if (!token) {
        return;
      }

      const normalizedHabitName = normalizeName(habit.name);
      if (myHabitNames.has(normalizedHabitName)) {
        Alert.alert('Already added', 'This habit is already in My Habits.');
        return;
      }

      setAddingHabitIds((prev) => [...prev, habit.id]);

      try {
        await habitService.addDefaultHabitToCurrentUser(habit.id, token);
        await loadHabits(true);
      } catch (addError) {
        const message = isApiError(addError)
          ? addError.message
          : 'Could not add habit. Please try again.';
        Alert.alert('Error', message);
      } finally {
        setAddingHabitIds((prev) => prev.filter((habitId) => habitId !== habit.id));
      }
    },
    [loadHabits, myHabitNames, token]
  );

  const handleRemoveMyHabit = useCallback(
    async (habitId: string) => {
      if (!token) {
        return;
      }

      const previousHabits = myHabits;
      setRemovingHabitIds((prev) => [...prev, habitId]);
      setMyHabits((prev) => prev.filter((habit) => habit.id !== habitId));
      setLogsByHabitId((prev) => {
        const next = { ...prev };
        delete next[habitId];
        return next;
      });

      try {
        await habitService.deleteHabit(habitId, token);
        await loadHabits(true);
      } catch (removeError) {
        setMyHabits(previousHabits);
        const message = isApiError(removeError)
          ? removeError.message
          : 'Could not remove habit. Please try again.';
        Alert.alert('Error', message);
      } finally {
        setRemovingHabitIds((prev) => prev.filter((id) => id !== habitId));
      }
    },
    [loadHabits, myHabits, token]
  );

  const handleCompleteHabit = useCallback(
    async (habit: Habit) => {
      if (!token) {
        return;
      }

      const habitId = habit.id;
      const habitLogs = logsByHabitId[habitId] ?? [];
      const currentlyCompleted = isHabitCompleted(habit, habitLogs);
      const nextCompleted = !currentlyCompleted;

      if (completingHabitIds.includes(habitId)) {
        return;
      }

      const today = getTodayLocalDate();

      setCompletingHabitIds((prev) => [...prev, habitId]);

      try {
        if (nextCompleted) {
          const createdLog = await habitService.createHabitLog(
            {
              habitId,
              date: today,
              value: getDefaultCompletionValue(habit.type),
            },
            token
          );

          setLogsByHabitId((prev) => ({
            ...prev,
            [habitId]: mergeHabitLog(prev[habitId] ?? [], createdLog),
          }));
        } else {
          const currentPeriodLog = getCurrentPeriodLog(habit, habitLogs);

          if (!currentPeriodLog) {
            await refreshLogsForHabit(habit);
            return;
          }

          await habitService.deleteHabitLogById(currentPeriodLog.id, token);
          setLogsByHabitId((prev) => ({
            ...prev,
            [habitId]: (prev[habitId] ?? []).filter((entry) => entry.id !== currentPeriodLog.id),
          }));
        }

        setMyHabits((prev) =>
          prev.map((item) =>
            item.id === habitId
              ? {
                  ...item,
                  lastCompletedAt: nextCompleted ? today : null,
                }
              : item
          )
        );
      } catch (completeError) {
        const isDuplicateOnCheck =
          nextCompleted &&
          isDuplicateCompletionError(
            isApiError(completeError) ? completeError.status : undefined,
            isApiError(completeError) ? completeError.message : ''
          );

        if (isDuplicateOnCheck) {
          await refreshLogsForHabit(habit);
        } else {
          const message = isApiError(completeError)
            ? completeError.message
            : nextCompleted
              ? 'Could not mark habit as completed. Please try again.'
              : 'Could not unmark habit. Please try again.';
          Alert.alert('Could not update habit', message);
        }
      } finally {
        setCompletingHabitIds((prev) => prev.filter((id) => id !== habitId));
      }
    },
    [completingHabitIds, logsByHabitId, refreshLogsForHabit, token]
  );

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 8) }]}>
      <Tab.Navigator
        initialRouteName="DefaultHabits"
        screenOptions={{
          swipeEnabled: true,
          animationEnabled: true,
          tabBarActiveTintColor: '#0f172a',
          tabBarInactiveTintColor: '#64748b',
          tabBarPressColor: 'transparent',
          tabBarStyle: styles.tabBar,
          tabBarItemStyle: styles.tabBarItem,
          tabBarLabelStyle: styles.tabBarLabel,
          tabBarIndicatorStyle: styles.tabBarIndicator,
        }}
      >
        <Tab.Screen name="DefaultHabits" options={{ title: 'Default Habits' }}>
          {() => (
            <DefaultHabitsScreen
              defaultHabits={defaultHabits}
              myHabits={myHabits}
              loading={loading}
              refreshing={refreshing}
              addingHabitIds={addingHabitIds}
              error={error}
              onAddHabit={handleAddFromDefault}
              onRetry={() => {
                void loadHabits(true);
              }}
            />
          )}
        </Tab.Screen>
        <Tab.Screen name="MyHabits" options={{ title: 'My Habits' }}>
          {() => (
            <MyHabitsScreen
              habits={myHabits}
              loading={loading || !logsLoaded}
              refreshing={refreshing}
              removingHabitIds={removingHabitIds}
              completingHabitIds={completingHabitIds}
              logsByHabitId={logsByHabitId}
              isHabitCompleted={isHabitCompletedForHabit}
              error={error}
              onCreateHabit={() => {
                  navigation.navigate('CreateHabit', { mode: 'create' });
                }}
                onEditHabit={(habit) => {
                  navigation.navigate('CreateHabit', { mode: 'edit', habit });
                }}
                onViewHabitDetails={(habit) => {
                  navigation.navigate('CreateHabit', { mode: 'view', habit });
              }}
              onRemoveHabit={handleRemoveMyHabit}
              onCompleteHabit={handleCompleteHabit}
              onRetry={() => {
                void loadHabits(true);
              }}
            />
          )}
        </Tab.Screen>
      </Tab.Navigator>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  tabBar: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
    elevation: 0,
    shadowOpacity: 0,
  },
  tabBarItem: {
    minHeight: 40,
    borderRadius: 10,
  },
  tabBarLabel: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'none',
  },
  tabBarIndicator: {
    padding: 16,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    margin: 6,
  },
});
