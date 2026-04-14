import { useLayoutEffect, useEffect, useState } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { habitService } from '../services/habitService';
import { useAuthStore } from '../store/authStore';
import { isApiError } from '../types/api';
import type { Frequency, HabitType, SimilarityCheckResult } from '../types/habit';
import type { HabitsStackParamList } from '../types/navigation';
import type { RouteProp } from '@react-navigation/native';

type HabitTypeSelection = HabitType | '';
type FrequencySelection = Frequency | '';

type FormErrors = {
  name?: string;
  type?: string;
  frequency?: string;
};

const habitTypeOptions: Array<{ label: string; value: HabitType }> = [
  { label: 'Note', value: 'TEXT' },
  { label: 'Quantity', value: 'NUMBER' },
  { label: 'Completed', value: 'BOOLEAN' },
];

const frequencyOptions: Array<{ label: string; value: Frequency }> = [
  { label: 'daily', value: 'DAILY' },
  { label: 'weekly', value: 'WEEKLY' },
  { label: 'monthly', value: 'MONTHLY' },
];

const validateForm = (name: string, type: HabitTypeSelection, frequency: FrequencySelection) => {
  const errors: FormErrors = {};

  if (!name.trim()) {
    errors.name = 'Name is required';
  }

  if (!type) {
    errors.type = 'Type is required';
  }

  if (!frequency) {
    errors.frequency = 'Frequency is required';
  }

  return errors;
};

export const CreateHabitScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<HabitsStackParamList, 'CreateHabit'>>();
  const route = useRoute<RouteProp<HabitsStackParamList, 'CreateHabit'>>();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const fetchCurrentUser = useAuthStore((state) => state.fetchCurrentUser);

  const mode = route.params?.mode ?? 'create';
  const habit = route.params?.habit;
  const isEditMode = mode === 'edit';
  const isViewMode = mode === 'view';
  const isReadOnly = isViewMode;

  const [name, setName] = useState('');
  const [selectedType, setSelectedType] = useState<HabitTypeSelection>('');
  const [selectedFrequency, setSelectedFrequency] = useState<FrequencySelection>('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [checkingSimilarity, setCheckingSimilarity] = useState(false);
  const [creatingHabit, setCreatingHabit] = useState(false);

  const submitting = checkingSimilarity || creatingHabit;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: isEditMode ? 'Edit Habit' : isViewMode ? 'Habit Details' : 'Create Habit',
    });
  }, [isEditMode, isViewMode, navigation]);

  useEffect(() => {
    if (mode === 'create') {
      setName('');
      setSelectedType('');
      setSelectedFrequency('');
      setErrors({});
      setApiError(null);
      return;
    }

    if (!habit) {
      setApiError('Habit data is missing.');
      return;
    }

    setName(habit.name);
    setSelectedType(habit.type);
    setSelectedFrequency(habit.frequency);
    setErrors({});
    setApiError(null);
  }, [habit, mode]);

  const resolveUserId = async () => {
    if (user?.id) {
      return user.id;
    }

    const currentUser = await fetchCurrentUser();
    return currentUser?.id ?? null;
  };

  const clearFieldError = (field: keyof FormErrors) => {
    if (!errors[field]) {
      return;
    }

    setErrors((previous) => ({ ...previous, [field]: undefined }));
  };

  const handleSubmit = async () => {
    if (submitting || isReadOnly) {
      return;
    }

    if (!token) {
      Alert.alert('Session expired', `Please sign in again to ${isEditMode ? 'update' : 'create'} a habit.`);
      return;
    }

    const nextErrors = validateForm(name, selectedType, selectedFrequency);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setApiError(null);
    setCheckingSimilarity(true);

    try {
      const habitType = selectedType as HabitType;
      const frequency = selectedFrequency as Frequency;
      const normalizedName = name.trim();

      if (isEditMode) {
        if (!habit) {
          throw new Error('Habit data is missing.');
        }

        await habitService.updateHabit(
          habit.id,
          {
            name: normalizedName,
            type: habitType,
            frequency,
          },
          token
        );

        navigation.goBack();
        return;
      }

      const userId = await resolveUserId();

      if (!userId) {
        throw new Error('Could not identify the current user.');
      }

      const similarHabit = await habitService.checkSimilarity(normalizedName, token);

      if (similarHabit) {
        showSimilarHabitAlert(similarHabit);
        return;
      }

      setCheckingSimilarity(false);
      setCreatingHabit(true);

      await habitService.createHabit(
        {
          userId,
          name: normalizedName,
          type: habitType,
          frequency,
        },
        token
      );

      navigation.goBack();
    } catch (error) {
      const message = isApiError(error)
        ? error.message
        : `Could not ${isEditMode ? 'update' : 'create'} habit. Please try again.`;
      setApiError(message);
    } finally {
      setCheckingSimilarity(false);
      setCreatingHabit(false);
    }
  };

  const showSimilarHabitAlert = (result: SimilarityCheckResult) => {
    Alert.alert(
      'Similar habit already exists',
      `A similar habit already exists in ${result.belongsTo}:\n\n"${result.habit.name}"`,
      [{ text: 'OK' }]
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{isEditMode ? 'Edit habit' : isViewMode ? 'Habit details' : 'Create habit'}</Text>
        <Text style={styles.subtitle}>
          {isEditMode
            ? 'Update the habit details and save your changes.'
            : isViewMode
              ? 'Review the habit details without making changes.'
              : 'Add a habit and choose how it should be tracked.'}
        </Text>
        {checkingSimilarity && !isEditMode ? (
          <Text style={styles.statusText}>Checking for similar habits...</Text>
        ) : null}

        {apiError ? <Text style={styles.apiError}>{apiError}</Text> : null}

        <Input
          label="Name / Description"
          placeholder="Drink water every morning"
          value={name}
          onChangeText={(value) => {
            if (isReadOnly) {
              return;
            }

            setName(value);
            clearFieldError('name');
          }}
          error={errors.name}
          autoCapitalize="sentences"
          multiline
          editable={!isReadOnly}
        />

        <Text style={styles.sectionTitle}>Type</Text>
        <View style={styles.optionGrid}>
          {habitTypeOptions.map((option) => {
            const isSelected = selectedType === option.value;

            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  if (isReadOnly) {
                    return;
                  }

                  setSelectedType(option.value);
                  clearFieldError('type');
                }}
                style={({ pressed }) => [
                  styles.option,
                  isSelected && styles.optionSelected,
                  isReadOnly && styles.optionReadOnly,
                  pressed && styles.optionPressed,
                ]}
                disabled={isReadOnly}
              >
                <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {errors.type ? <Text style={styles.fieldError}>{errors.type}</Text> : null}

        <Text style={styles.sectionTitle}>Frequency</Text>
        <View style={styles.optionGrid}>
          {frequencyOptions.map((option) => {
            const isSelected = selectedFrequency === option.value;

            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  if (isReadOnly) {
                    return;
                  }

                  setSelectedFrequency(option.value);
                  clearFieldError('frequency');
                }}
                style={({ pressed }) => [
                  styles.option,
                  isSelected && styles.optionSelected,
                  isReadOnly && styles.optionReadOnly,
                  pressed && styles.optionPressed,
                ]}
                disabled={isReadOnly}
              >
                <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {errors.frequency ? <Text style={styles.fieldError}>{errors.frequency}</Text> : null}

        <View style={styles.submitContainer}>
          {isViewMode ? (
            <Button title="Done" onPress={() => navigation.goBack()} />
          ) : (
            <Button
              title={isEditMode ? 'Save changes' : 'Create habit'}
              onPress={handleSubmit}
              loading={submitting}
              disabled={submitting}
            />
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 12,
    color: '#475569',
    fontSize: 14,
    lineHeight: 20,
  },
  statusText: {
    marginBottom: 12,
    color: '#0f766e',
    fontSize: 13,
    fontWeight: '600',
  },
  apiError: {
    marginBottom: 16,
    color: '#b91c1c',
    fontSize: 14,
    fontWeight: '600',
  },
  sectionTitle: {
    marginTop: 6,
    marginBottom: 10,
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2937',
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  option: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 96,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  optionSelected: {
    borderColor: '#0f766e',
    backgroundColor: '#ecfeff',
  },
  optionPressed: {
    opacity: 0.88,
  },
  optionReadOnly: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    opacity: 0.75,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  optionLabelSelected: {
    color: '#0f766e',
  },
  fieldError: {
    marginTop: 8,
    color: '#b91c1c',
    fontSize: 13,
  },
  submitContainer: {
    marginTop: 28,
  },
});