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
  const { getStandings } = useTournament();
  const [selected, setSelected] = useState(null);
  const standings = getStandings();

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

  return (
    <View style={shared.screen}>
      {/* Header */}
      <View style={s.header}>
        <Text style={shared.screenTitle}>Rangliste</Text>
        <View style={s.headerRight}>
          <TouchableOpacity style={s.printBtn} onPress={doPrint} activeOpacity={0.75}>
            <Ionicons name="print-outline" size={15} color={colors.silver} />
            <Text style={s.printBtnText}>Drucken</Text>
          </TouchableOpacity>
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
                        <TouchableOpacity
                          key={p.id}
                          style={[
                            s.colRow,
                            isTop3 && { backgroundColor: colors.panel, borderColor: colors.border },
                            isFirst && { borderColor: group.borderColor },
                            isSelected && s.colRowSelected,
                          ]}
                          onPress={() => setSelected(isSelected ? null : p.id)}
                          activeOpacity={0.7}
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
                              style={[s.colName, isFirst && { color: group.color }]}
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
                            <Text style={[s.colPts, { color: isTop3 ? medalColor : colors.silverDim }]}>
                              {p.games}Sp · {p.wins}S
                            </Text>
                            <Text style={[s.colStats, { color: p.diff >= 0 ? colors.success + 'AA' : colors.error + 'AA' }]}>
                              {p.diff > 0 ? '+' : ''}{p.diff}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })}
            </View>

            <View style={{ height: 24 }} />
          </ScrollView>

          {/* Detail-Karte für ausgewählten Spieler (unter den Spalten) */}
          {selectedPlayer && selectedGroup && (
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
                <TouchableOpacity onPress={() => setSelected(null)} activeOpacity={0.7}>
                  <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
              <View style={s.detailStats}>
                <View style={s.detailStat}>
                  <Text style={s.detailStatNum}>{selectedPlayer.games}</Text>
                  <Text style={s.detailStatLbl}>Spiele</Text>
                </View>
                <View style={[s.detailStat, s.detailStatMid]}>
                  <Text style={[s.detailStatNum, { color: colors.success }]}>{selectedPlayer.wins}</Text>
                  <Text style={s.detailStatLbl}>Siege</Text>
                </View>
                <View style={s.detailStat}>
                  <Text style={[s.detailStatNum, { color: selectedGroup.color }]}>{selectedPlayer.points}</Text>
                  <Text style={s.detailStatLbl}>Punkte</Text>
                </View>
                <View style={[s.detailStat, s.detailStatMid]}>
                  <Text style={[s.detailStatNum, { color: selectedPlayer.diff >= 0 ? colors.success : colors.error }]}>
                    {selectedPlayer.diff > 0 ? '+' : ''}{selectedPlayer.diff}
                  </Text>
                  <Text style={s.detailStatLbl}>Differenz</Text>
                </View>
              </View>
            </View>
          )}
        </>
      )}
    </View>
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
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    flex: 1,
  },
  colRange: {
    fontSize: 9,
    fontWeight: '600',
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
    fontWeight: '600',
    flexShrink: 1,
  },
  colLeague: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.3,
    flexShrink: 0,
  },
  colStats: {
    color: colors.textDim,
    fontSize: 8,
    fontWeight: '600',
    textAlign: 'right',
  },
  colStatsBox: {
    width: 44,
    alignItems: 'flex-end',
  },
  colPts: {
    fontSize: 11,
    fontWeight: '700',
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
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  detailMeta: {
    color: colors.textMuted,
    fontSize: 11,
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
    marginTop: 2,
    letterSpacing: 0.5,
  },

});
