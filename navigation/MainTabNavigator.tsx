import { MaterialCommunityIcons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HabitsScreen } from '../screens/HabitsScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import type { MainTabParamList } from '../types/navigation';

const Tab = createBottomTabNavigator<MainTabParamList>();

type TabIconName = 'check-circle-outline' | 'home-outline' | 'account-outline';

const tabIconMap: Record<keyof MainTabParamList, TabIconName> = {
  Habits: 'check-circle-outline',
  Home: 'home-outline',
  Profile: 'account-outline',
};

export const MainTabNavigator = () => {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        headerTitleAlign: 'center',
        tabBarActiveTintColor: '#0f766e',
        tabBarInactiveTintColor: '#64748b',
        tabBarStyle: {
          height: 72,
          paddingBottom: 16,
          paddingTop: 8,
          backgroundColor: '#ffffff',
          borderTopColor: '#e2e8f0',
        },
        tabBarIcon: ({ color, size }) => {
          const iconName = tabIconMap[route.name as keyof MainTabParamList];
          return <MaterialCommunityIcons name={iconName} color={color} size={size} />;
        },
      })}
    >
      <Tab.Screen name="Habits" component={HabitsScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};
