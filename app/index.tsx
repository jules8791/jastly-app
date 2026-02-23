/**
 * index.tsx — Welcome / Join screen
 * Auth options:
 *  - Anonymous quick-host (no account needed)
 *  - Email / password
 *  - Google OAuth (all platforms, opens browser)
 *  - Apple Sign In (iOS only, native dialog)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AppleAuthentication from 'expo-apple-authentication';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { supabase } from '../supabase';
import { ColorSet, useTheme } from '../contexts/theme-context';

// Required to complete the OAuth redirect back into the app
WebBrowser.maybeCompleteAuthSession();

interface RecentClub {
  id: string;
  name: string;
  myName: string;
  joinedAt: string;
}

export default function WelcomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [clubId, setClubId] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [recentClubs, setRecentClubs] = useState<RecentClub[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const scannedRef = useRef(false);

  // Auth modal
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'create' | 'reset'>('signin');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authNickname, setAuthNickname] = useState('');
  const [authErrorMsg, setAuthErrorMsg] = useState('');

  // Password recovery (from reset email link)
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [recoveryConfirm, setRecoveryConfirm] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryMsg, setRecoveryMsg] = useState('');

  // Simple math captcha for account creation
  const [captchaA, setCaptchaA] = useState(0);
  const [captchaB, setCaptchaB] = useState(0);
  const [captchaAnswer, setCaptchaAnswer] = useState('');

  const refreshCaptcha = () => {
    setCaptchaA(Math.floor(Math.random() * 9) + 1);
    setCaptchaB(Math.floor(Math.random() * 9) + 1);
    setCaptchaAnswer('');
  };

  const switchAuthMode = (mode: 'signin' | 'create' | 'reset') => {
    setAuthMode(mode);
    setAuthPassword('');
    setAuthConfirmPassword('');
    setAuthNickname('');
    setAuthErrorMsg('');
    if (mode === 'create') refreshCaptcha();
  };

  useEffect(() => {
    checkExistingSession();
    loadRecentClubs();
  }, []);

  // Listen for password recovery event (triggered when user clicks reset link)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setShowRecoveryModal(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSetNewPassword = async () => {
    setRecoveryMsg('');
    if (recoveryPassword.length < 8) { setRecoveryMsg('Password must be at least 8 characters.'); return; }
    if (recoveryPassword !== recoveryConfirm) { setRecoveryMsg('Passwords do not match.'); return; }
    setRecoveryLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: recoveryPassword });
      if (error) { setRecoveryMsg(error.message); return; }
      setRecoveryMsg('✅ Password updated! Signing you in...');
      setRecoveryPassword('');
      setRecoveryConfirm('');
      setTimeout(async () => {
        setShowRecoveryModal(false);
        await afterOAuthSuccess();
      }, 1500);
    } catch (e: any) {
      setRecoveryMsg(e.message || 'Something went wrong.');
    } finally {
      setRecoveryLoading(false);
    }
  };

  // ─── Session restore ──────────────────────────────────────────────────────
  const checkExistingSession = async () => {
    try {
      const savedClubId = await AsyncStorage.getItem('currentClubId');
      const savedIsHost = await AsyncStorage.getItem('isHost');
      const savedName = await AsyncStorage.getItem('guestName');

      if (savedName) setName(savedName);
      if (savedClubId) setClubId(savedClubId);

      // Any non-anonymous host (email, Google, Apple) — restore their club
      const { data: { session } } = await supabase.auth.getSession();
      if (session && !session.user.is_anonymous) {
        const { data: club } = await supabase
          .from('clubs').select('id').eq('host_uid', session.user.id).maybeSingle();
        if (club) {
          await AsyncStorage.setItem('currentClubId', club.id);
          await AsyncStorage.setItem('isHost', 'true');
          router.replace('/dashboard');
          return;
        }
      }

      // Guests always start from the home screen — clear any stale saved club
      if (savedClubId && savedIsHost === 'false') {
        await AsyncStorage.multiRemove(['currentClubId', 'isHost']);
      }
    } catch {}
  };

  // ─── Shared post-OAuth club setup ─────────────────────────────────────────
  const afterOAuthSuccess = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) { setAuthErrorMsg('Signed in but could not get session. Try again.'); return; }

    const { data: existingClub, error: selectError } = await supabase
      .from('clubs').select('id').eq('host_uid', uid).maybeSingle();
    if (selectError) { setAuthErrorMsg('DB error: ' + selectError.message); return; }

    let finalClubId: string;

    if (existingClub) {
      finalClubId = existingClub.id;
    } else {
      const newClubId = 'CLUB-' +
        Math.random().toString(36).substring(2, 7).toUpperCase() +
        Math.random().toString(36).substring(2, 7).toUpperCase();
      const { error: dbError } = await supabase.from('clubs').insert([{ id: newClubId, host_uid: uid }]);
      if (dbError) { setAuthErrorMsg('DB error: ' + dbError.message + ' — have you run the SQL setup script in Supabase?'); return; }
      finalClubId = newClubId;
    }

    await AsyncStorage.setItem('currentClubId', finalClubId);
    await AsyncStorage.setItem('isHost', 'true');
    setShowAuthModal(false);
    router.replace('/dashboard');
  };

  // ─── Google Sign In ───────────────────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    setIsAuthLoading(true);
    try {
      const redirectTo = Linking.createURL('/');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error || !data.url) throw error ?? new Error('No auth URL returned');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === 'success' && result.url) {
        const { error: sessionError } = await supabase.auth.exchangeCodeForSession(result.url);
        if (sessionError) throw sessionError;
        await afterOAuthSuccess();
      }
    } catch (e: any) {
      Alert.alert('Google Sign In Error', e.message ?? 'Something went wrong');
    } finally {
      setIsAuthLoading(false);
    }
  };

  // ─── Apple Sign In (iOS only) ─────────────────────────────────────────────
  const handleAppleSignIn = async () => {
    setIsAuthLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error('No identity token from Apple');

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (error) throw error;
      await afterOAuthSuccess();
    } catch (e: any) {
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Apple Sign In Error', e.message ?? 'Something went wrong');
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  // ─── Email / Password Auth ─────────────────────────────────────────────────
  const handleEmailAuth = async () => {
    setAuthErrorMsg('');
    if (!authEmail.trim() || !authPassword.trim()) {
      setAuthErrorMsg('Enter your email and password.');
      return;
    }
    if (authMode === 'create') {
      if (authPassword.length < 8) {
        setAuthErrorMsg('Password must be at least 8 characters.');
        return;
      }
      if (authPassword !== authConfirmPassword) {
        setAuthErrorMsg('Passwords do not match.');
        return;
      }
      if (parseInt(captchaAnswer, 10) !== captchaA + captchaB) {
        setAuthErrorMsg('Incorrect answer — please solve the sum again.');
        refreshCaptcha();
        return;
      }
    }
    setIsAuthLoading(true);
    try {
      let uid: string | null = null;

      if (authMode === 'create') {
        const nickname = authNickname.trim() || 'Host';
        const { data, error } = await supabase.auth.signUp({
          email: authEmail.trim().toLowerCase(),
          password: authPassword,
          options: { data: { nickname } },
        });
        if (error) { setAuthErrorMsg(error.message); return; }
        // If no session, email confirmation is required
        if (!data.session) {
          setAuthErrorMsg('✅ Account created! Check your email for a confirmation link, then come back and sign in.');
          return;
        }
        uid = data.user?.id ?? null;
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: authEmail.trim().toLowerCase(),
          password: authPassword,
        });
        if (error) {
          if (error.message.toLowerCase().includes('email not confirmed') ||
              error.message.toLowerCase().includes('not confirmed')) {
            setAuthErrorMsg('Email not verified. Check your inbox or resend below.');
          } else {
            setAuthErrorMsg(error.message);
          }
          return;
        }
        uid = data.user?.id ?? null;
      }

      if (!uid) { setAuthErrorMsg('Could not authenticate.'); return; }
      await afterOAuthSuccess();
    } catch (e: any) {
      setAuthErrorMsg(e.message || 'Something went wrong. Check your connection.');
      console.error('[handleEmailAuth]', e);
    } finally {
      setIsAuthLoading(false);
    }
  };

  // ─── Forgot Password ───────────────────────────────────────────────────────
  const handleForgotPassword = async () => {
    if (!authEmail.trim()) {
      Alert.alert('Email Required', 'Enter your email address first, then tap "Send Reset Email".');
      return;
    }
    setIsAuthLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        authEmail.trim().toLowerCase()
      );
      if (error) throw error;
      Alert.alert(
        'Reset Email Sent',
        'Check your inbox for a password reset link. Once reset, return here to sign in.',
        [{ text: 'OK', onPress: () => switchAuthMode('signin') }]
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not send reset email. Try again.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  // ─── Anonymous Host (native only — web requires a signed-in account) ────────
  const handleHostSession = async () => {
    if (Platform.OS === 'web') return; // hard block — web must use sign-in
    setIsLoading(true);

    const getRestoredSession = (): Promise<string | null> =>
      new Promise((resolve) => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          subscription.unsubscribe();
          resolve(session?.user?.id ?? null);
        });
        setTimeout(async () => {
          subscription.unsubscribe();
          const { data } = await supabase.auth.getSession();
          resolve(data?.session?.user?.id ?? null);
        }, 3000);
      });

    let myUid = await getRestoredSession();

    if (!myUid) {
      const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
      if (authError) { Alert.alert('Error', authError.message); setIsLoading(false); return; }
      myUid = authData.user?.id ?? null;
    }

    if (!myUid) { Alert.alert('Error', 'Could not establish a session.'); setIsLoading(false); return; }

    const { data: existingClub } = await supabase.from('clubs').select('id').eq('host_uid', myUid).maybeSingle();
    let finalClubId: string;

    if (existingClub) {
      finalClubId = existingClub.id;
    } else {
      const newClubId = 'CLUB-' +
        Math.random().toString(36).substring(2, 7).toUpperCase() +
        Math.random().toString(36).substring(2, 7).toUpperCase();
      const { error: dbError } = await supabase.from('clubs').insert([{ id: newClubId, host_uid: myUid }]);
      if (dbError) { Alert.alert('DB Error', 'Did you run the SQL setup script?'); setIsLoading(false); return; }
      finalClubId = newClubId;
    }

    await AsyncStorage.setItem('currentClubId', finalClubId);
    await AsyncStorage.setItem('isHost', 'true');
    setIsLoading(false);
    router.replace('/dashboard');
  };

  // ─── QR Scanner ───────────────────────────────────────────────────────────
  const openScanner = async () => {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert('Camera Permission', 'Camera access is needed to scan QR codes.');
        return;
      }
    }
    scannedRef.current = false;
    setShowScanner(true);
  };

  const handleBarcodeScan = ({ data }: { data: string }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    setShowScanner(false);

    let extracted = data;
    try {
      const url = new URL(data);
      const params = new URLSearchParams(url.search);
      const fromParam = params.get('clubId');
      if (fromParam) extracted = fromParam;
    } catch {}

    const clean = extracted.trim().toUpperCase();
    if (clean) {
      setClubId(clean);
      Alert.alert('QR Scanned ✓', `Club ID filled in: ${clean}\n\nEnter your name and tap JOIN.`);
    }
  };

  // ─── Quick Re-join ────────────────────────────────────────────────────────
  const quickJoin = async (recent: RecentClub) => {
    setIsLoading(true);
    try {
      const { data: club } = await supabase
        .from('clubs')
        .select('id, join_password, waiting_list, court_occupants')
        .eq('id', recent.id)
        .maybeSingle();

      if (!club) {
        Alert.alert('Club Not Found', 'This club no longer exists.');
        removeRecentClub(recent.id);
        return;
      }

      const inQueue = (club.waiting_list || []).some((p: any) => p.name === recent.myName);
      const onCourt = Object.values(club.court_occupants || {}).flat().some((p: any) => (p as any).name === recent.myName);

      if (!inQueue && !onCourt) {
        await supabase.from('requests').insert({
          club_id: recent.id,
          action: 'batch_join',
          payload: { name: recent.myName, players: [{ name: recent.myName, gender: 'M' }] },
        });
      }

      await AsyncStorage.multiSet([
        ['guestName', recent.myName],
        ['currentClubId', recent.id],
        ['isHost', 'false'],
      ]);

      router.replace('/dashboard');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Full Join ────────────────────────────────────────────────────────────
  const handleJoinClub = async () => {
    if (!clubId || !name) return Alert.alert('Error', 'Enter Club ID and your name');

    const cleanName = name.trim()
      .replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase().substring(0, 20);
    if (!cleanName) return Alert.alert('Error', 'Name must contain letters or numbers');

    const cleanClubId = clubId.trim().toUpperCase();
    setIsLoading(true);

    try {
      const { data: club, error } = await supabase
        .from('clubs')
        .select('id, club_name, join_password, waiting_list, court_occupants')
        .eq('id', cleanClubId)
        .maybeSingle();

      if (error || !club) { Alert.alert('Not Found', 'No club found with that ID.'); return; }

      if (club.join_password) {
        if (!password.trim()) { Alert.alert('Password Required', 'This club requires a password to join.'); return; }
        const stored = club.join_password;
        const colonIdx = stored.indexOf(':');
        let matches = false;
        if (colonIdx !== -1) {
          // New salted format: "salt:hash"
          const salt = stored.slice(0, colonIdx);
          const storedHash = stored.slice(colonIdx + 1);
          const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, salt + '::' + password.trim());
          // Constant-time compare
          if (hash.length === storedHash.length) {
            let diff = 0;
            for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ storedHash.charCodeAt(i);
            matches = diff === 0;
          }
        } else {
          // Legacy format
          const legacy = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `jastly::${password.trim()}::club`);
          matches = legacy === stored;
        }
        if (!matches) {
          Alert.alert('Access Denied', 'Incorrect password. Ask the host for the session password.');
          return;
        }
      }

      const inQueue = (club.waiting_list || []).some((p: any) => p.name === cleanName);
      const onCourt = Object.values(club.court_occupants || {}).flat().some((p: any) => (p as any).name === cleanName);

      if (!inQueue && !onCourt) {
        await supabase.from('requests').insert({
          club_id: cleanClubId,
          action: 'batch_join',
          payload: { name: cleanName, players: [{ name: cleanName, gender: 'M' }] },
        });
      }

      await AsyncStorage.multiSet([
        ['guestName', cleanName],
        ['currentClubId', cleanClubId],
        ['isHost', 'false'],
      ]);

      await saveToRecentClubs(cleanClubId, club.club_name || cleanClubId, cleanName);
      router.replace('/dashboard');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const loadRecentClubs = async () => {
    try {
      const raw = await AsyncStorage.getItem('recent_clubs');
      if (raw) setRecentClubs(JSON.parse(raw));
    } catch {}
  };

  const saveToRecentClubs = async (id: string, clubName: string, myName: string) => {
    try {
      const raw = await AsyncStorage.getItem('recent_clubs');
      const existing: RecentClub[] = raw ? JSON.parse(raw) : [];
      const filtered = existing.filter(c => c.id !== id);
      const updated = [{ id, name: clubName, myName, joinedAt: new Date().toISOString() }, ...filtered].slice(0, 5);
      await AsyncStorage.setItem('recent_clubs', JSON.stringify(updated));
      setRecentClubs(updated);
    } catch {}
  };

  const removeRecentClub = async (id: string) => {
    const updated = recentClubs.filter(c => c.id !== id);
    setRecentClubs(updated);
    await AsyncStorage.setItem('recent_clubs', JSON.stringify(updated));
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    } catch { return ''; }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.header}>🏆 QUEUE MASTER</Text>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>🏆 QUEUE MASTER</Text>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* HOST BUTTONS */}
        {/* Anonymous quick-host only available on native — web requires an account */}
        {Platform.OS !== 'web' && (
          <TouchableOpacity style={styles.hostButton} onPress={handleHostSession}>
            <Text style={styles.btnText}>HOST SESSION</Text>
            <Text style={styles.btnSubText}>Quick start — no account needed</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.hostButton, { backgroundColor: colors.deepBlue, marginTop: Platform.OS === 'web' ? 0 : 10 }]}
          onPress={() => { setAuthMode('signin'); setShowAuthModal(true); }}
        >
          <Text style={styles.btnText}>SIGN IN / CREATE ACCOUNT</Text>
          <Text style={styles.btnSubText}>{Platform.OS === 'web' ? 'Sign in to host your club' : 'Host from any device with your account'}</Text>
        </TouchableOpacity>

        {/* RECENT CLUBS */}
        {recentClubs.length > 0 && (
          <View style={{ marginTop: 24, marginBottom: 8 }}>
            <Text style={styles.subHeader}>RECENT CLUBS</Text>
            {recentClubs.map((rc) => (
              <View key={rc.id} style={styles.recentRow}>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => quickJoin(rc)}>
                  <Text style={styles.recentName}>{rc.name || rc.id}</Text>
                  <Text style={styles.recentSub}>{rc.myName}  •  {formatDate(rc.joinedAt)}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => Alert.alert('Remove?', 'Remove from recent clubs?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Remove', style: 'destructive', onPress: () => removeRecentClub(rc.id) },
                  ])}
                  style={{ padding: 10 }}
                >
                  <Text style={{ color: colors.gray3, fontSize: 18 }}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* JOIN */}
        <Text style={[styles.subHeader, { marginTop: 24 }]}>JOIN A CLUB</Text>

        <View style={{ flexDirection: 'row', marginBottom: 10 }}>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0, marginRight: 8 }]}
            placeholder="Club ID"
            placeholderTextColor={colors.gray3}
            value={clubId}
            onChangeText={setClubId}
            autoCapitalize="characters"
          />
          {Platform.OS !== 'web' && (
            <TouchableOpacity style={styles.scanBtn} onPress={openScanner}>
              <Text style={{ fontSize: 22 }}>📷</Text>
            </TouchableOpacity>
          )}
        </View>

        <TextInput
          style={styles.input}
          placeholder="Your Name"
          placeholderTextColor={colors.gray3}
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={styles.input}
          placeholder="Password (if required)"
          placeholderTextColor={colors.gray3}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={styles.joinButton} onPress={handleJoinClub}>
          <Text style={styles.btnText}>JOIN AS PLAYER</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── AUTH MODAL ──────────────────────────────────────────────── */}
      <Modal visible={showAuthModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.authOverlay}>
            <ScrollView style={styles.authSheet} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
              <Text style={styles.authTitle}>HOST ACCOUNT</Text>
              <Text style={{ color: colors.gray2, textAlign: 'center', marginBottom: 20, fontSize: 13 }}>
                Sign in to access your club from any device
              </Text>

              {/* ── Google button ── */}
              <TouchableOpacity
                style={styles.oauthBtn}
                onPress={handleGoogleSignIn}
                disabled={isAuthLoading}
              >
                <Text style={styles.oauthBtnText}>🌐  Continue with Google</Text>
              </TouchableOpacity>

              {/* ── Apple button (iOS only) ── */}
              {Platform.OS === 'ios' && (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                  cornerRadius={8}
                  style={styles.appleBtn}
                  onPress={handleAppleSignIn}
                />
              )}

              {/* ── Divider ── */}
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or use email</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* ── Mode toggle (hidden in reset view) ── */}
              {authMode !== 'reset' && (
                <View style={styles.modeToggleRow}>
                  <TouchableOpacity
                    style={[styles.modeToggleBtn, authMode === 'signin' && styles.modeToggleBtnActive]}
                    onPress={() => switchAuthMode('signin')}
                  >
                    <Text style={{ color: authMode === 'signin' ? colors.black : colors.gray2, fontWeight: 'bold', fontSize: 13 }}>Sign In</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modeToggleBtn, authMode === 'create' && styles.modeToggleBtnActive]}
                    onPress={() => switchAuthMode('create')}
                  >
                    <Text style={{ color: authMode === 'create' ? colors.black : colors.gray2, fontWeight: 'bold', fontSize: 13 }}>Create Account</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* ── Reset password view ── */}
              {authMode === 'reset' ? (
                <>
                  <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 15, textAlign: 'center', marginBottom: 8 }}>
                    Reset Password
                  </Text>
                  <Text style={{ color: colors.gray2, textAlign: 'center', marginBottom: 16, fontSize: 13 }}>
                    Enter your email and we'll send you a reset link.
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor={colors.gray3}
                    value={authEmail}
                    onChangeText={setAuthEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    autoFocus
                  />
                  <TouchableOpacity
                    style={[styles.hostButton, { marginTop: 5, opacity: isAuthLoading ? 0.5 : 1 }]}
                    onPress={handleForgotPassword}
                    disabled={isAuthLoading}
                  >
                    {isAuthLoading
                      ? <ActivityIndicator color={colors.black} />
                      : <Text style={styles.btnText}>SEND RESET EMAIL</Text>
                    }
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ marginTop: 16, alignItems: 'center' }}
                    onPress={() => switchAuthMode('signin')}
                  >
                    <Text style={{ color: colors.primary, fontWeight: 'bold' }}>← Back to Sign In</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor={colors.gray3}
                    value={authEmail}
                    onChangeText={setAuthEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor={colors.gray3}
                    value={authPassword}
                    onChangeText={setAuthPassword}
                    secureTextEntry
                    autoComplete={authMode === 'create' ? 'new-password' : 'current-password'}
                  />
                  {authMode === 'create' && (
                    <>
                      <TextInput
                        style={styles.input}
                        placeholder="Nickname (shown to players)"
                        placeholderTextColor={colors.gray3}
                        value={authNickname}
                        onChangeText={setAuthNickname}
                        autoCapitalize="words"
                        maxLength={30}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="Confirm Password"
                        placeholderTextColor={colors.gray3}
                        value={authConfirmPassword}
                        onChangeText={setAuthConfirmPassword}
                        secureTextEntry
                        autoComplete="new-password"
                      />
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 }}>
                        <Text style={{ color: colors.gray2, fontSize: 14, flex: 1 }}>
                          Prove you're human: {captchaA} + {captchaB} =
                        </Text>
                        <TextInput
                          style={[styles.input, { flex: 0, width: 70, marginBottom: 0, textAlign: 'center' }]}
                          placeholder="?"
                          placeholderTextColor={colors.gray3}
                          value={captchaAnswer}
                          onChangeText={setCaptchaAnswer}
                          keyboardType="number-pad"
                          maxLength={3}
                        />
                      </View>
                    </>
                  )}

                  {authMode === 'signin' && (
                    <TouchableOpacity
                      style={{ alignSelf: 'flex-end', marginBottom: 10, marginTop: -6 }}
                      onPress={() => switchAuthMode('reset')}
                    >
                      <Text style={{ color: colors.primary, fontSize: 12 }}>Forgot password?</Text>
                    </TouchableOpacity>
                  )}

                  {authErrorMsg ? (
                    <Text style={{
                      color: authErrorMsg.startsWith('✅') ? '#4caf50' : '#ff6b6b',
                      fontSize: 13, textAlign: 'center', marginBottom: 8,
                    }}>
                      {authErrorMsg}
                    </Text>
                  ) : null}
                  {authErrorMsg?.includes('not verified') && (
                    <TouchableOpacity
                      style={{ alignSelf: 'center', marginBottom: 8 }}
                      onPress={async () => {
                        await supabase.auth.resend({ type: 'signup', email: authEmail.trim().toLowerCase() });
                        setAuthErrorMsg('Resent! Check your inbox.');
                      }}
                    >
                      <Text style={{ color: colors.primary, fontSize: 13 }}>Resend verification email</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.hostButton, { marginTop: 5, opacity: isAuthLoading ? 0.5 : 1 }]}
                    onPress={handleEmailAuth}
                    disabled={isAuthLoading}
                  >
                    {isAuthLoading
                      ? <ActivityIndicator color={colors.black} />
                      : <Text style={styles.btnText}>{authMode === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT'}</Text>
                    }
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity
                style={{ marginTop: 20, alignItems: 'center' }}
                onPress={() => { setShowAuthModal(false); switchAuthMode('signin'); }}
              >
                <Text style={{ color: colors.gray1 }}>CANCEL</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── QR SCANNER MODAL (native only — camera not available on web) ── */}
      {Platform.OS !== 'web' && (
        <Modal visible={showScanner} animationType="slide">
          <View style={{ flex: 1, backgroundColor: colors.bg }}>
            <View style={{ padding: 20, paddingTop: 60, backgroundColor: colors.bg, flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ color: colors.primary, fontSize: 18, fontWeight: 'bold', flex: 1 }}>SCAN CLUB QR CODE</Text>
              <TouchableOpacity onPress={() => setShowScanner(false)}>
                <Text style={{ color: colors.white, fontSize: 28, lineHeight: 28 }}>×</Text>
              </TouchableOpacity>
            </View>
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handleBarcodeScan}
            />
            <View style={{ padding: 30, backgroundColor: colors.bg, alignItems: 'center' }}>
              <Text style={{ color: colors.gray2, textAlign: 'center' }}>
                Point your camera at the club's QR code
              </Text>
            </View>
          </View>
        </Modal>
      )}

      {/* ── PASSWORD RECOVERY MODAL ── */}
      <Modal visible={showRecoveryModal} animationType="slide" transparent>
        <View style={styles.authOverlay}>
          <View style={[styles.authSheet, { padding: 24 }]}>
            <Text style={styles.authTitle}>SET NEW PASSWORD</Text>
            <Text style={{ color: colors.gray2, textAlign: 'center', marginBottom: 20, fontSize: 13 }}>
              Choose a new password for your account.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="New Password"
              placeholderTextColor={colors.gray3}
              value={recoveryPassword}
              onChangeText={setRecoveryPassword}
              secureTextEntry
              autoComplete="new-password"
            />
            <TextInput
              style={styles.input}
              placeholder="Confirm New Password"
              placeholderTextColor={colors.gray3}
              value={recoveryConfirm}
              onChangeText={setRecoveryConfirm}
              secureTextEntry
              autoComplete="new-password"
            />
            {recoveryMsg ? (
              <Text style={{ color: recoveryMsg.startsWith('✅') ? '#4caf50' : '#ff6b6b', fontSize: 13, textAlign: 'center', marginBottom: 8 }}>
                {recoveryMsg}
              </Text>
            ) : null}
            <TouchableOpacity
              style={[styles.hostButton, { marginTop: 5, opacity: recoveryLoading ? 0.5 : 1 }]}
              onPress={handleSetNewPassword}
              disabled={recoveryLoading}
            >
              {recoveryLoading
                ? <ActivityIndicator color={colors.black} />
                : <Text style={styles.btnText}>UPDATE PASSWORD</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (C: ColorSet) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, padding: 24, paddingTop: 60 },
  header: { color: C.primary, fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 30 },
  hostButton: { backgroundColor: C.purple, padding: 20, borderRadius: 8, marginBottom: 4 },
  joinButton: { backgroundColor: C.deepBlue, padding: 20, borderRadius: 8 },
  scanBtn: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 8, width: 54, justifyContent: 'center', alignItems: 'center',
  },
  btnText: { color: C.black, fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
  btnSubText: { color: C.black, fontSize: 11, textAlign: 'center', marginTop: 3, opacity: 0.75 },
  subHeader: { color: C.gray2, textAlign: 'center', marginBottom: 12, fontWeight: 'bold', letterSpacing: 1 },
  input: { backgroundColor: C.surface, color: C.white, padding: 15, borderRadius: 5, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  recentRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface, borderRadius: 8, borderWidth: 1, borderColor: C.deepBlue,
    paddingLeft: 15, marginBottom: 8,
  },
  recentName: { color: C.white, fontWeight: 'bold', fontSize: 14 },
  recentSub: { color: C.gray3, fontSize: 11, marginTop: 2 },
  authOverlay: { flex: 1, backgroundColor: C.overlay, justifyContent: 'flex-end' },
  authSheet: {
    backgroundColor: C.surfaceHigh, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, maxHeight: '90%',
  },
  authTitle: { color: C.primary, fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 6 },
  oauthBtn: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 8, padding: 15, marginBottom: 10, alignItems: 'center',
  },
  oauthBtnText: { color: C.white, fontWeight: 'bold', fontSize: 15 },
  appleBtn: { width: '100%', height: 50, marginBottom: 10 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 14 },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.border },
  dividerText: { color: C.gray2, fontSize: 12, marginHorizontal: 10 },
  modeToggleRow: {
    flexDirection: 'row', backgroundColor: C.surface,
    borderRadius: 8, marginBottom: 14, overflow: 'hidden', borderWidth: 1, borderColor: C.border,
  },
  modeToggleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  modeToggleBtnActive: { backgroundColor: C.primary },
});
