import React, { useMemo, useState } from 'react';
import { Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../contexts/theme-context';
import { QueuePlayer } from '../../types';
import { makeStyles } from './dashboardStyles';

interface GuestStatusBannerProps {
  isHost: boolean;
  isPowerGuest: boolean;
  isOnline: boolean;
  isMyTurnBanner: boolean;
  sportEmoji: string;
  courtLabel: string;
  hasPowerGuestPin: boolean;
  myQueuePos: number;
  activeBeforeMe: number;
  myName: string;
  courtOccupants: Record<string, QueuePlayer[]>;
  playersPerGame: number;
  onDismissTurnBanner: () => void;
  onClaimPowerGuest: (pin: string) => Promise<void>;
}

export function GuestStatusBanner({
  isHost,
  isPowerGuest,
  isOnline,
  isMyTurnBanner,
  sportEmoji,
  courtLabel,
  hasPowerGuestPin,
  myQueuePos,
  activeBeforeMe,
  myName,
  courtOccupants,
  playersPerGame,
  onDismissTurnBanner,
  onClaimPowerGuest,
}: GuestStatusBannerProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [showPowerGuestPrompt, setShowPowerGuestPrompt] = useState(false);
  const [powerGuestPinInput, setPowerGuestPinInput] = useState('');

  if (isHost) return null;

  const activeCourtsCount = Math.max(1, Object.values(courtOccupants || {}).filter(p => p.length > 0).length);
  const estMins = activeBeforeMe > 0
    ? Math.max(5, Math.round(Math.ceil(activeBeforeMe / playersPerGame) / activeCourtsCount * 15 / 5) * 5)
    : 0;

  const myCourtEntry = myName
    ? Object.entries(courtOccupants || {}).find(([, players]) =>
        players.some((p: QueuePlayer) => p.name === myName)
      )
    : undefined;
  const myCourtNum = myCourtEntry ? parseInt(myCourtEntry[0]) + 1 : null;

  return (
    <>
      {/* Power Guest Claim Modal */}
      <Modal visible={showPowerGuestPrompt} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>⚡ CLAIM POWER MODE</Text>
            <Text style={{ color: colors.gray2, textAlign: 'center', marginBottom: 15 }}>
              Enter the session PIN to gain elevated controls
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Session PIN"
              placeholderTextColor={colors.gray3}
              secureTextEntry
              keyboardType="numeric"
              maxLength={4}
              autoFocus
              value={powerGuestPinInput}
              onChangeText={setPowerGuestPinInput}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
              <TouchableOpacity onPress={() => { setShowPowerGuestPrompt(false); setPowerGuestPinInput(''); }}>
                <Text style={{ color: colors.gray1 }}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={async () => {
                const pin = powerGuestPinInput;
                setPowerGuestPinInput('');
                setShowPowerGuestPrompt(false);
                await onClaimPowerGuest(pin);
              }}>
                <Text style={{ color: colors.primary, fontWeight: 'bold' }}>UNLOCK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* IT'S YOUR TURN banner */}
      {isMyTurnBanner && (
        <TouchableOpacity
          style={{ backgroundColor: colors.green, padding: 12, alignItems: 'center' }}
          onPress={onDismissTurnBanner}
        >
          <Text style={{ color: colors.white, fontWeight: 'bold', fontSize: 16 }}>
            {sportEmoji} IT'S YOUR TURN TO PICK A {courtLabel.toUpperCase()}! (tap to dismiss)
          </Text>
        </TouchableOpacity>
      )}

      {/* On-court banner */}
      {myCourtNum !== null && !isMyTurnBanner && (
        <View style={{ backgroundColor: colors.green, padding: 10, alignItems: 'center' }}>
          <Text style={{ color: colors.white, fontWeight: 'bold', fontSize: 14 }}>
            {sportEmoji} You're playing on {courtLabel} {myCourtNum}
          </Text>
        </View>
      )}

      {/* Claim Power Mode button */}
      {!isPowerGuest && hasPowerGuestPin && (
        <TouchableOpacity
          style={{ backgroundColor: colors.deepBlue, padding: 10, alignItems: 'center' }}
          onPress={() => { setPowerGuestPinInput(''); setShowPowerGuestPrompt(true); }}
        >
          <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 13 }}>⚡ CLAIM POWER MODE</Text>
        </TouchableOpacity>
      )}

      {/* Queue position banner */}
      {myQueuePos >= 0 && !isMyTurnBanner && (
        <View style={{ backgroundColor: colors.surfaceHigh, padding: 8, alignItems: 'center' }}>
          <Text style={{ color: colors.gray2, fontSize: 12 }}>
            Your position: <Text style={{ color: colors.primary, fontWeight: 'bold' }}>#{myQueuePos + 1}</Text>
            {activeBeforeMe > 0 ? `  •  ${activeBeforeMe} ahead  •  ~${estMins} min` : "  •  You're next!"}
          </Text>
        </View>
      )}
    </>
  );
}
