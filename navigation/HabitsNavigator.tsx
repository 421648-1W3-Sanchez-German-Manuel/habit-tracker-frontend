import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CreateHabitScreen } from '../screens/CreateHabitScreen';
import { HabitsScreen } from '../screens/HabitsScreen';
import type { HabitsStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<HabitsStackParamList>();

export const HabitsNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#ffffff' },
        headerTintColor: '#0f172a',
        headerTitleAlign: 'center',
      }}
    >
      <Stack.Screen name="HabitsHome" component={HabitsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CreateHabit" component={CreateHabitScreen} options={{ title: 'Create Habit' }} />
    </Stack.Navigator>
  );
};