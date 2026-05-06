import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { shared, cardShadow } from '../theme/styles';
import { useTournament } from '../store/tournament';

const MEDAL_ICONS = ['trophy', 'medal', 'ribbon'];

const GROUPS = [
  {
    key: 'vollmond',
    label: 'Vollmondgruppe',
    sublabel: 'Stärkste Spieler',
    icon: 'ellipse',
    color: colors.gold,
    bgColor: colors.goldGlow,
    borderColor: colors.borderGoldGlow,
    medalColors: [colors.gold, colors.silver, '#CD7F32'],
    medalBgs:   [colors.goldGlow, colors.silver + '20', '#CD7F3220'],
    firstBorder: colors.borderGoldGlow,
  },
  {
    key: 'halbmond',
    label: 'Halbmondgruppe',
    sublabel: 'Mittelfeld',
    icon: 'moon',
    color: colors.silver,
    bgColor: colors.silver + '15',
    borderColor: colors.silver + '35',
    medalColors: [colors.silver, colors.silverDim, colors.textMuted],
    medalBgs:   [colors.silver + '25', colors.silverDim + '20', colors.textMuted + '18'],
    firstBorder: colors.silver + '50',
  },
  {
    key: 'neumond',
    label: 'Neumondgruppe',
    sublabel: 'Aufsteiger',
    icon: 'ellipse-outline',
    color: colors.info,
    bgColor: colors.info + '15',
    borderColor: colors.info + '35',
    medalColors: [colors.info, colors.info + 'BB', colors.info + '80'],
    medalBgs:   [colors.info + '25', colors.info + '18', colors.info + '12'],
    firstBorder: colors.info + '50',
  },
];

export default function RanglisteScreen() {
  const { getStandings } = useTournament();
  const [selected, setSelected] = useState(null);
  const standings = getStandings();

  const groupSize = Math.ceil(standings.length / 3);

  const groupedStandings = GROUPS.map((g, i) =>
    standings.slice(i * groupSize, (i + 1) * groupSize)
  ).filter((g) => g.length > 0);

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
          {groupedStandings.map((groupPlayers, gIdx) => {
            const group = GROUPS[gIdx];
            const overallStart = gIdx * groupSize + 1;
            const overallEnd = overallStart + groupPlayers.length - 1;

            return (
              <View key={group.key} style={s.groupSection}>
                {/* Group Header */}
                <View style={[s.groupHeader, { backgroundColor: group.bgColor, borderColor: group.borderColor }]}>
                  <View style={[s.groupIconWrap, { backgroundColor: group.color + '20', borderColor: group.color + '40' }]}>
                    <Ionicons name={group.icon} size={18} color={group.color} />
                  </View>
                  <View style={s.groupTitleWrap}>
                    <Text style={[s.groupTitle, { color: group.color }]}>{group.label}</Text>
                    <Text style={s.groupSublabel}>{group.sublabel}</Text>
                  </View>
                  <View style={[s.groupRangePill, { borderColor: group.color + '40' }]}>
                    <Text style={[s.groupRangeText, { color: group.color }]}>
                      {overallStart}–{overallEnd}
                    </Text>
                  </View>
                </View>

                {/* Column Headers */}
                <View style={s.tableHeader}>
                  <Text style={[s.col, s.colRank, s.headerText]}>#</Text>
                  <Text style={[s.col, s.colName, s.headerText]}>Name</Text>
                  <Text style={[s.col, s.colNum, s.headerText]}>Pkt</Text>
                  <Text style={[s.col, s.colNum, s.headerText]}>Siege</Text>
                  <Text style={[s.col, s.colNum, s.headerText]}>Diff</Text>
                </View>

                {/* Players */}
                {groupPlayers.map((p, i) => {
                  const isTop3 = i < 3;
                  const isFirst = i === 0;
                  const medalColor = group.medalColors[i] ?? colors.textMuted;
                  const medalBg    = group.medalBgs[i] ?? colors.panel;
                  const isSelected = selected === p.id;

                  return (
                    <View key={p.id}>
                      <TouchableOpacity
                        style={[
                          s.row,
                          isTop3 && s.rowTop,
                          isSelected && s.rowSelected,
                          isFirst && { borderColor: group.firstBorder, backgroundColor: colors.panel },
                        ]}
                        onPress={() => setSelected(isSelected ? null : p.id)}
                        activeOpacity={0.75}
                      >
                        {/* Rank within group */}
                        <View style={[s.col, s.colRank]}>
                          {isTop3 ? (
                            <View style={[s.medalBadge, { backgroundColor: medalBg }]}>
                              <Ionicons name={MEDAL_ICONS[i]} size={14} color={medalColor} />
                            </View>
                          ) : (
                            <Text style={s.rankNum}>{i + 1}</Text>
                          )}
                        </View>

                        {/* Name + league */}
                        <View style={[s.col, s.colName, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                          <Text
                            style={[s.nameText, isFirst && { color: group.color }]}
                            numberOfLines={1}
                          >
                            {p.name}
                          </Text>
                          {p.league ? (
                            <View style={[s.leaguePill, { backgroundColor: group.bgColor, borderColor: group.borderColor }]}>
                              <Text style={[s.leaguePillText, { color: group.color }]}>{p.league}</Text>
                            </View>
                          ) : null}
                        </View>

                        <Text style={[s.col, s.colNum, s.numText, { color: medalColor }]}>{p.points}</Text>
                        <Text style={[s.col, s.colNum, s.numText]}>{p.wins}</Text>
                        <Text style={[s.col, s.colNum, s.numText, p.diff > 0 && s.diffPos, p.diff < 0 && s.diffNeg]}>
                          {p.diff > 0 ? `+${p.diff}` : p.diff}
                        </Text>
                      </TouchableOpacity>

                      {isSelected && (
                        <View style={[s.detailCard, { borderColor: group.borderColor }]}>
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
                              <Text style={[s.detailStatNum, { color: group.color }]}>{p.points}</Text>
                              <Text style={s.detailStatLbl}>Punkte</Text>
                            </View>
                          </View>
                          <View style={s.detailMeta}>
                            <Ionicons
                              name={p.diff >= 0 ? 'trending-up' : 'trending-down'}
                              size={14}
                              color={p.diff >= 0 ? colors.success : colors.error}
                            />
                            <Text style={[s.detailMetaText, { color: p.diff >= 0 ? colors.success : colors.error }]}>
                              Differenz: {p.diff > 0 ? '+' : ''}{p.diff}
                            </Text>
                            <View style={s.detailOverallPill}>
                              <Text style={s.detailOverallText}>
                                Gesamt #{overallStart + i}
                              </Text>
                            </View>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}

                <View style={{ height: 8 }} />
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

  // Group
  groupSection: {
    marginBottom: 20,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    ...cardShadow,
  },
  groupIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupTitleWrap: {
    flex: 1,
  },
  groupTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  groupSublabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  groupRangePill: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  groupRangeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Table
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 2,
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
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 3,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rowTop: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    ...cardShadow,
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
  leaguePill: {
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  leaguePillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Detail card
  detailCard: {
    backgroundColor: colors.panelLight,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 4,
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
  detailMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  detailMetaText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  detailOverallPill: {
    backgroundColor: colors.bgSurface,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  detailOverallText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
});
