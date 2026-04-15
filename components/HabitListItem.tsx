import { ReactNode } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Habit } from '../types/habit';

interface HabitListItemProps {
  habit: Habit;
  trailing: ReactNode;
  subdued?: boolean;
  showTracking?: boolean;
  completed?: boolean;
  completionDisabled?: boolean;
  onToggleComplete?: () => void;
}

export const HabitListItem = ({
  habit,
  trailing,
  subdued = false,
  showTracking = true,
  completed = false,
  completionDisabled = false,
  onToggleComplete,
}: HabitListItemProps) => {

  return (
    <View style={[styles.card, completed && styles.cardCompleted, subdued && styles.cardDisabled]}>
      {showTracking ? (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel={`Mark ${habit.name} as completed`}
          accessibilityState={{ checked: completed, disabled: completionDisabled }}
          disabled={completionDisabled}
          hitSlop={8}
          onPress={onToggleComplete}
          style={({ pressed }) => [
            styles.checkbox,
            completionDisabled && styles.checkboxDisabled,
            pressed && !completionDisabled && styles.checkboxPressed,
          ]}
        >
          <MaterialCommunityIcons
            name={completed ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
            size={22}
            color={completed ? '#0f766e' : '#94a3b8'}
          />
        </Pressable>
      ) : null}
      <View style={styles.cardMain}>
        <Text style={[styles.habitName, completed && styles.habitNameCompleted, subdued && styles.habitNameDisabled]}>
          {habit.name}
        </Text>
        <Text style={[styles.habitMeta, completed && styles.habitMetaCompleted, subdued && styles.habitMetaDisabled]}>
          {habit.frequency} • {habit.type}
        </Text>
      </View>
      <View style={styles.cardRight}>
        {showTracking ? (
          <View style={styles.streakSlot}>
            <View style={[styles.streakBadge, subdued && styles.streakBadgeDisabled]}>
              <Text style={styles.streakBadgeIcon}>🔥</Text>
              <Text style={styles.streakBadgeCount}>{habit.currentStreak}</Text>
            </View>
          </View>
        ) : null}
        {trailing}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
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
  cardDisabled: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  cardCompleted: {
    backgroundColor: '#ecfdf3',
    borderColor: '#bbf7d0',
  },
  cardMain: {
    flex: 1,
    marginRight: 10,
  },
  checkbox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxPressed: {
    backgroundColor: '#e2e8f0',
  },
  checkboxDisabled: {
    opacity: 0.85,
  },
  cardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  habitName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  habitNameCompleted: {
    color: '#166534',
  },
  habitNameDisabled: {
    color: '#94a3b8',
  },
  habitMeta: {
    marginTop: 4,
    fontSize: 12,
    color: '#64748b',
    textTransform: 'capitalize',
  },
  habitMetaCompleted: {
    color: '#4d7c0f',
  },
  streakSlot: {
    minWidth: 36,
    minHeight: 28,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#fff7ed',
  },
  streakBadgeDisabled: {
    backgroundColor: '#f8fafc',
  },
  streakBadgeIcon: {
    fontSize: 12,
    lineHeight: 14,
  },
  streakBadgeCount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#c2410c',
  },
  habitMetaDisabled: {
    color: '#cbd5e1',
  },
});