import { Alert, ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button } from '../components/Button';
import { HabitActionMenu } from '../components/HabitActionMenu';
import { HabitListItem } from '../components/HabitListItem';
import type { Habit, HabitCompletionMap } from '../types/habit';

interface MyHabitsScreenProps {
  habits: Habit[];
  loading: boolean;
  refreshing: boolean;
  removingHabitIds: string[];
  completingHabitIds: string[];
  completedHabitMap: HabitCompletionMap;
  error: string | null;
  onCreateHabit: () => void;
  onEditHabit: (habit: Habit) => void;
  onViewHabitDetails: (habit: Habit) => void;
  onRemoveHabit: (habitId: string) => void;
  onCompleteHabit: (habit: Habit) => void;
  onRetry: () => void;
}

export const MyHabitsScreen = ({
  habits,
  loading,
  refreshing,
  removingHabitIds,
  completingHabitIds,
  completedHabitMap,
  error,
  onCreateHabit,
  onEditHabit,
  onViewHabitDetails,
  onRemoveHabit,
  onCompleteHabit,
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
    <View style={styles.screen}>
      <FlatList
        data={habits}
        keyExtractor={(item) => item.id}
        contentContainerStyle={habits.length === 0 ? styles.emptyContainer : styles.listContent}
        onRefresh={onRetry}
        refreshing={refreshing}
        renderItem={({ item }) => {
          const isRemoving = removingHabitIds.includes(item.id);
          const isCompleting = completingHabitIds.includes(item.id);
          const isCompleted = !!completedHabitMap[item.id];
          const canEdit = !item.sourceDefaultHabitId;
          const isDefaultDerived = !!item.sourceDefaultHabitId;

          const handleDelete = () => {
            const title = isDefaultDerived ? 'Remove from My Habits' : 'Delete habit';
            const message = isDefaultDerived
              ? `Remove "${item.name}" from My Habits?\n\nThis habit will still be available in Default Habits.`
              : `Delete "${item.name}" permanently?`;

            Alert.alert(title, message, [
              { text: 'Cancel', style: 'cancel' },
              {
                text: isDefaultDerived ? 'Remove' : 'Delete',
                style: 'destructive',
                onPress: () => onRemoveHabit(item.id),
              },
            ]);
          };

          return (
            <HabitListItem
              habit={item}
              completed={isCompleted}
              completionDisabled={isRemoving || isCompleting || isCompleted}
              onToggleComplete={() => onCompleteHabit(item)}
              trailing={
                <HabitActionMenu
                  habit={item}
                  canEdit={canEdit}
                  disabled={isRemoving}
                  onEdit={onEditHabit}
                  onViewDetails={onViewHabitDetails}
                  onDelete={handleDelete}
                />
              }
            />
          );
        }}
        ListEmptyComponent={
          <View style={styles.centeredContainer}>
            <Text style={styles.title}>No habits yet</Text>
            <Text style={styles.subtitle}>Create your first habit to get started.</Text>
            <View style={styles.emptyAction}>
              <Button title="Add your first habit" onPress={onCreateHabit} />
            </View>
          </View>
        }
      />

      {habits.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add habit"
          onPress={onCreateHabit}
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        >
          <MaterialCommunityIcons name="plus" size={28} color="#ffffff" />
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
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
  emptyAction: {
    width: '100%',
    marginTop: 20,
    maxWidth: 280,
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
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0f766e',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#0f172a',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  fabPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
});
