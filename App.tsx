import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { NotoSansThai_400Regular, NotoSansThai_600SemiBold, NotoSansThai_700Bold, NotoSansThai_800ExtraBold } from '@expo-google-fonts/noto-sans-thai';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LaborMvpApp } from './src/features/labor-mvp/LaborMvpApp';

export default function App() {
  const [fontsLoaded, fontError] = useFonts({ NotoSansThai_400Regular, NotoSansThai_600SemiBold, NotoSansThai_700Bold, NotoSansThai_800ExtraBold });
  if (!fontsLoaded && !fontError) return null;
  return (
    <SafeAreaProvider>
      <LaborMvpApp />
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
