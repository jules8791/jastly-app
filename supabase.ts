import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

// Only import native-specific modules on native platforms
if (Platform.OS !== 'web') {
  require('react-native-url-polyfill/auto');
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Web uses localStorage, native uses AsyncStorage
const getStorage = () => {
  if (Platform.OS === 'web') {
    return {
      getItem: (key: string) => {
        try { return Promise.resolve(localStorage.getItem(key)); }
        catch { return Promise.resolve(null); }
      },
      setItem: (key: string, value: string) => {
        try { localStorage.setItem(key, value); } catch {}
        return Promise.resolve();
      },
      removeItem: (key: string) => {
        try { localStorage.removeItem(key); } catch {}
        return Promise.resolve();
      },
    };
  }
  // Dynamically require AsyncStorage only on native
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  return AsyncStorage;
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: getStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});