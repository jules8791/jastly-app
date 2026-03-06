import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

// Only import native-specific modules on native platforms
if (Platform.OS !== 'web') {
  require('react-native-url-polyfill/auto');
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Web uses localStorage; native uses SecureStore (iOS Keychain / Android Keystore)
// so the JWT is not stored in plaintext on disk.
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
  // expo-secure-store has a 2 KB value limit per key; Supabase sessions can
  // exceed this, so we fall back to AsyncStorage for oversized values.
  const SecureStore = require('expo-secure-store');
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  return {
    getItem: async (key: string) => {
      try {
        const val = await SecureStore.getItemAsync(key);
        if (val !== null) return val;
      } catch {}
      return AsyncStorage.getItem(key);
    },
    setItem: async (key: string, value: string) => {
      try {
        if (value.length <= 2048) {
          await SecureStore.setItemAsync(key, value);
          return;
        }
      } catch {}
      return AsyncStorage.setItem(key, value);
    },
    removeItem: async (key: string) => {
      try { await SecureStore.deleteItemAsync(key); } catch {}
      return AsyncStorage.removeItem(key);
    },
  };
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: getStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});