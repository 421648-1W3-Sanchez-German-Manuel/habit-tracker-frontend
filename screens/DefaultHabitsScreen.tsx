import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Habit } from '../types/habit';

interface DefaultHabitsScreenProps {
  defaultHabits: Habit[];
  myHabits: Habit[];
  loading: boolean;
  refreshing: boolean;
  addingHabitIds: string[];
  error: string | null;
  onAddHabit: (habit: Habit) => void;
  onRetry: () => void;
}

const normalizeName = (value: string) => value.trim().toLowerCase();

export const DefaultHabitsScreen = ({
  defaultHabits,
  myHabits,
  loading,
  refreshing,
  addingHabitIds,
  error,
  onAddHabit,
  onRetry,
}: DefaultHabitsScreenProps) => {
  const myHabitNames = new Set(myHabits.map((habit) => normalizeName(habit.name)));

  if (loading && defaultHabits.length === 0) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#0f766e" />
        <Text style={styles.subtitle}>Loading default habits...</Text>
      </View>
    );
  }

  if (error && defaultHabits.length === 0) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.title}>Could not load default habits</Text>
        <Text style={styles.subtitle}>{error}</Text>
        <Pressable onPress={onRetry} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
          <Text style={styles.retryButtonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      data={defaultHabits}
      keyExtractor={(item) => item.id}
      contentContainerStyle={defaultHabits.length === 0 ? styles.emptyContainer : styles.listContent}
      onRefresh={onRetry}
      refreshing={refreshing}
      renderItem={({ item }) => {
        const alreadyAdded = myHabitNames.has(normalizeName(item.name));
        const isAdding = addingHabitIds.includes(item.id);

        return (
          <View style={styles.card}>
            <View style={styles.cardMain}>
              <Text style={styles.habitName}>{item.name}</Text>
              <Text style={styles.habitMeta}>{item.frequency} • {item.type}</Text>
            </View>
            <Pressable
              onPress={() => onAddHabit(item)}
              disabled={alreadyAdded || isAdding}
              style={({ pressed }) => [
                styles.addButton,
                (alreadyAdded || isAdding) && styles.addButtonDisabled,
                pressed && !(alreadyAdded || isAdding) ? styles.pressed : null,
              ]}
            >
              <Text style={styles.addButtonText}>{alreadyAdded ? 'Added' : isAdding ? '...' : '+'}</Text>
            </Pressable>
          </View>
        );
      }}
      ListEmptyComponent={
        <View style={styles.centeredContainer}>
          <Text style={styles.title}>No default habits available</Text>
          <Text style={styles.subtitle}>Pull down to refresh the list.</Text>
        </View>
      }
    />
  );
};

const styles = StyleSheet.create({
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f8fafc',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 10,
  },
  emptyContainer: {
    flexGrow: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbe3ee',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardMain: {
    flex: 1,
    marginRight: 10,
  },
  habitName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  habitMeta: {
    marginTop: 4,
    fontSize: 12,
    color: '#64748b',
    textTransform: 'capitalize',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0f766e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 18,
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#0f766e',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  },
});
