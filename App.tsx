import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LaborMvpApp } from './src/features/labor-mvp/LaborMvpApp';

export default function App() {
  return (
    <SafeAreaProvider>
      <LaborMvpApp />
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
