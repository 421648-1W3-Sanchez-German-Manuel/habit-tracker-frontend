import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HabitActionMenu } from '../components/HabitActionMenu';
import { HabitListItem } from '../components/HabitListItem';
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

interface SocialActivityItem {
  id: string;
  friendName: string;
  habitName: string;
  streak: number;
}

const mockSocialActivity: SocialActivityItem[] = [
  { id: '1', friendName: 'Juan', habitName: 'Drink water', streak: 5 },
  { id: '2', friendName: 'Sofia', habitName: 'Read 10 pages', streak: 12 },
  { id: '3', friendName: 'Ana', habitName: 'Stretch 15 minutes', streak: 3 },
  { id: '4', friendName: 'Pedro', habitName: 'Morning walk', streak: 8 },
  { id: '5', friendName: 'Lucia', habitName: 'Meditation', streak: 0 },
];

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

const mergeHabitLog = (logs: HabitLog[], log: HabitLog): HabitLog[] => {
  const withoutDuplicatedLog = logs.filter((entry) => entry.id !== log.id);
  return [log, ...withoutDuplicatedLog];
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

const getDateNumeric = (value: string) => Number.parseInt(value.slice(0, 10).replace(/-/g, ''), 10);

const getWeekStartDateString = () => {
  const date = new Date();
  const day = date.getDay();
  const shift = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + shift);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const dayOfMonth = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${dayOfMonth}`;
};

const getGreetingByHour = () => {
  const hour = new Date().getHours();

  if (hour < 12) {
    return 'Morning';
  }

  if (hour < 18) {
    return 'Afternoon';
  }

  return 'Evening';
};

interface SocialActionMenuProps {
  item: SocialActivityItem;
}

const SocialActionMenu = ({ item }: SocialActionMenuProps) => {
  const [visible, setVisible] = useState(false);

  const closeMenu = () => setVisible(false);

  const handleAction = (action: 'Add this habit' | 'Congratulate') => {
    closeMenu();
    console.log(`[Social mock] ${action} - ${item.friendName}: ${item.habitName}`);
    Alert.alert('Mock action', `${action} for ${item.friendName}'s "${item.habitName}"`);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open social actions for ${item.friendName}`}
        accessibilityHint="Opens mock social actions"
        onPress={() => setVisible(true)}
        style={({ pressed }) => [styles.menuTrigger, pressed && styles.menuTriggerPressed]}
      >
        <MaterialCommunityIcons name="dots-vertical" size={20} color="#334155" />
      </Pressable>

      <Modal animationType="fade" transparent visible={visible} onRequestClose={closeMenu}>
        <Pressable style={styles.modalOverlay} onPress={closeMenu}>
          <View style={styles.socialMenuSheet}>
            <View style={styles.sheetHandle} />

            <Pressable style={({ pressed }) => [styles.socialMenuItem, pressed && styles.socialMenuItemPressed]} onPress={() => handleAction('Add this habit')}>
              <MaterialCommunityIcons name="playlist-plus" size={20} color="#0f172a" />
              <Text style={styles.socialMenuLabel}>Add this habit</Text>
            </Pressable>

            <Pressable style={({ pressed }) => [styles.socialMenuItem, pressed && styles.socialMenuItemPressed]} onPress={() => handleAction('Congratulate')}>
              <MaterialCommunityIcons name="hand-clap" size={20} color="#0f172a" />
              <Text style={styles.socialMenuLabel}>Congratulate</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

export const HomeScreen = () => {
  const insets = useSafeAreaInsets();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);

  const [habits, setHabits] = useState<Habit[]>([]);
  const [logsByHabitId, setLogsByHabitId] = useState<HabitLogsByHabitId>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completingHabitIds, setCompletingHabitIds] = useState<string[]>([]);

  const loadHomeData = useCallback(
    async (showRefresh = false) => {
      if (!token || !user) {
        setHabits([]);
        setLogsByHabitId({});
        setLoading(false);
        return;
      }

      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      try {
        const [userHabits, streaks] = await Promise.all([
          habitService.getUserHabits(user.id, token),
          habitService.getHabitsWithStreaks(token),
        ]);

        const habitsWithStreaks = applyStreaks(userHabits, streaks);
        const logs = await buildLogsByHabitId(habitsWithStreaks, token, habitService.getHabitLogs);

        setHabits(habitsWithStreaks);
        setLogsByHabitId(logs);
      } catch (loadError) {
        const message = isApiError(loadError)
          ? loadError.message
          : 'Could not load your home activity. Please try again.';
        setError(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, user]
  );

  useFocusEffect(
    useCallback(() => {
      void loadHomeData();
    }, [loadHomeData])
  );

  const isHabitCompletedForHabit = useCallback(
    (habit: Habit) => isHabitCompleted(habit, logsByHabitId[habit.id] ?? []),
    [logsByHabitId]
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
            const refreshedLogs = await habitService.getHabitLogs(habitId, token);
            setLogsByHabitId((prev) => ({
              ...prev,
              [habitId]: refreshedLogs,
            }));
            return;
          }

          await habitService.deleteHabitLogById(currentPeriodLog.id, token);
          setLogsByHabitId((prev) => ({
            ...prev,
            [habitId]: (prev[habitId] ?? []).filter((entry) => entry.id !== currentPeriodLog.id),
          }));
        }
      } catch (completeError) {
        const isDuplicateOnCheck =
          nextCompleted &&
          isDuplicateCompletionError(
            isApiError(completeError) ? completeError.status : undefined,
            isApiError(completeError) ? completeError.message : ''
          );

        if (isDuplicateOnCheck) {
          const refreshedLogs = await habitService.getHabitLogs(habitId, token);
          setLogsByHabitId((prev) => ({
            ...prev,
            [habitId]: refreshedLogs,
          }));
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
    [completingHabitIds, logsByHabitId, token]
  );

  const greeting = useMemo(() => `Good ${getGreetingByHour()}, ${user?.username ?? 'there'}`, [user?.username]);

  const completedTodayCount = useMemo(
    () => habits.filter((habit) => isHabitCompletedForHabit(habit)).length,
    [habits, isHabitCompletedForHabit]
  );

  const totalTodayCount = habits.length;
  const habitsToCompleteToday = useMemo(
    () => habits.filter((habit) => !isHabitCompletedForHabit(habit)),
    [habits, isHabitCompletedForHabit]
  );

  const bestStreak = useMemo(
    () => habits.reduce((max, habit) => Math.max(max, habit.currentStreak ?? 0), 0),
    [habits]
  );

  const completedThisWeek = useMemo(() => {
    const weekStart = getDateNumeric(getWeekStartDateString());
    const today = getDateNumeric(getTodayLocalDate());

    return Object.values(logsByHabitId).reduce((sum, logs) => {
      const weeklyLogs = logs.filter((log) => {
        const logDate = getDateNumeric(log.date);
        return logDate >= weekStart && logDate <= today;
      });

      return sum + weeklyLogs.length;
    }, 0);
  }, [logsByHabitId]);

  const progressRatio = totalTodayCount === 0 ? 0 : completedTodayCount / totalTodayCount;

  if (loading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#0f766e" />
        <Text style={styles.subtitle}>Loading your home activity...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.errorTitle}>Could not load Home</Text>
        <Text style={styles.errorSubtitle}>{error}</Text>
        <Pressable onPress={() => void loadHomeData()} style={({ pressed }) => [styles.retryButton, pressed && styles.retryPressed]}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: Math.max(insets.top, 8) }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadHomeData(true)} tintColor="#0f766e" />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerCard}>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.summaryText}>
            {habitsToCompleteToday.length} habits to complete today
          </Text>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>{completedTodayCount}/{totalTodayCount} completed</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressRatio * 100}%` }]} />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Today</Text>
            <Text style={styles.sectionSubtitle}>Based on your schedule</Text>
          </View>

          {habitsToCompleteToday.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>All set for today</Text>
              <Text style={styles.emptySubtitle}>You completed all your scheduled habits.</Text>
            </View>
          ) : (
            <View style={styles.listStack}>
              {habitsToCompleteToday.map((habit) => {
                const isCompleting = completingHabitIds.includes(habit.id);
                return (
                  <HabitListItem
                    key={habit.id}
                    habit={habit}
                    completed={isHabitCompletedForHabit(habit)}
                    completionDisabled={isCompleting}
                    onToggleComplete={() => {
                      void handleCompleteHabit(habit);
                    }}
                    trailing={
                      <HabitActionMenu
                        habit={habit}
                        canEdit={!habit.sourceDefaultHabitId}
                        disabled={isCompleting}
                        onEdit={() => {
                          Alert.alert('Tip', 'Open My Habits to edit this habit.');
                        }}
                        onViewDetails={() => {
                          Alert.alert('Tip', 'Open My Habits to view details.');
                        }}
                        onDelete={() => {
                          Alert.alert('Tip', 'Open My Habits to remove this habit.');
                        }}
                      />
                    }
                  />
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stats</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>🔥 {bestStreak}</Text>
              <Text style={styles.statLabel}>Best streak</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{completedThisWeek}</Text>
              <Text style={styles.statLabel}>Completed this week</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Social</Text>
            {/* <Text style={styles.mockBadge}>Mock data</Text> */}
          </View>

          <View style={styles.listStack}>
            {mockSocialActivity.map((item) => (
              <View key={item.id} style={styles.socialCard}>
                <View style={styles.socialMain}>
                  <Text style={styles.socialText}>
                    <Text style={styles.socialFriend}>{item.friendName}</Text>
                    {` completed "${item.habitName}"`}
                  </Text>
                  <View style={styles.socialStreakRow}>
                    <Text style={styles.socialStreak}>🔥 {item.streak}</Text>
                  </View>
                </View>
                <SocialActionMenu item={item} />
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 18,
  },
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f8fafc',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },
  errorSubtitle: {
    marginTop: 8,
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#0f766e',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryPressed: {
    opacity: 0.85,
  },
  retryText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  headerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dbe3ee',
    padding: 16,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
  },
  summaryText: {
    marginTop: 8,
    fontSize: 14,
    color: '#475569',
  },
  progressRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '700',
  },
  progressTrack: {
    marginTop: 8,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#0f766e',
  },
  section: {
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  listStack: {
    gap: 10,
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbe3ee',
    padding: 14,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  emptySubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#64748b',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbe3ee',
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  statLabel: {
    marginTop: 4,
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  mockBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f766e',
    backgroundColor: '#ccfbf1',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  socialCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbe3ee',
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  socialMain: {
    flex: 1,
    marginRight: 8,
  },
  socialText: {
    fontSize: 14,
    color: '#1e293b',
    lineHeight: 20,
  },
  socialFriend: {
    fontWeight: '800',
    color: '#0f172a',
  },
  socialStreakRow: {
    marginTop: 6,
  },
  socialStreak: {
    fontSize: 13,
    fontWeight: '700',
    color: '#c2410c',
  },
  menuTrigger: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTriggerPressed: {
    backgroundColor: '#e2e8f0',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    justifyContent: 'flex-end',
  },
  socialMenuSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingBottom: 18,
    paddingHorizontal: 16,
  },
  sheetHandle: {
    width: 44,
    height: 4,
    borderRadius: 999,
    alignSelf: 'center',
    marginBottom: 12,
    backgroundColor: '#cbd5e1',
  },
  socialMenuItem: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  socialMenuItemPressed: {
    backgroundColor: '#f8fafc',
  },
  socialMenuLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
});
