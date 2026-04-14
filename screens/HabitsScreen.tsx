import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { habitService } from '../services/habitService';
import { useAuthStore } from '../store/authStore';
import { isApiError } from '../types/api';
import type { Habit } from '../types/habit';
import type { HabitsTopTabParamList } from '../types/navigation';
import { DefaultHabitsScreen } from './DefaultHabitsScreen';
import { MyHabitsScreen } from './MyHabitsScreen';

const Tab = createMaterialTopTabNavigator<HabitsTopTabParamList>();

const normalizeName = (value: string) => value.trim().toLowerCase();

export const HabitsScreen = () => {
  const insets = useSafeAreaInsets();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const fetchCurrentUser = useAuthStore((state) => state.fetchCurrentUser);

  const [defaultHabits, setDefaultHabits] = useState<Habit[]>([]);
  const [myHabits, setMyHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [addingHabitIds, setAddingHabitIds] = useState<string[]>([]);
  const [removingHabitIds, setRemovingHabitIds] = useState<string[]>([]);

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

        const [defaultData, myData] = await Promise.all([
          habitService.getDefaultHabits(token),
          habitService.getUserHabits(userId, token),
        ]);

        setDefaultHabits(defaultData);
        setMyHabits(myData);
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
    [resolveUserId, token]
  );

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    if (!token) {
      setDefaultHabits([]);
      setMyHabits([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    void loadHabits();
  }, [hasHydrated, loadHabits, token]);

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
        const addedHabit = await habitService.addDefaultHabitToCurrentUser(habit.id, token);

        setMyHabits((prev) => {
          const normalizedAddedName = normalizeName(addedHabit.name);
          const alreadyExists = prev.some(
            (existing) =>
              existing.id === addedHabit.id || normalizeName(existing.name) === normalizedAddedName
          );

          if (alreadyExists) {
            return prev;
          }

          return [addedHabit, ...prev];
        });
      } catch (addError) {
        const message = isApiError(addError)
          ? addError.message
          : 'Could not add habit. Please try again.';
        Alert.alert('Error', message);
      } finally {
        setAddingHabitIds((prev) => prev.filter((habitId) => habitId !== habit.id));
      }
    },
    [myHabitNames, token]
  );

  const handleRemoveMyHabit = useCallback(
    async (habitId: string) => {
      if (!token) {
        return;
      }

      const previousHabits = myHabits;
      setRemovingHabitIds((prev) => [...prev, habitId]);
      setMyHabits((prev) => prev.filter((habit) => habit.id !== habitId));

      try {
        await habitService.deleteHabit(habitId, token);
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
    [myHabits, token]
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
              error={error}
              onRemoveHabit={handleRemoveMyHabit}
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
