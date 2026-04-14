import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Habit } from '../types/habit';

interface MyHabitsScreenProps {
  habits: Habit[];
  loading: boolean;
  refreshing: boolean;
  removingHabitIds: string[];
  error: string | null;
  onRemoveHabit: (habitId: string) => void;
  onRetry: () => void;
}

export const MyHabitsScreen = ({
  habits,
  loading,
  refreshing,
  removingHabitIds,
  error,
  onRemoveHabit,
  onRetry,
}: MyHabitsScreenProps) => {
  if (loading && habits.length === 0) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#0f766e" />
        <Text style={styles.subtitle}>Loading your habits...</Text>
      </View>
    );
  }

  if (error && habits.length === 0) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.title}>Could not load your habits</Text>
        <Text style={styles.subtitle}>{error}</Text>
        <Pressable onPress={onRetry} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
          <Text style={styles.retryButtonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      data={habits}
      keyExtractor={(item) => item.id}
      contentContainerStyle={habits.length === 0 ? styles.emptyContainer : styles.listContent}
      onRefresh={onRetry}
      refreshing={refreshing}
      renderItem={({ item }) => {
        const isRemoving = removingHabitIds.includes(item.id);

        return (
          <View style={styles.card}>
            <View style={styles.cardMain}>
              <Text style={styles.habitName}>{item.name}</Text>
              <Text style={styles.habitMeta}>{item.frequency} • {item.type}</Text>
            </View>
            <Pressable
              onPress={() => onRemoveHabit(item.id)}
              disabled={isRemoving}
              style={({ pressed }) => [
                styles.removeButton,
                isRemoving && styles.removeButtonDisabled,
                pressed && !isRemoving ? styles.pressed : null,
              ]}
            >
              <Text style={styles.removeButtonText}>{isRemoving ? '...' : 'Remove'}</Text>
            </Pressable>
          </View>
        );
      }}
      ListEmptyComponent={
        <View style={styles.centeredContainer}>
          <Text style={styles.title}>No habits yet</Text>
          <Text style={styles.subtitle}>Add one from the Default Habits tab.</Text>
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
  removeButton: {
    minWidth: 80,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#be123c',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  removeButtonDisabled: {
    backgroundColor: '#fb7185',
  },
  removeButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
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
