import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useState, useEffect } from 'react';
import { useEntranceAnimation } from '../hooks/useEntranceAnimation';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { shared, cardShadow, fonts } from '../theme/styles';
import { useTournament } from '../store/tournament';
import AnimatedPressable from '../components/AnimatedPressable';

const MEDAL_ICONS = ['trophy', 'medal', 'ribbon'];

const GROUPS = [
  {
    key: 'vollmond',
    label: 'Vollmond',
    fullLabel: 'Vollmondgruppe',
    sublabel: 'Stärkste Spieler',
    icon: 'ellipse',
    color: colors.gold,
    bgColor: colors.goldGlow,
    borderColor: colors.borderGoldGlow,
    medalColors: [colors.gold, colors.silver, '#CD7F32'],
    medalBgs:   [colors.goldGlow, colors.silver + '20', '#CD7F3220'],
  },
  {
    key: 'halbmond',
    label: 'Halbmond',
    fullLabel: 'Halbmondgruppe',
    sublabel: 'Mittelfeld',
    icon: 'moon',
    color: colors.silver,
    bgColor: colors.silver + '15',
    borderColor: colors.silver + '35',
    medalColors: [colors.silver, colors.silverDim, colors.textMuted],
    medalBgs:   [colors.silver + '25', colors.silverDim + '20', colors.textMuted + '18'],
  },
  {
    key: 'neumond',
    label: 'Neumond',
    fullLabel: 'Neumondgruppe',
    sublabel: 'Aufsteiger',
    icon: 'ellipse-outline',
    color: colors.info,
    bgColor: colors.info + '15',
    borderColor: colors.info + '35',
    medalColors: [colors.info, colors.info + 'BB', colors.info + '80'],
    medalBgs:   [colors.info + '25', colors.info + '18', colors.info + '12'],
  },
];

const GROUP_COLORS = {
  vollmond: { header: '#B8860B', light: '#FFF8E1', border: '#F0C040' },
  halbmond: { header: '#607D8B', light: '#ECEFF1', border: '#B0BEC5' },
  neumond:  { header: '#1565C0', light: '#E3F2FD', border: '#90CAF9' },
};

const buildPrintContent = (standings, groupSize) => {
  const medalSymbols = ['🥇', '🥈', '🥉'];
  const groupKeys = ['vollmond', 'halbmond', 'neumond'];

  const rows = standings.map((p, i) => {
    const groupIdx = Math.min(Math.floor(i / groupSize), 2);
    const gc = GROUP_COLORS[groupKeys[groupIdx]];
    const grp = GROUPS[groupIdx];
    const medal = i < 3 ? `<span style="font-size:11px">${medalSymbols[i]}</span>` : `<b style="color:#555">${i + 1}</b>`;
    const parts = p.name.split(','); const name = parts.length > 1 ? `${parts[1].trim()} ${parts[0].trim()}` : p.name.trim();
    const league = p.league ? ` <span style="font-size:8px;color:#888;font-weight:700">[${p.league}]</span>` : '';
    const bg = i % 2 === 0 ? '#fafafa' : '#fff';
    const isGroupStart = i % groupSize === 0;
    const groupBar = isGroupStart ? `
      <tr>
        <td colspan="6" style="background:${gc.header};color:#fff;padding:2px 6px;font-size:8px;font-weight:800;letter-spacing:1px">
          ${grp.fullLabel.toUpperCase()} · ${grp.sublabel}
        </td>
      </tr>` : '';
    return `${groupBar}<tr style="background:${bg}">
      <td style="text-align:center;padding:2px 4px;width:26px">${medal}</td>
      <td style="padding:2px 6px;font-size:9px;font-weight:600">${name}${league}</td>
      <td style="text-align:right;padding:2px 4px;width:40px;font-weight:700;font-size:9px">${p.points} Pkt</td>
      <td style="text-align:right;padding:2px 4px;width:30px;color:#555;font-size:9px">${p.wins}S</td>
      <td style="text-align:right;padding:2px 4px;width:30px;color:#555;font-size:9px">${p.games}Sp</td>
      <td style="text-align:right;padding:2px 4px;width:36px;color:${p.diff >= 0 ? '#2e7d32' : '#c62828'};font-weight:700;font-size:9px">${p.diff > 0 ? '+' : ''}${p.diff}</td>
    </tr>`;
  }).join('');

  const date = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return `<div style="font-family:sans-serif;color:#1a1a2e">
  <div style="font-size:15px;font-weight:800;letter-spacing:3px;margin-bottom:2px">☽ MOONLIGHT CUP</div>
  <div style="font-size:8px;color:#888;margin-bottom:8px;letter-spacing:1px">RANGLISTE · Badminton Turniermanager · ${date}</div>
  <table style="width:100%;border-collapse:collapse;font-size:9px">
    <thead>
      <tr style="background:#1a1a2e;color:#fff">
        <th style="text-align:center;width:30px;padding:4px 4px;font-size:8px;letter-spacing:1px">#</th>
        <th style="text-align:left;padding:4px 6px;font-size:8px;letter-spacing:1px">NAME</th>
        <th style="text-align:right;width:44px;padding:4px 4px;font-size:8px;letter-spacing:1px">PUNKTE</th>
        <th style="text-align:right;width:34px;padding:4px 4px;font-size:8px;letter-spacing:1px">SIEGE</th>
        <th style="text-align:right;width:34px;padding:4px 4px;font-size:8px;letter-spacing:1px">SPIELE</th>
        <th style="text-align:right;width:38px;padding:4px 4px;font-size:8px;letter-spacing:1px">DIFF</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</div>`;
};

export default function RanglisteScreen() {
  const { getStandings, statAdjustments, setStatAdjustment } = useTournament();
  const [selected, setSelected] = useState(null);
  const [pendingDelta, setPendingDelta] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const standings = getStandings();

  useEffect(() => { setPendingDelta(null); setConfirming(false); }, [selected]);

  const groupSize = Math.ceil(standings.length / 3);
  const groups = GROUPS.map((g, i) => standings.slice(i * groupSize, (i + 1) * groupSize));

  const doPrint = () => {
    if (standings.length === 0 || typeof document === 'undefined') return;
    const content = buildPrintContent(standings, groupSize);
    const div = document.createElement('div');
    div.id = 'mc-print';
    div.innerHTML = content;
    document.body.appendChild(div);
    const style = document.createElement('style');
    style.textContent =
      '@media screen{#mc-print{display:none}}' +
      '@media print{#root{display:none!important}#mc-print{display:block!important}@page{margin:10mm}}';
    document.head.appendChild(style);
    window.print();
    if (div.parentNode) div.parentNode.removeChild(div);
    if (style.parentNode) style.parentNode.removeChild(style);
  };

  const selectedPlayer = selected ? standings.find((p) => p.id === selected) : null;
  const selectedOverallIdx = selectedPlayer ? standings.indexOf(selectedPlayer) : -1;
  const selectedGroupIdx = selectedOverallIdx >= 0 ? Math.floor(selectedOverallIdx / groupSize) : -1;
  const selectedGroup = selectedGroupIdx >= 0 ? GROUPS[selectedGroupIdx] : null;
  const selectedGroupRank = selectedOverallIdx >= 0 ? (selectedOverallIdx % groupSize) + 1 : -1;

  const entranceStyle = useEntranceAnimation();

  return (
    <Animated.View style={[{ flex: 1 }, entranceStyle]}>
    <View style={shared.screen}>
      {/* Header */}
      <View style={s.header}>
        <Text style={shared.screenTitle}>Rangliste</Text>
        <View style={s.headerRight}>
          <AnimatedPressable style={s.printBtn} onPress={doPrint} activeOpacity={0.75}>
            <Ionicons name="print-outline" size={15} color={colors.silver} />
            <Text style={s.printBtnText}>Drucken</Text>
          </AnimatedPressable>
          <View style={s.liveBadge}>
            <View style={s.liveDot} />
            <Text style={s.liveText}>LIVE</Text>
          </View>
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
        <>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* 3 Spalten nebeneinander */}
            <View style={s.columnsRow}>
              {groups.map((groupPlayers, gIdx) => {
                if (groupPlayers.length === 0) return null;
                const group = GROUPS[gIdx];
                const overallStart = gIdx * groupSize + 1;
                const overallEnd = overallStart + groupPlayers.length - 1;

                return (
                  <View key={group.key} style={s.column}>
                    {/* Spalten-Header */}
                    <View style={[s.colHeader, { backgroundColor: group.bgColor, borderColor: group.borderColor }]}>
                      <Ionicons name={group.icon} size={13} color={group.color} />
                      <Text style={[s.colHeaderText, { color: group.color }]}>{group.label}</Text>
                    </View>
                    <Text style={[s.colRange, { color: group.color + 'AA' }]}>
                      Platz {overallStart}–{overallEnd}
                    </Text>

                    {/* Tabellenköpfe */}
                    <View style={s.colTableHead}>
                      <Text style={[s.colHeadCell, { width: 22 }]}>#</Text>
                      <Text style={[s.colHeadCell, { flex: 1 }]}>Name</Text>
                      <Text style={[s.colHeadCell, { width: 44, textAlign: 'right' }]}>Sp/S/±</Text>
                    </View>

                    {/* Spielerzeilen */}
                    {groupPlayers.map((p, i) => {
                      const isTop3 = i < 3;
                      const isFirst = i === 0;
                      const medalColor = group.medalColors[i] ?? colors.textMuted;
                      const medalBg    = group.medalBgs[i];
                      const isSelected = selected === p.id;
                      const parts = p.name.split(','); const firstName = parts.length > 1 ? `${parts[1].trim()} ${parts[0].trim()}` : p.name.trim();

                      return (
                        <AnimatedPressable
                          key={p.id}
                          style={[
                            s.colRow,
                            isTop3 && { backgroundColor: colors.panel, borderColor: colors.border },
                            isFirst && { borderColor: group.borderColor, paddingVertical: 9 },
                            isSelected && s.colRowSelected,
                          ]}
                          onPress={() => setSelected(isSelected ? null : p.id)}
                        >
                          {/* Rang */}
                          <View style={{ width: 22, alignItems: 'center' }}>
                            {isTop3 ? (
                              <View style={[s.medalDot, { backgroundColor: medalBg }]}>
                                <Ionicons name={MEDAL_ICONS[i]} size={10} color={medalColor} />
                              </View>
                            ) : (
                              <Text style={s.colRankNum}>{i + 1}</Text>
                            )}
                          </View>

                          {/* Name + Liga */}
                          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 3, overflow: 'hidden' }}>
                            <Text
                              style={[s.colName, isFirst && { color: group.color, fontSize: 13 }, isTop3 && !isFirst && { fontSize: 12 }]}
                              numberOfLines={1}
                            >
                              {firstName}
                            </Text>
                            {p.league ? (
                              <Text style={[s.colLeague, { color: group.color + '99' }]}>{p.league}</Text>
                            ) : null}
                          </View>

                          {/* Stats-Spalte rechts */}
                          <View style={s.colStatsBox}>
                            <Text style={[s.colPts, { color: isTop3 ? medalColor : colors.silverDim }, isFirst && { fontSize: 15 }]}>
                              {p.games}Sp · {p.wins}S
                            </Text>
                            <Text style={[s.colStats, { color: p.diff >= 0 ? colors.success + 'AA' : colors.error + 'AA' }]}>
                              {p.diff > 0 ? '+' : ''}{p.diff}
                            </Text>
                          </View>
                        </AnimatedPressable>
                      );
                    })}
                  </View>
                );
              })}
            </View>

            <View style={{ height: 24 }} />
          </ScrollView>

          {/* Detail-Karte für ausgewählten Spieler (unter den Spalten) */}
          {selectedPlayer && selectedGroup && (() => {
            const delta = pendingDelta ?? { games: 0, wins: 0, diff: 0 };
            const hasPending = pendingDelta !== null && (pendingDelta.games !== 0 || pendingDelta.wins !== 0 || pendingDelta.diff !== 0);
            const newWins  = selectedPlayer.wins  + delta.wins;
            const newGames = selectedPlayer.games + delta.games;
            const winsError = newWins > newGames;

            const adjust = (field, dir) => {
              setPendingDelta((prev) => {
                const base = prev ?? { games: 0, wins: 0, diff: 0 };
                return { ...base, [field]: (base[field] ?? 0) + dir };
              });
            };

            const doSave = () => {
              const savedAdj = statAdjustments[selectedPlayer.id] ?? { games: 0, wins: 0, diff: 0 };
              setStatAdjustment(selectedPlayer.id, {
                games: (savedAdj.games ?? 0) + delta.games,
                wins:  (savedAdj.wins  ?? 0) + delta.wins,
                diff:  (savedAdj.diff  ?? 0) + delta.diff,
              });
              setPendingDelta(null);
              setConfirming(false);
            };

            const discardChanges = () => { setPendingDelta(null); setConfirming(false); };

            const StatControl = ({ value, field, label, color }) => (
              <View style={s.detailStat}>
                <View style={s.statControlRow}>
                  <AnimatedPressable style={s.statBtn} onPress={() => adjust(field, -1)}>
                    <Ionicons name="remove" size={14} color={colors.textMuted} />
                  </AnimatedPressable>
                  <Text style={[s.detailStatNum, color && { color }]}>{value}</Text>
                  <AnimatedPressable style={s.statBtn} onPress={() => adjust(field, +1)}>
                    <Ionicons name="add" size={14} color={colors.textMuted} />
                  </AnimatedPressable>
                </View>
                <Text style={s.detailStatLbl}>{label}</Text>
              </View>
            );

            return (
              <View style={[s.detailCard, { borderColor: selectedGroup.borderColor }]}>
                <View style={s.detailTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.detailName, { color: selectedGroup.color }]}>
                      {(() => { const p = selectedPlayer.name.split(','); return p.length > 1 ? `${p[1].trim()} ${p[0].trim()}` : selectedPlayer.name.trim(); })()}
                    </Text>
                    <Text style={s.detailMeta}>
                      {selectedGroup.fullLabel} · Platz {selectedGroupRank} · Gesamt #{selectedOverallIdx + 1}
                    </Text>
                  </View>
                  <AnimatedPressable onPress={() => setSelected(null)} activeOpacity={0.7}>
                    <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                  </AnimatedPressable>
                </View>

                <View style={s.detailStats}>
                  <StatControl value={selectedPlayer.games + delta.games} field="games" label="Spiele" />
                  <View style={[s.detailStat, s.detailStatMid]}>
                    <View style={s.statControlRow}>
                      <AnimatedPressable style={s.statBtn} onPress={() => adjust('wins', -1)}>
                        <Ionicons name="remove" size={14} color={colors.textMuted} />
                      </AnimatedPressable>
                      <Text style={[s.detailStatNum, { color: colors.success }]}>{selectedPlayer.wins + delta.wins}</Text>
                      <AnimatedPressable style={s.statBtn} onPress={() => adjust('wins', +1)}>
                        <Ionicons name="add" size={14} color={colors.textMuted} />
                      </AnimatedPressable>
                    </View>
                    <Text style={s.detailStatLbl}>Siege</Text>
                  </View>
                  <View style={s.detailStat}>
                    <Text style={[s.detailStatNum, { color: selectedGroup.color }]}>{selectedPlayer.points + (delta.wins * 2)}</Text>
                    <Text style={s.detailStatLbl}>Punkte</Text>
                  </View>
                  <View style={[s.detailStat, s.detailStatMid]}>
                    <View style={s.statControlRow}>
                      <AnimatedPressable style={s.statBtn} onPress={() => adjust('diff', -1)} activeOpacity={0.7}>
                        <Ionicons name="remove" size={14} color={colors.textMuted} />
                      </AnimatedPressable>
                      <Text style={[s.detailStatNum, { color: (selectedPlayer.diff + delta.diff) >= 0 ? colors.success : colors.error }]}>
                        {(selectedPlayer.diff + delta.diff) > 0 ? '+' : ''}{selectedPlayer.diff + delta.diff}
                      </Text>
                      <AnimatedPressable style={s.statBtn} onPress={() => adjust('diff', +1)} activeOpacity={0.7}>
                        <Ionicons name="add" size={14} color={colors.textMuted} />
                      </AnimatedPressable>
                    </View>
                    <Text style={s.detailStatLbl}>Differenz</Text>
                  </View>
                </View>

                {winsError && (
                  <View style={s.errorBanner}>
                    <Ionicons name="warning" size={13} color={colors.error} />
                    <Text style={s.errorText}>
                      Siege ({newWins}) können nicht größer sein als Spiele ({newGames})
                    </Text>
                  </View>
                )}

                {hasPending && !confirming && (
                  <View style={s.confirmRow}>
                    <AnimatedPressable style={s.discardBtn} onPress={discardChanges} activeOpacity={0.7}>
                      <Ionicons name="close" size={14} color={colors.error} />
                      <Text style={s.discardBtnText}>Verwerfen</Text>
                    </AnimatedPressable>
                    <AnimatedPressable
                      style={[s.saveBtn, winsError && s.saveBtnDisabled]}
                      onPress={winsError ? undefined : () => setConfirming(true)}
                      activeOpacity={winsError ? 1 : 0.8}
                    >
                      <Ionicons name="checkmark" size={14} color={winsError ? colors.textMuted : colors.bg} />
                      <Text style={[s.saveBtnText, winsError && s.saveBtnTextDisabled]}>Speichern</Text>
                    </AnimatedPressable>
                  </View>
                )}

                {confirming && (
                  <View style={s.confirmPanel}>
                    <Text style={s.confirmTitle}>Änderungen bestätigen?</Text>
                    <View style={s.confirmLines}>
                      {delta.games !== 0 && (
                        <Text style={s.confirmLine}>
                          Spiele: <Text style={s.confirmOld}>{selectedPlayer.games - delta.games}</Text>
                          {'  →  '}
                          <Text style={s.confirmNew}>{selectedPlayer.games}</Text>
                        </Text>
                      )}
                      {delta.wins !== 0 && (
                        <Text style={s.confirmLine}>
                          Siege: <Text style={s.confirmOld}>{selectedPlayer.wins - delta.wins}</Text>
                          {'  →  '}
                          <Text style={s.confirmNew}>{selectedPlayer.wins}</Text>
                        </Text>
                      )}
                      {delta.diff !== 0 && (
                        <Text style={s.confirmLine}>
                          Differenz: <Text style={s.confirmOld}>{selectedPlayer.diff - delta.diff}</Text>
                          {'  →  '}
                          <Text style={s.confirmNew}>{selectedPlayer.diff > 0 ? '+' : ''}{selectedPlayer.diff}</Text>
                        </Text>
                      )}
                    </View>
                    <View style={s.confirmRow}>
                      <AnimatedPressable style={s.discardBtn} onPress={() => setConfirming(false)} activeOpacity={0.7}>
                        <Ionicons name="arrow-back" size={14} color={colors.error} />
                        <Text style={s.discardBtnText}>Zurück</Text>
                      </AnimatedPressable>
                      <AnimatedPressable style={s.saveBtn} onPress={doSave} activeOpacity={0.8}>
                        <Ionicons name="checkmark-circle" size={14} color={colors.bg} />
                        <Text style={s.saveBtnText}>Bestätigen</Text>
                      </AnimatedPressable>
                    </View>
                  </View>
                )}
              </View>
            );
          })()}
        </>
      )}
    </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  printBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.panel,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  printBtnText: {
    color: colors.silver,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
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
    fontFamily: fonts.headingSemi,
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
    fontSize: 20,
    fontFamily: fonts.heading,
    marginBottom: 8,
  },
  emptyHint: {
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: fonts.body,
    textAlign: 'center',
  },

  // 3-Spalten-Layout
  columnsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  column: {
    flex: 1,
    minWidth: 0,
  },
  colHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginBottom: 3,
  },
  colHeaderText: {
    fontSize: 12,
    fontFamily: fonts.heading,
    letterSpacing: 0.5,
    flex: 1,
  },
  colRange: {
    fontSize: 9,
    fontFamily: fonts.bodySemi,
    letterSpacing: 0.3,
    textAlign: 'center',
    marginBottom: 6,
  },
  colTableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 3,
  },
  colHeadCell: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  colRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 6,
    marginBottom: 2,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  colRowSelected: {
    backgroundColor: colors.panelLight,
    borderColor: colors.borderStrong,
  },
  medalDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colRankNum: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  colName: {
    color: colors.silver,
    fontSize: 11,
    fontFamily: fonts.bodySemi,
    flexShrink: 1,
  },
  colLeague: {
    fontSize: 8,
    fontFamily: fonts.headingSemi,
    letterSpacing: 0.3,
    flexShrink: 0,
  },
  colStats: {
    color: colors.textDim,
    fontSize: 8,
    fontFamily: fonts.body,
    textAlign: 'right',
  },
  colStatsBox: {
    width: 44,
    alignItems: 'flex-end',
  },
  colPts: {
    fontSize: 12,
    fontFamily: fonts.heading,
    textAlign: 'right',
  },

  // Detail-Karte
  detailCard: {
    backgroundColor: colors.panelLight,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 8,
    overflow: 'hidden',
    ...cardShadow,
  },
  detailTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    paddingBottom: 10,
    gap: 10,
  },
  detailName: {
    fontSize: 15,
    fontFamily: fonts.heading,
    marginBottom: 2,
  },
  detailMeta: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: fonts.body,
  },
  detailStats: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  detailStat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  detailStatMid: {
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
  detailStatNum: {
    color: colors.silver,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  detailStatLbl: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 4,
    letterSpacing: 0.5,
  },
  statControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.error + '18',
    borderTopWidth: 1,
    borderTopColor: colors.error + '40',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  errorText: {
    color: colors.error,
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  saveBtnDisabled: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
  },
  saveBtnTextDisabled: {
    color: colors.textMuted,
  },
  confirmPanel: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 12,
    gap: 10,
  },
  confirmTitle: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  confirmLines: {
    gap: 3,
    marginBottom: 4,
  },
  confirmLine: {
    color: colors.textMuted,
    fontSize: 12,
  },
  confirmOld: {
    color: colors.textMuted,
    fontWeight: '600',
  },
  confirmNew: {
    color: colors.success,
    fontWeight: '800',
  },
  confirmRow: {
    flexDirection: 'row',
    gap: 8,
  },
  discardBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: colors.error + '15',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.error + '40',
    paddingVertical: 9,
  },
  discardBtnText: {
    color: colors.error,
    fontSize: 13,
    fontWeight: '700',
  },
  saveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.gold,
    borderRadius: 10,
    paddingVertical: 9,
  },
  saveBtnText: {
    color: colors.bg,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});

