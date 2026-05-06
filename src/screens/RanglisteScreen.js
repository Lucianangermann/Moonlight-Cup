import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { shared, cardShadow } from '../theme/styles';
import { useTournament } from '../store/tournament';

const MEDAL_COLORS = [colors.gold, colors.silver, '#CD7F32'];
const MEDAL_BG    = [colors.goldGlow, colors.silver + '20', '#CD7F32' + '20'];
const MEDAL_ICONS = ['trophy', 'medal', 'ribbon'];

export default function RanglisteScreen() {
  const { getStandings } = useTournament();
  const [selected, setSelected] = useState(null);
  const standings = getStandings();

  return (
    <View style={shared.screen}>
      {/* Header */}
      <View style={s.header}>
        <Text style={shared.screenTitle}>Rangliste</Text>
        <View style={s.liveBadge}>
          <View style={s.liveDot} />
          <Text style={s.liveText}>LIVE</Text>
        </View>
      </View>

      {standings.length === 0 ? (
        <View style={s.emptyState}>
          <View style={s.emptyIcon}>
            <Ionicons name="trophy-outline" size={40} color={colors.gold} />
          </View>
          <Text style={s.emptyTitle}>Noch keine Daten</Text>
          <Text style={s.emptyHint}>Starte eine Runde und trage Ergebnisse ein.</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Column Headers */}
          <View style={s.tableHeader}>
            <Text style={[s.col, s.colRank, s.headerText]}>#</Text>
            <Text style={[s.col, s.colName, s.headerText]}>Name</Text>
            <Text style={[s.col, s.colNum, s.headerText]}>Pkt</Text>
            <Text style={[s.col, s.colNum, s.headerText]}>Siege</Text>
            <Text style={[s.col, s.colNum, s.headerText]}>Diff</Text>
          </View>

          {standings.map((p, i) => {
            const isTop3 = i < 3;
            const medalColor = MEDAL_COLORS[i] ?? colors.textMuted;
            const isSelected = selected === p.id;

            return (
              <View key={p.id}>
                <TouchableOpacity
                  style={[
                    s.row,
                    isTop3 && s.rowTop,
                    isSelected && s.rowSelected,
                    i === 0 && s.rowFirst,
                  ]}
                  onPress={() => setSelected(isSelected ? null : p.id)}
                  activeOpacity={0.75}
                >
                  <View style={[s.col, s.colRank]}>
                    {isTop3 ? (
                      <View style={[s.medalBadge, { backgroundColor: MEDAL_BG[i] }]}>
                        <Ionicons name={MEDAL_ICONS[i]} size={14} color={medalColor} />
                      </View>
                    ) : (
                      <Text style={s.rankNum}>{i + 1}</Text>
                    )}
                  </View>
                  <Text style={[s.col, s.colName, s.nameText, i === 0 && { color: colors.gold }]} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text style={[s.col, s.colNum, s.numText, { color: medalColor }]}>{p.points}</Text>
                  <Text style={[s.col, s.colNum, s.numText]}>{p.wins}</Text>
                  <Text style={[s.col, s.colNum, s.numText, p.diff > 0 && s.diffPos, p.diff < 0 && s.diffNeg]}>
                    {p.diff > 0 ? `+${p.diff}` : p.diff}
                  </Text>
                </TouchableOpacity>

                {isSelected && (
                  <View style={s.detailCard}>
                    <View style={s.detailRow}>
                      <View style={s.detailStat}>
                        <Text style={s.detailStatNum}>{p.games}</Text>
                        <Text style={s.detailStatLbl}>Spiele</Text>
                      </View>
                      <View style={[s.detailStat, s.detailStatMid]}>
                        <Text style={[s.detailStatNum, { color: colors.success }]}>{p.wins}</Text>
                        <Text style={s.detailStatLbl}>Siege</Text>
                      </View>
                      <View style={s.detailStat}>
                        <Text style={[s.detailStatNum, { color: colors.gold }]}>{p.points}</Text>
                        <Text style={s.detailStatLbl}>Punkte</Text>
                      </View>
                    </View>
                    <View style={s.detailDiff}>
                      <Ionicons
                        name={p.diff >= 0 ? 'trending-up' : 'trending-down'}
                        size={14}
                        color={p.diff >= 0 ? colors.success : colors.error}
                      />
                      <Text style={[s.detailDiffText, { color: p.diff >= 0 ? colors.success : colors.error }]}>
                        Punkte-Differenz: {p.diff > 0 ? '+' : ''}{p.diff}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.error + '18',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.error + '30',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.error,
  },
  liveText: {
    color: colors.error,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 60,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.goldGlow,
    borderWidth: 1,
    borderColor: colors.borderGoldGlow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyHint: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 4,
  },
  headerText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rowTop: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    ...cardShadow,
  },
  rowFirst: {
    borderColor: colors.borderGoldGlow,
    backgroundColor: colors.panel,
  },
  rowSelected: {
    borderColor: colors.borderStrong,
    backgroundColor: colors.panelLight,
  },
  col: {
    paddingHorizontal: 4,
  },
  colRank: { width: 40 },
  colName: { flex: 1 },
  colNum:  { width: 48, textAlign: 'right' },
  medalBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankNum: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  nameText: {
    color: colors.silver,
    fontSize: 14,
    fontWeight: '600',
  },
  numText: {
    color: colors.silverDim,
    fontSize: 13,
    fontWeight: '600',
  },
  diffPos: { color: colors.success },
  diffNeg: { color: colors.error },
  detailCard: {
    backgroundColor: colors.panelLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderGoldGlow,
    marginBottom: 8,
    marginHorizontal: 4,
    overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row',
  },
  detailStat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
  },
  detailStatMid: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
  },
  detailStatNum: {
    color: colors.silver,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  detailStatLbl: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  detailDiff: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  detailDiffText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
