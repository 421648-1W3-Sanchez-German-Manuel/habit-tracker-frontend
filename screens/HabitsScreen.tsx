import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { habitService } from '../services/habitService';
import { useAuthStore } from '../store/authStore';
import { isApiError } from '../types/api';
import type { Habit, HabitCompletionMap, HabitStreakResponse } from '../types/habit';
import type { HabitsStackParamList, HabitsTopTabParamList } from '../types/navigation';
import { DefaultHabitsScreen } from './DefaultHabitsScreen';
import { MyHabitsScreen } from './MyHabitsScreen';

const Tab = createMaterialTopTabNavigator<HabitsTopTabParamList>();

const normalizeName = (value: string) => value.trim().toLowerCase();

const getTodayLocalDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
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

const toLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getCurrentPeriodQuery = (frequency: Habit['frequency']) => {
  const today = new Date();
  const from = toLocalDateString(getPeriodStartDate(frequency, today));
  const to = toLocalDateString(today);
  return { from, to };
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

const isDuplicateCompletionError = (message: string) => {
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
  const [completedHabitMap, setCompletedHabitMap] = useState<HabitCompletionMap>({});
  const [completingHabitIds, setCompletingHabitIds] = useState<string[]>([]);

  const fetchCompletionState = useCallback(
    async (habits: Habit[]): Promise<HabitCompletionMap> => {
      if (!token || habits.length === 0) {
        return {};
      }

      const completionEntries = await Promise.all(
        habits.map(async (habit) => {
          const logs = await habitService.getHabitLogs(habit.id, token, getCurrentPeriodQuery(habit.frequency));
          return [habit.id, logs.length > 0] as const;
        })
      );

      return Object.fromEntries(completionEntries);
    },
    [token]
  );

  const refreshCompletionState = useCallback(
    async (habits: Habit[]) => {
      if (habits.length === 0) {
        setCompletedHabitMap({});
        return;
      }

      try {
        const completionState = await fetchCompletionState(habits);
        setCompletedHabitMap(completionState);
      } catch {
        setCompletedHabitMap(Object.fromEntries(habits.map((habit) => [habit.id, false])));
      }
    },
    [fetchCompletionState]
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
        setCompletedHabitMap({});
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

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
        await refreshCompletionState(nextMyHabits);
      } catch (fetchError) {
        const message = isApiError(fetchError)
          ? fetchError.message
          : 'Could not load habits. Please try again.';
        setError(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [refreshCompletionState, resolveUserId, token]
  );

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    if (!token) {
      setDefaultHabits([]);
      setMyHabits([]);
      setCompletedHabitMap({});
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
        void refreshCompletionState(myHabits).finally(() => {
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
  }, [hasHydrated, myHabits, refreshCompletionState, token]);

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
      void refreshCompletionState(myHabits);
    });

    return () => {
      subscription.remove();
    };
  }, [hasHydrated, myHabits, refreshCompletionState, token]);

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
      setCompletedHabitMap((prev) => {
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

  const refreshMyHabitsAfterCompletion = useCallback(async (recentlyCompletedHabitId?: string) => {
    if (!token) {
      return;
    }

    try {
      const userId = await resolveUserId();

      if (!userId) {
        return;
      }

      const [myData, streaks] = await Promise.all([
        habitService.getUserHabits(userId, token),
        habitService.getHabitsWithStreaks(token),
      ]);

      const nextMyHabits = applyStreaks(myData, streaks);
      setMyHabits(nextMyHabits);

      lastRolloverKeyRef.current = getRolloverKey(nextMyHabits);
      const completionState = await fetchCompletionState(nextMyHabits);
      setCompletedHabitMap((previous) => {
        const mergedState: HabitCompletionMap = { ...completionState };

        for (const habit of nextMyHabits) {
          if (previous[habit.id]) {
            mergedState[habit.id] = true;
          }
        }

        if (recentlyCompletedHabitId) {
          mergedState[recentlyCompletedHabitId] = true;
        }

        return mergedState;
      });
    } catch {
      // Keep optimistic state if background refresh fails.
    }
  }, [fetchCompletionState, resolveUserId, token]);

  const handleCompleteHabit = useCallback(
    async (habit: Habit) => {
      if (!token) {
        return;
      }

      const habitId = habit.id;
      const wasCompleted = !!completedHabitMap[habitId];

      if (wasCompleted || completingHabitIds.includes(habitId)) {
        return;
      }

      const today = getTodayLocalDate();

      setCompletingHabitIds((prev) => [...prev, habitId]);
      setCompletedHabitMap((prev) => ({ ...prev, [habitId]: true }));

      try {
        await habitService.createHabitLog(
          {
            habitId,
            date: today,
            value: getDefaultCompletionValue(habit.type),
          },
          token
        );

        setMyHabits((prev) =>
          prev.map((item) =>
            item.id === habitId
              ? {
                  ...item,
                  lastCompletedAt: today,
                }
              : item
          )
        );

        void refreshMyHabitsAfterCompletion(habitId);
      } catch (completeError) {
        const message = isApiError(completeError)
          ? completeError.message
          : 'Could not mark habit as completed. Please try again.';
        const isDuplicate = isDuplicateCompletionError(message);
        const friendlyMessage = isDuplicate
          ? 'This habit is already completed for the current period.'
          : message;

        if (isDuplicate) {
          setCompletedHabitMap((prev) => ({ ...prev, [habitId]: true }));
        } else {
          setCompletedHabitMap((prev) => ({ ...prev, [habitId]: wasCompleted }));
        }

        Alert.alert('Could not complete habit', friendlyMessage);
      } finally {
        setCompletingHabitIds((prev) => prev.filter((id) => id !== habitId));
      }
    },
    [completedHabitMap, completingHabitIds, refreshMyHabitsAfterCompletion, token]
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
              loading={loading}
              refreshing={refreshing}
              removingHabitIds={removingHabitIds}
              completingHabitIds={completingHabitIds}
              completedHabitMap={completedHabitMap}
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
