import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>TAKAI</Text>
      <Text style={styles.title}>ตาไก๊ - เพื่อนชาวสวน</Text>
      <Text style={styles.subtitle}>Android local-first scaffold is ready.</Text>
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4E9D8',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  eyebrow: {
    color: '#2E7D32',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  title: {
    color: '#1F2D1F',
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    color: '#607060',
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
  },
});
