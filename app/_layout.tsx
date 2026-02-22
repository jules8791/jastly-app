import { Stack } from 'expo-router';
import { ThemeProvider } from '../contexts/theme-context';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="join" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </ThemeProvider>
  );
}