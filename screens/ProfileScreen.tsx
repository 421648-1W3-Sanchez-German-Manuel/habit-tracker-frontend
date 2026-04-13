import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { useAuthStore } from '../store/authStore';

export const ProfileScreen = () => {
  const userName = useAuthStore((state) => state.user?.username ?? 'User');
  const logout = useAuthStore((state) => state.logout);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{`Welcome ${userName}`}</Text>
      <View style={styles.logoutContainer}>
        <Button title="Log out" onPress={() => void logout()} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f8fafc',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    color: '#0f172a',
  },
  logoutContainer: {
    marginTop: 24,
    width: '100%',
    maxWidth: 280,
  },
});
