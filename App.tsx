import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OperationalSliceScreen } from './src/features/operations/OperationalSliceScreen';

export default function App() {
  return (
    <SafeAreaProvider>
      <OperationalSliceScreen />
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
