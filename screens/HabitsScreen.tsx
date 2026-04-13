import { StyleSheet, Text, View } from 'react-native';

export const HabitsScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Managing habits</Text>
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
});
