import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Button } from '../components/Button';
import { buildLogsByHabitId, getTodayLocalDate } from '../services/completionService';
import { habitService } from '../services/habitService';
import { useAuthStore } from '../store/authStore';
import { isApiError } from '../types/api';
import type { Habit, HabitLog, HabitStreakResponse } from '../types/habit';

type HeatmapRange = 60 | 90;
type LogsByDate = Record<string, HabitLog[]>;
type CountsByDate = Record<string, number>;

interface Achievement {
  id: string;
  icon: string;
  title: string;
  unlocked: boolean;
}

const getDateNumeric = (value: string) => Number.parseInt(value.slice(0, 10).replace(/-/g, ''), 10);

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getMondayBasedWeekday = (date: Date) => {
  const weekday = date.getDay();
  return weekday === 0 ? 6 : weekday - 1;
};

const getWeekStartDateString = () => {
  const date = new Date();
  const day = date.getDay();
  const shift = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + shift);
  return toDateKey(date);
};

const getDateKeysForRange = (days: number) => {
  const keys: string[] = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    keys.push(toDateKey(date));
  }

  return keys;
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

const getHeatmapColor = (count: number) => {
  if (count >= 4) {
    return '#16a34a';
  }

  if (count >= 2) {
    return '#86efac';
  }

  if (count === 1) {
    return '#dcfce7';
  }

  return '#e2e8f0';
};

const formatDayLabel = (dateKey: string) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${dateKey}T00:00:00`));

const formatDayHeading = (dateKey: string) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
  }).format(new Date(`${dateKey}T00:00:00`));

const formatMonthShort = (dateKey: string) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
  }).format(new Date(`${dateKey}T00:00:00`));

const formatActiveSince = (dateKey: string) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${dateKey}T00:00:00`));

export const ProfileScreen = () => {
  const { width } = useWindowDimensions();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const userName = useAuthStore((state) => state.user?.username ?? 'User');
  const logout = useAuthStore((state) => state.logout);

  const [habits, setHabits] = useState<Habit[]>([]);
  const [allLogs, setAllLogs] = useState<HabitLog[]>([]);
  const [countsByDate, setCountsByDate] = useState<CountsByDate>({});
  const [logsByDate, setLogsByDate] = useState<LogsByDate>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<HeatmapRange>(90);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isDayModalVisible, setIsDayModalVisible] = useState(false);

  const loadProfileData = useCallback(
    async (showRefresh = false) => {
      if (!token || !user) {
        setHabits([]);
        setAllLogs([]);
        setCountsByDate({});
        setLogsByDate({});
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
        const fetchedLogsByHabit = await buildLogsByHabitId(
          habitsWithStreaks,
          token,
          habitService.getHabitLogs
        );

        const nextAllLogs: HabitLog[] = [];
        const nextCountsByDate: CountsByDate = {};
        const nextLogsByDate: LogsByDate = {};

        Object.values(fetchedLogsByHabit).forEach((habitLogs) => {
          habitLogs.forEach((log) => {
            nextAllLogs.push(log);
            nextCountsByDate[log.date] = (nextCountsByDate[log.date] ?? 0) + 1;

            if (!nextLogsByDate[log.date]) {
              nextLogsByDate[log.date] = [];
            }

            nextLogsByDate[log.date].push(log);
          });
        });

        setHabits(habitsWithStreaks);
        setAllLogs(nextAllLogs);
        setCountsByDate(nextCountsByDate);
        setLogsByDate(nextLogsByDate);
      } catch (loadError) {
        const message = isApiError(loadError)
          ? loadError.message
          : 'Could not load your profile activity. Please try again.';
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
      void loadProfileData();
    }, [loadProfileData])
  );

  const totalHabits = habits.length;

  const bestStreak = useMemo(
    () => habits.reduce((max, habit) => Math.max(max, habit.currentStreak ?? 0), 0),
    [habits]
  );

  const completionsThisWeek = useMemo(() => {
    const weekStart = getDateNumeric(getWeekStartDateString());
    const today = getDateNumeric(getTodayLocalDate());

    return allLogs.reduce((sum, log) => {
      const logDate = getDateNumeric(log.date);
      if (logDate < weekStart || logDate > today) {
        return sum;
      }

      return sum + 1;
    }, 0);
  }, [allLogs]);

  const achievements = useMemo<Achievement[]>(
    () => [
      {
        id: 'first-completion',
        icon: '🏁',
        title: 'First habit completed',
        unlocked: allLogs.length > 0,
      },
      {
        id: 'streak-7',
        icon: '🔥',
        title: '7-day streak achieved',
        unlocked: habits.some((habit) => (habit.currentStreak ?? 0) >= 7),
      },
      {
        id: 'ten-created',
        icon: '🎯',
        title: '10 habits created',
        unlocked: habits.length >= 10,
      },
    ],
    [allLogs.length, habits]
  );

  const dateKeys = useMemo(() => getDateKeysForRange(range), [range]);

  const heatmapColumns = useMemo(() => {
    if (dateKeys.length === 0) {
      return [] as Array<Array<string | null>>;
    }

    const firstDate = new Date(`${dateKeys[0]}T00:00:00`);
    const leadingEmptyDays = getMondayBasedWeekday(firstDate);
    const paddedDays: Array<string | null> = [
      ...Array.from({ length: leadingEmptyDays }, () => null),
      ...dateKeys,
    ];

    while (paddedDays.length % 7 !== 0) {
      paddedDays.push(null);
    }

    const columns: Array<Array<string | null>> = [];
    for (let index = 0; index < paddedDays.length; index += 7) {
      columns.push(paddedDays.slice(index, index + 7));
    }

    return columns;
  }, [dateKeys]);

  const monthLabels = useMemo(() => {
    const labels: Array<{ index: number; label: string }> = [];
    let previousMonthKey: string | null = null;

    heatmapColumns.forEach((column, columnIndex) => {
      const firstDay = column.find((value): value is string => value !== null);

      if (!firstDay) {
        return;
      }

      const monthKey = firstDay.slice(0, 7);
      if (monthKey !== previousMonthKey) {
        labels.push({ index: columnIndex, label: formatMonthShort(firstDay) });
        previousMonthKey = monthKey;
      }
    });

    return labels;
  }, [heatmapColumns]);

  const activeSinceDateKey = useMemo(() => {
    if (allLogs.length === 0) {
      return getTodayLocalDate();
    }

    return allLogs.reduce((earliest, log) => (log.date < earliest ? log.date : earliest), allLogs[0].date);
  }, [allLogs]);

  const habitNameById = useMemo(
    () => Object.fromEntries(habits.map((habit) => [habit.id, habit.name])),
    [habits]
  );

  const selectedDayHabitNames = useMemo(() => {
    if (!selectedDate) {
      return [];
    }

    const dayLogs = logsByDate[selectedDate] ?? [];
    return Array.from(
      new Set(dayLogs.map((log) => habitNameById[log.habitId] ?? 'Unknown habit'))
    );
  }, [habitNameById, logsByDate, selectedDate]);

  const selectedDaySummary = useMemo(() => {
    const count = selectedDayHabitNames.length;
    return `${count} habit${count === 1 ? '' : 's'} completed`;
  }, [selectedDayHabitNames.length]);

  const cellSize = useMemo(() => {
    const horizontalPadding = 16 * 2;
    const gaps = 6 * 4;
    const available = width - horizontalPadding - gaps;
    const raw = Math.floor(available / 7);
    return Math.max(14, Math.min(raw, 22));
  }, [width]);

  const openDayDetail = (date: string) => {
    setSelectedDate(date);
    setIsDayModalVisible(true);
  };

  const closeDayDetail = () => {
    setIsDayModalVisible(false);
  };

  if (loading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#0f766e" />
        <Text style={styles.subtitle}>Loading your profile...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.errorTitle}>Could not load Profile</Text>
        <Text style={styles.errorSubtitle}>{error}</Text>
        <View style={styles.errorButtonWrap}>
          <Button title="Try again" onPress={() => void loadProfileData()} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadProfileData(true)}
            tintColor="#0f766e"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.userCard}>
          <Text style={styles.userName}>{userName}</Text>
          {user?.email ? <Text style={styles.userEmail}>{user.email}</Text> : null}
          <Text style={styles.activeSince}>{`Active since ${formatActiveSince(activeSinceDateKey)}`}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stats</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{totalHabits}</Text>
              <Text style={styles.statLabel}>Total habits</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{completionsThisWeek}</Text>
              <Text style={styles.statLabel}>Completed this week</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>🔥 {bestStreak}</Text>
              <Text style={styles.statLabel}>Best streak</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Achievements</Text>
          <View style={styles.achievementsWrap}>
            {achievements.map((achievement) => (
              <View
                key={achievement.id}
                style={[
                  styles.achievementChip,
                  achievement.unlocked ? styles.achievementUnlocked : styles.achievementLocked,
                ]}
              >
                <Text style={styles.achievementIcon}>{achievement.icon}</Text>
                <Text
                  style={[
                    styles.achievementText,
                    achievement.unlocked ? styles.achievementTextUnlocked : styles.achievementTextLocked,
                  ]}
                >
                  {achievement.title}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Activity heatmap</Text>
            <View style={styles.rangeToggle}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Show last 60 days"
                onPress={() => setRange(60)}
                style={({ pressed }) => [
                  styles.rangeButton,
                  range === 60 && styles.rangeButtonActive,
                  pressed && styles.rangeButtonPressed,
                ]}
              >
                <Text style={[styles.rangeButtonText, range === 60 && styles.rangeButtonTextActive]}>
                  60d
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Show last 90 days"
                onPress={() => setRange(90)}
                style={({ pressed }) => [
                  styles.rangeButton,
                  range === 90 && styles.rangeButtonActive,
                  pressed && styles.rangeButtonPressed,
                ]}
              >
                <Text style={[styles.rangeButtonText, range === 90 && styles.rangeButtonTextActive]}>
                  90d
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.heatmapCard}>
            <View style={styles.monthLabelsRow}>
              {monthLabels.map((monthLabel) => (
                <Text
                  key={`${monthLabel.label}-${monthLabel.index}`}
                  style={[
                    styles.monthLabel,
                    {
                      left: monthLabel.index * (cellSize + 4),
                    },
                  ]}
                >
                  {monthLabel.label}
                </Text>
              ))}
            </View>

            <View style={styles.heatmapColumns}>
              {heatmapColumns.map((column, columnIndex) => (
                <View key={`col-${columnIndex}`} style={styles.heatmapColumn}>
                  {column.map((dateKey, rowIndex) => {
                    if (!dateKey) {
                      return (
                        <View
                          key={`empty-${columnIndex}-${rowIndex}`}
                          style={[
                            styles.heatmapCell,
                            styles.heatmapCellEmpty,
                            { width: cellSize, height: cellSize },
                          ]}
                        />
                      );
                    }

                    const count = countsByDate[dateKey] ?? 0;

                    return (
                      <Pressable
                        key={dateKey}
                        accessibilityRole="button"
                        accessibilityLabel={`${formatDayLabel(dateKey)}: ${count} completions`}
                        onPress={() => openDayDetail(dateKey)}
                        style={({ pressed }) => [
                          styles.heatmapCell,
                          {
                            width: cellSize,
                            height: cellSize,
                            backgroundColor: getHeatmapColor(count),
                          },
                          pressed && styles.heatmapCellPressed,
                        ]}
                      />
                    );
                  })}
                </View>
              ))}
            </View>

            <Text style={styles.heatmapHint}>Tap a day to view completed habits.</Text>
          </View>
        </View>

        <View style={styles.logoutContainer}>
          <Button title="Log out" onPress={() => void logout()} />
        </View>
      </ScrollView>

      <Modal
        animationType="fade"
        transparent
        visible={isDayModalVisible}
        onRequestClose={closeDayDetail}
      >
        <Pressable style={styles.modalOverlay} onPress={closeDayDetail}>
          <View style={styles.daySheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.daySheetTitle}>
              {formatDayHeading(selectedDate ?? getTodayLocalDate())}
            </Text>
            <Text style={styles.daySheetSummary}>{selectedDaySummary}</Text>

            {selectedDayHabitNames.length === 0 ? (
              <Text style={styles.daySheetEmpty}>No habits completed on this day.</Text>
            ) : (
              <View style={styles.daySheetList}>
                {selectedDayHabitNames.map((name) => (
                  <View key={name} style={styles.dayHabitRow}>
                    <Text style={styles.dayHabitIcon}>✅</Text>
                    <Text style={styles.dayHabitName}>{name}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </Pressable>
      </Modal>
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
    paddingBottom: 28,
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
  errorButtonWrap: {
    marginTop: 16,
    width: '100%',
    maxWidth: 280,
  },
  userCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dbe3ee',
    padding: 16,
  },
  userName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
  },
  userEmail: {
    marginTop: 6,
    fontSize: 14,
    color: '#475569',
  },
  activeSince: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '600',
    color: '#0f766e',
  },
  section: {
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    minWidth: 104,
    flexGrow: 1,
    flexBasis: '30%',
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
  achievementsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  achievementChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  achievementUnlocked: {
    backgroundColor: '#ecfdf3',
    borderColor: '#86efac',
  },
  achievementLocked: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  achievementIcon: {
    fontSize: 16,
  },
  achievementText: {
    fontSize: 13,
    fontWeight: '700',
  },
  achievementTextUnlocked: {
    color: '#166534',
  },
  achievementTextLocked: {
    color: '#64748b',
  },
  rangeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rangeButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#dbe3ee',
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  rangeButtonActive: {
    borderColor: '#0f766e',
    backgroundColor: '#ccfbf1',
  },
  rangeButtonPressed: {
    opacity: 0.85,
  },
  rangeButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  rangeButtonTextActive: {
    color: '#0f766e',
  },
  heatmapCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbe3ee',
    padding: 12,
    gap: 10,
  },
  monthLabelsRow: {
    position: 'relative',
    height: 16,
    marginBottom: 2,
  },
  monthLabel: {
    position: 'absolute',
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  heatmapColumns: {
    flexDirection: 'row',
    gap: 4,
  },
  heatmapColumn: {
    gap: 4,
  },
  heatmapCell: {
    borderRadius: 4,
  },
  heatmapCellEmpty: {
    backgroundColor: 'transparent',
  },
  heatmapCellPressed: {
    opacity: 0.75,
  },
  heatmapHint: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  logoutContainer: {
    marginTop: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    justifyContent: 'flex-end',
  },
  daySheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingBottom: 24,
    paddingHorizontal: 16,
    gap: 10,
  },
  sheetHandle: {
    width: 44,
    height: 4,
    borderRadius: 999,
    alignSelf: 'center',
    marginBottom: 8,
    backgroundColor: '#cbd5e1',
  },
  daySheetTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
  },
  daySheetSummary: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '600',
  },
  daySheetEmpty: {
    fontSize: 14,
    color: '#64748b',
  },
  daySheetList: {
    gap: 8,
  },
  dayHabitRow: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  dayHabitIcon: {
    fontSize: 14,
  },
  dayHabitName: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '600',
  },
});
