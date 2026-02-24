import React, { useMemo, useState } from 'react';
import { Platform, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useTheme } from '../../contexts/theme-context';
import { QueuePlayer } from '../../types';
import { makeStyles } from './dashboardStyles';

interface CourtsGridProps {
  activeCourts: number;
  courtOccupants: Record<string, QueuePlayer[]>;
  courtLabel: string;
  sportEmoji: string;
  isHost: boolean;
  isPowerGuest: boolean;
  isProcessingAction: boolean;
  onFinishMatch: (courtIdx: string, players: QueuePlayer[]) => void;
  onSubstitute: (courtIdx: string, outPlayer: string) => void;
}

export function CourtsGrid({
  activeCourts,
  courtOccupants,
  courtLabel,
  isHost,
  onFinishMatch,
  onSubstitute,
}: CourtsGridProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { width: screenWidth } = useWindowDimensions();
  const [courtGridWidth, setCourtGridWidth] = useState(0);

  const numCourts = activeCourts || 4;
  const cardMargin = 4;
  const gridW = courtGridWidth > 0 ? courtGridWidth : screenWidth;
  const numCols = gridW > 900 ? 4 : gridW > 600 ? 3 : 2;
  const cardWidth = Math.max(60, Math.floor((gridW - 2 * (numCols + 1) * cardMargin) / numCols));
  const numRows = Math.ceil(numCourts / numCols);
  const cardHeight = Math.max(80, Math.floor(260 / numRows));
  const nameFontSize = Math.max(9, Math.min(Math.floor(cardWidth / 12), Math.floor(cardHeight / 6)));
  const titleFontSize = Math.max(8, Math.min(Math.floor(cardWidth / 16), Math.floor(cardHeight / 8)));

  const rows: number[][] = [];
  for (let i = 0; i < numCourts; i += numCols) {
    rows.push(Array.from({ length: numCols }, (_, j) => i + j).filter(n => n < numCourts));
  }

  return (
    <View
      style={{ paddingHorizontal: cardMargin, paddingTop: cardMargin }}
      onLayout={(e) => setCourtGridWidth(e.nativeEvent.layout.width)}
    >
      {rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: 'row', marginBottom: cardMargin }}>
          {row.map(i => {
            const players = courtOccupants?.[i.toString()];
            const isBusy = !!players;
            return (
              <TouchableOpacity
                key={i}
                style={[{
                  width: cardWidth,
                  height: cardHeight,
                  marginHorizontal: cardMargin,
                  borderRadius: 8,
                  borderWidth: 1,
                  padding: 4,
                  overflow: 'hidden',
                }, isBusy ? styles.courtBusy : styles.courtFree]}
                onPress={() => isBusy ? onFinishMatch(i.toString(), players) : undefined}
              >
                <Text style={[styles.courtTitle, { fontSize: titleFontSize }]} numberOfLines={1}>
                  {courtLabel.toUpperCase()} {i + 1}
                </Text>
                {isBusy ? (
                  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Text numberOfLines={1} style={[styles.courtPlayer, { fontSize: nameFontSize }]}>
                      {players[0]?.name} & {players[1]?.name}
                    </Text>
                    <Text style={{ color: colors.gray2, fontSize: Math.max(8, titleFontSize - 1) }}>VS</Text>
                    <Text numberOfLines={1} style={[styles.courtPlayer, { fontSize: nameFontSize }]}>
                      {players[2]?.name} & {players[3]?.name}
                    </Text>
                    {isHost && (
                      <TouchableOpacity
                        onPress={() => onSubstitute(i.toString(), players[0]?.name)}
                        style={{ backgroundColor: colors.border, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginTop: 2 }}
                      >
                        <Text style={{ color: colors.primary, fontSize: Math.max(9, titleFontSize - 1) }}>SUB</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={[styles.courtFreeText, { fontSize: nameFontSize + 2 }]}>FREE</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
          {/* Phantom cards to keep short rows left-aligned */}
          {row.length < numCols && Array.from({ length: numCols - row.length }).map((_, idx) => (
            <View key={`ph-${idx}`} style={{ width: cardWidth, marginHorizontal: cardMargin }} />
          ))}
        </View>
      ))}
    </View>
  );
}
