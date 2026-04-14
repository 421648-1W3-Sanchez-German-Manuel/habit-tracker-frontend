import { useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Habit } from '../types/habit';

type MenuIcon = 'pencil-outline' | 'eye-outline' | 'trash-can-outline';

interface HabitActionMenuProps {
  habit: Habit;
  canEdit: boolean;
  disabled?: boolean;
  onEdit: (habit: Habit) => void;
  onViewDetails: (habit: Habit) => void;
  onDelete: (habit: Habit) => void;
}

export const HabitActionMenu = ({
  habit,
  canEdit,
  disabled = false,
  onEdit,
  onViewDetails,
  onDelete,
}: HabitActionMenuProps) => {
  const [visible, setVisible] = useState(false);

  const closeMenu = () => setVisible(false);

  const handleEdit = () => {
    closeMenu();
    onEdit(habit);
  };

  const handleViewDetails = () => {
    closeMenu();
    onViewDetails(habit);
  };

  const handleDelete = () => {
    closeMenu();
    onDelete(habit);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open actions for ${habit.name}`}
        accessibilityHint="Opens edit, details, and delete options"
        disabled={disabled}
        onPress={() => setVisible(true)}
        style={({ pressed }) => [styles.trigger, pressed && !disabled && styles.pressed, disabled && styles.disabled]}
      >
        <MaterialCommunityIcons name="dots-vertical" size={22} color={disabled ? '#cbd5e1' : '#334155'} />
      </Pressable>

      <Modal animationType="fade" transparent visible={visible} onRequestClose={closeMenu}>
        <Pressable style={styles.overlay} onPress={closeMenu}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />

            {canEdit ? (
              <MenuAction
                icon="pencil-outline"
                label="Edit"
                onPress={handleEdit}
                destructive={false}
              />
            ) : null}
            <MenuAction
              icon="eye-outline"
              label="View details"
              onPress={handleViewDetails}
              destructive={false}
            />
            <MenuAction icon="trash-can-outline" label="Delete" onPress={handleDelete} destructive />
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

interface MenuActionProps {
  icon: MenuIcon;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

const MenuAction = ({ icon, label, onPress, destructive = false, disabled = false }: MenuActionProps) => {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && !disabled && styles.actionPressed, disabled && styles.actionDisabled]}
    >
      <MaterialCommunityIcons
        name={icon}
        size={20}
        color={disabled ? '#94a3b8' : destructive ? '#b91c1c' : '#0f172a'}
      />
      <Text style={[styles.actionLabel, destructive && styles.actionLabelDestructive, disabled && styles.actionLabelDisabled]}>{label}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  trigger: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    backgroundColor: '#e2e8f0',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
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
  action: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  actionPressed: {
    backgroundColor: '#f8fafc',
  },
  actionDisabled: {
    opacity: 0.7,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  actionLabelDestructive: {
    color: '#b91c1c',
  },
  actionLabelDisabled: {
    color: '#94a3b8',
  },
});