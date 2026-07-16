import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DesignLabScreen } from './src/features/design-lab/DesignLabScreen';

export default function App() {
  return (
    <SafeAreaProvider>
      <DesignLabScreen />
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
