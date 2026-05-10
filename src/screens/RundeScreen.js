import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, Share, Animated } from 'react-native';
import AnimatedPressable from '../components/AnimatedPressable';
import { useState, useEffect, useRef } from 'react';
import { useEntranceAnimation } from '../hooks/useEntranceAnimation';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Line, Path, Ellipse } from 'react-native-svg';

function BadmintonRacketIcon({ size = 40, color = '#F0C040' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      {/* Head outline */}
      <Ellipse cx="20" cy="14" rx="10" ry="12" stroke={color} strokeWidth="1.8" fill="none" />
      {/* String grid — vertical */}
      <Line x1="16" y1="2.5"  x2="16" y2="25.5" stroke={color} strokeWidth="0.8" opacity="0.55" />
      <Line x1="20" y1="2"    x2="20" y2="26"   stroke={color} strokeWidth="0.8" opacity="0.55" />
      <Line x1="24" y1="2.5"  x2="24" y2="25.5" stroke={color} strokeWidth="0.8" opacity="0.55" />
      {/* String grid — horizontal */}
      <Line x1="10.2" y1="8"  x2="29.8" y2="8"  stroke={color} strokeWidth="0.8" opacity="0.55" />
      <Line x1="10"   y1="12" x2="30"   y2="12" stroke={color} strokeWidth="0.8" opacity="0.55" />
      <Line x1="10"   y1="16" x2="30"   y2="16" stroke={color} strokeWidth="0.8" opacity="0.55" />
      <Line x1="10.5" y1="20" x2="29.5" y2="20" stroke={color} strokeWidth="0.8" opacity="0.55" />
      {/* Throat */}
      <Path d="M16 26 L18 30 L22 30 L24 26" stroke={color} strokeWidth="1.6" fill="none" strokeLinejoin="round" />
      {/* Shaft */}
      <Line x1="18" y1="30" x2="17" y2="36" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Line x1="22" y1="30" x2="23" y2="36" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      {/* Grip */}
      <Path d="M17 36 Q20 38.5 23 36" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
    </Svg>
  );
}
import { colors } from '../theme/colors';
import { shared, cardShadow, fonts } from '../theme/styles';
import { useTournament } from '../store/tournament';

const TYPE_CONFIG = {
  MM: { label: 'HERRENDOPPEL', icon: 'man',       color: colors.info },
  FF: { label: 'DAMENDOPPEL',  icon: 'woman',     color: '#E879A0' },
  MF: { label: 'MIXED',        icon: 'swap-horizontal', color: colors.gold },
};

export default function RundeScreen() {
  const {
    getCurrentRoundData, currentRound, rounds, allMatchesDone, startNewRound, startFinalRunde,
    participants, advanceDurchgang, currentDurchgangDone,
    deleteCurrentRound, deleteRound, swapMatchPlayers,
    triggerAutoTimer, getStandings, resetTournament,
  } = useTournament();
  const entranceStyle = useEntranceAnimation();
  const [showConfirm, setShowConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showFinalConfirm, setShowFinalConfirm] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [pendingSwap, setPendingSwap] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [roundsMenuOpen, setRoundsMenuOpen] = useState(false);
  const [roundToDelete, setRoundToDelete] = useState(null);  // round object
  const [viewingRoundId, setViewingRoundId] = useState(null);
  const [printMenuOpen, setPrintMenuOpen] = useState(false);
  const [printPreview, setPrintPreview] = useState(null); // round object to preview
  const [previewDg, setPreviewDg] = useState(null);      // null = beide, 1 = nur D1, 2 = nur D2
  const prevRoundRef = useRef(0);
  const round = getCurrentRoundData();
  const displayRound = viewingRoundId ? rounds.find((r) => r.id === viewingRoundId) : round;
  const isSchnellrunde = round?.isSchnellrunde ?? false;
  const durchgang = round?.currentDurchgang ?? 1;

  const getName = (id) => {
    const p = participants.find((x) => x.id === id);
    if (!p) return '?';
    const parts = p.name.split(','); const first = parts.length > 1 ? `${parts[1].trim()} ${parts[0].trim()}` : p.name.trim();
    return p.league ? `${first} [${p.league}]` : first;
  };
  const getTeam = (ids) => ids.map(getName).join(' & ');

  // Wenn eine vergangene Runde angeschaut wird: alle Matches zeigen (beide DGs)
  const visibleMatches = viewingRoundId
    ? (displayRound?.matches ?? []).sort((a, b) => (a.durchgang ?? 1) - (b.durchgang ?? 1) || (a.feld ?? 0) - (b.feld ?? 0))
    : (round?.matches?.filter((m) => m.durchgang === durchgang) ?? []).sort((a, b) => (a.feld ?? 0) - (b.feld ?? 0));
  const pendingCount = visibleMatches.filter((m) => !m.done).length;
  const doneCount = visibleMatches.filter((m) => m.done).length;

  const d1Done = currentDurchgangDone();
  const allDone = allMatchesDone();

  // Primäre Aktion: In D1 → "Durchgang 2 starten"; in D2 → "Neue Runde starten"
  const inD1 = round && durchgang === 1;
  const isFinalRunde = round?.isFinalRunde ?? false;
  // Nach der Finale-Runde kann keine neue Runde mehr gestartet werden
  const primaryLabel = !round ? 'NEUE RUNDE STARTEN' : inD1 ? 'DURCHGANG 2 STARTEN' : isFinalRunde ? 'FINALE LÄUFT' : 'NEUE RUNDE STARTEN';
  const primaryEnabled = !round || (inD1 ? d1Done : (isFinalRunde ? false : allDone));

  const handlePrimaryPress = () => {
    if (!round || !inD1) {
      if (!isFinalRunde) setShowConfirm(true);
    } else {
      advanceDurchgang();
      triggerAutoTimer(2, currentRound === 1);
    }
  };

  const buildSiegerHtml = () => {
    const standings = getStandings();
    const groupSize = Math.ceil(standings.length / 3);
    const groupDefs = [
      { label: 'Vollmondgruppe', color: '#B8860B', light: '#FFF8E1', border: '#F0C040' },
      { label: 'Halbmondgruppe', color: '#607D8B', light: '#ECEFF1', border: '#B0BEC5' },
      { label: 'Neumondgruppe',  color: '#1565C0', light: '#E3F2FD', border: '#90CAF9' },
    ];
    const medals = ['🥇', '🥈', '🥉'];
    const cols = groupDefs.map((g, gi) => {
      const players = standings.slice(gi * groupSize, (gi + 1) * groupSize);
      if (!players.length) return '';
      const rows = players.slice(0, 3).map((p, i) => {
        const parts = p.name.split(',');
        const name = parts.length > 1 ? `${parts[1].trim()} ${parts[0].trim()}` : p.name.trim();
        const league = p.league ? ` <span style="font-size:10px;color:#888">[${p.league}]</span>` : '';
        return `<tr style="background:${i === 0 ? g.light : i % 2 === 0 ? '#fafafa' : '#fff'}">
          <td style="padding:10px 8px;text-align:center;font-size:18px">${medals[i]}</td>
          <td style="padding:10px 12px;font-size:15px;font-weight:${i === 0 ? '800' : '600'}">${name}${league}</td>
          <td style="padding:10px 10px;text-align:right;font-size:13px;font-weight:700;color:#555">${p.wins}S · ${p.diff > 0 ? '+' : ''}${p.diff}</td>
        </tr>`;
      }).join('');
      return `<div style="margin-bottom:24px;border-radius:10px;overflow:hidden;border:1px solid ${g.border}">
        <div style="background:${g.color};color:#fff;padding:10px 14px;font-size:14px;font-weight:800;letter-spacing:1px">${g.label.toUpperCase()}</div>
        <table style="width:100%;border-collapse:collapse">${rows}</table>
      </div>`;
    }).join('');
    const date = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `<div style="text-align:center;margin-bottom:24px;font-family:sans-serif;color:#1a1a2e">
        <div style="font-size:26px;font-weight:800;letter-spacing:3px">☽ MOONLIGHT CUP</div>
        <div style="font-size:13px;color:#888;margin-top:4px;letter-spacing:2px">SIEGEREHRUNG · ${date}</div>
        <div style="width:60px;height:3px;background:#B8860B;margin:12px auto 0"></div>
      </div>
      ${cols}`;
  };

  const printSieger = () => printHtml(buildSiegerHtml());

  const handleConfirmStart = () => {
    setShowConfirm(false);
    startNewRound();
  };

  // Wenn eine neue Runde startet: Timer starten + automatisch drucken
  useEffect(() => {
    if (currentRound === 0) {
      prevRoundRef.current = 0;
      return;
    }
    if (currentRound > prevRoundRef.current) {
      prevRoundRef.current = currentRound;
      const newRound = rounds.find((r) => r.id === currentRound);
      if (newRound) {
        triggerAutoTimer(1, currentRound === 1);
        doPrintBoth(newRound);
      }
    }
  }, [currentRound, rounds]);

  const TYPE_LABELS = { MM: 'Herrendoppel', FF: 'Damendoppel', MF: 'Gemischt' };

  const buildPageContent = (r, dg) => {
    const matches = [...r.matches.filter((m) => m.durchgang === dg)]
      .sort((a, b) => (a.feld ?? 0) - (b.feld ?? 0));
    const sitOut = dg === 2 && r.sittingOut?.length > 0
      ? `<p style="margin-top:14px;font-size:12px;color:#888"><b>Freilos:</b> ${r.sittingOut.map(getName).join(', ')}</p>` : '';
    const rows = matches.map((m, i) => `
      <tr style="background:${i % 2 === 0 ? '#f5f5f5' : '#fff'}">
        <td style="padding:6px 8px;font-size:11px;font-weight:800;color:#1a1a2e;white-space:nowrap;text-align:center">${m.feld != null ? `Feld ${m.feld}` : ''}</td>
        <td style="padding:6px 10px;font-size:10px;color:#555;font-weight:700;white-space:nowrap">${TYPE_LABELS[m.type] ?? m.type}</td>
        <td style="padding:6px 10px;font-size:13px;font-weight:700;text-align:right">${m.teamA.map(getName).join(' &amp; ')}</td>
        <td style="padding:6px 6px;text-align:center;color:#222;font-size:15px;font-weight:800">:</td>
        <td style="padding:6px 10px;font-size:13px;font-weight:700">${m.teamB.map(getName).join(' &amp; ')}</td>
      </tr>`).join('');
    return `
      <div style="overflow:hidden;margin-bottom:5px">
        <div style="float:right;background:#1a1a2e;color:#fff;padding:5px 12px;border-radius:6px;font-size:12px;font-weight:800;letter-spacing:1px;margin-left:10px">DURCHGANG ${dg}</div>
        <div style="font-size:18px;font-weight:800">☽ Moonlight Cup — Runde ${r.id}</div>
        <div style="font-size:11px;color:#666;margin-top:2px">${r.isSchnellrunde ? 'Schnellrunde' : 'Normale Runde'}</div>
      </div>
      <hr style="border:none;border-top:2px solid #1a1a2e;margin:8px 0 12px"/>
      <table style="width:100%;border-collapse:collapse;font-size:13px;table-layout:fixed">
        <thead>
          <tr style="background:#1a1a2e;color:#fff">
            <th style="padding:6px 8px;text-align:center;font-size:9px;letter-spacing:1px;width:6%">FELD</th>
            <th style="padding:6px 10px;text-align:left;font-size:9px;letter-spacing:1px;width:11%">TYP</th>
            <th style="padding:6px 10px;text-align:right;width:38%">TEAM A</th>
            <th style="padding:6px 6px;width:6%;text-align:center"></th>
            <th style="padding:6px 10px;text-align:left;width:39%">TEAM B</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      ${sitOut}`;
  };

  const printHtml = (innerHtml) => {
    if (typeof window === 'undefined') return;
    const css =
      '*{box-sizing:border-box}' +
      'body{margin:0;padding:14px 22px;font-family:Arial,sans-serif;color:#222}' +
      '.pg{display:block;height:0;page-break-after:always;break-after:page}' +
      'thead{display:table-header-group}' +
      '@page{margin:10mm;size:A4 landscape}';
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(
      '<!DOCTYPE html><html><head><meta charset="utf-8"><style>' + css + '</style></head>' +
      '<body>' + innerHtml +
      '<script>setTimeout(function(){window.print();window.addEventListener("afterprint",function(){window.close()})},200);<\/script>' +
      '</body></html>'
    );
    w.document.close();
  };

  const doPrintBoth = (r) => {
    printHtml(
      buildPageContent(r, 1) +
      '<div class="pg"></div>' +
      buildPageContent(r, 2)
    );
    setPrintPreview(null);
    setPreviewDg(null);
  };

  const doPrint = () => {
    printHtml(buildPageContent(printPreview, previewDg));
    if (previewDg === 1) {
      setPreviewDg(2);
    } else {
      setPreviewDg(null);
      setPrintPreview(null);
    }
  };

  const doShare = async (r) => {
    const fmt = (list, lbl) => list.length === 0 ? '' :
      `\n── ${lbl} ──\n` + list.map((m, i) =>
        `${i + 1}. [${TYPE_LABELS[m.type]}]  ${m.teamA.map(getName).join(' & ')}  vs  ${m.teamB.map(getName).join(' & ')}`
      ).join('\n');
    const text = `☽ MOONLIGHT CUP — Runde ${r.id}\n` +
      (r.isSchnellrunde ? 'Schnellrunde' : 'Normale Runde') + '\n' +
      '─'.repeat(38) +
      fmt(r.matches.filter(m => m.durchgang === 1), 'DURCHGANG 1') +
      fmt(r.matches.filter(m => m.durchgang === 2), 'DURCHGANG 2') +
      (r.sittingOut?.length > 0 ? `\n\nFreilos: ${r.sittingOut.map(getName).join(', ')}` : '');
    try { await Share.share({ message: text }); } catch (_) {}
  };

  const printSelectedRound = (r) => {
    setPrintMenuOpen(false);
    doPrintBoth(r);
  };

  // Edit helpers
  const allEditMatches = round?.matches ?? [];
  const getPlayerName = (pid) => {
    const p = participants.find((x) => x.id === pid);
    if (!p) return '?';
    const parts = p.name.split(','); const first = parts.length > 1 ? `${parts[1].trim()} ${parts[0].trim()}` : p.name.trim();
    return p.league ? `${first} [${p.league}]` : first;
  };

  const handleSlotPress = (matchId, team, idx, pid) => {
    if (!selectedSlot) {
      setSelectedSlot({ matchId, team, idx, pid });
      return;
    }
    const isSame = selectedSlot.matchId === matchId && selectedSlot.team === team && selectedSlot.idx === idx;
    if (isSame) { setSelectedSlot(null); return; }
    setPendingSwap({ slot1: selectedSlot, slot2: { matchId, team, idx, pid } });
    setSelectedSlot(null);
  };

  const confirmSwap = () => {
    const { slot1, slot2 } = pendingSwap;
    swapMatchPlayers(slot1.matchId, slot1.team, slot1.idx, slot2.matchId, slot2.team, slot2.idx);
    setPendingSwap(null);
  };

  const confirmDeleteRound = () => {
    setConfirmDelete(false);
    setEditOpen(false);
    deleteCurrentRound();
  };

  return (
    <Animated.View style={[{ flex: 1 }, entranceStyle]}>
    <View style={shared.screen}>

      {/* ── Runden-Übersicht Modal ── */}
      <Modal visible={roundsMenuOpen} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={[s.modalCard, { maxHeight: '80%' }]}>
            <View style={s.roundsMenuHeader}>
              <Text style={s.modalTitle}>Alle Runden</Text>
              <AnimatedPressable onPress={() => setRoundsMenuOpen(false)} activeOpacity={0.7}>
                <Ionicons name="close-circle" size={22} color={colors.textMuted} />
              </AnimatedPressable>
            </View>
            {rounds.length === 0 ? (
              <Text style={[s.modalBody, { marginBottom: 0 }]}>Noch keine Runden gespielt.</Text>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {[...rounds].reverse().map((r) => {
                  const total = r.matches?.length ?? 0;
                  const done = r.matches?.filter((m) => m.done).length ?? 0;
                  const isCurrent = r.id === currentRound;
                  const isViewing = r.id === viewingRoundId;
                  return (
                    <AnimatedPressable
                      key={r.id}
                      style={[s.roundRow, isCurrent && s.roundRowCurrent, isViewing && s.roundRowViewing]}
                      onPress={() => {
                        setViewingRoundId(r.id === viewingRoundId ? null : r.id);
                        setRoundsMenuOpen(false);
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={s.roundRowTop}>
                          <Text style={[s.roundRowTitle, isCurrent && { color: colors.gold }, isViewing && { color: colors.info }]}>
                            Runde {r.id}
                          </Text>
                          <View style={[r.isSchnellrunde ? s.schnellPill : s.normalPill, { paddingHorizontal: 7, paddingVertical: 2 }]}>
                            <Ionicons
                              name={r.isSchnellrunde ? 'flash' : 'shield-checkmark'}
                              size={9}
                              color={r.isSchnellrunde ? colors.warning : colors.success}
                            />
                            <Text style={[r.isSchnellrunde ? s.schnellPillText : s.normalPillText, { fontSize: 9 }]}>
                              {r.isSchnellrunde ? 'SCHNELL' : 'NORMAL'}
                            </Text>
                          </View>
                          {isCurrent && (
                            <View style={s.currentBadge}>
                              <Text style={s.currentBadgeText}>AKTIV</Text>
                            </View>
                          )}
                          {isViewing && (
                            <View style={s.viewingBadge}>
                              <Text style={s.viewingBadgeText}>ANSICHT</Text>
                            </View>
                          )}
                        </View>
                        <Text style={s.roundRowMeta}>{total} Spiele · {done} fertig · {total - done} offen</Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                        <Ionicons name="eye-outline" size={15} color={isViewing ? colors.info : colors.textDim} />
                        <AnimatedPressable
                          style={s.roundDeleteBtn}
                          onPress={(e) => { e.stopPropagation?.(); setRoundToDelete(r); }}
                          activeOpacity={0.75}
                        >
                          <Ionicons name="trash-outline" size={16} color={colors.error} />
                        </AnimatedPressable>
                      </View>
                    </AnimatedPressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>

        {/* Bestätigung Runde löschen */}
        {roundToDelete && (
          <Modal visible transparent animationType="fade">
            <View style={s.modalOverlay}>
              <View style={s.modalCard}>
                <Text style={s.modalTitle}>Runde {roundToDelete.id} löschen?</Text>
                <Text style={s.modalBody}>
                  Alle Paarungen und Ergebnisse dieser Runde werden unwiderruflich gelöscht.{'\n'}
                  Die Rangliste wird entsprechend aktualisiert.
                </Text>
                <View style={s.modalButtons}>
                  <AnimatedPressable style={s.modalBtnCancel} onPress={() => setRoundToDelete(null)} activeOpacity={0.8}>
                    <Text style={s.modalBtnCancelText}>Abbrechen</Text>
                  </AnimatedPressable>
                  <AnimatedPressable
                    style={s.modalBtnRed}
                    onPress={() => {
                      deleteRound(roundToDelete.id);
                      setRoundToDelete(null);
                      setRoundsMenuOpen(false);
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="trash" size={13} color={colors.white} style={{ marginRight: 5 }} />
                    <Text style={s.modalBtnRedText}>Löschen</Text>
                  </AnimatedPressable>
                </View>
              </View>
            </View>
          </Modal>
        )}
      </Modal>

      {/* ── Drucken-Auswahl Modal ── */}
      <Modal visible={printMenuOpen} transparent animationType="none">
        <View style={s.modalOverlay}>
          <View style={[s.modalCard, { maxHeight: '80%' }]}>
            <View style={s.roundsMenuHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="print-outline" size={18} color={colors.gold} />
                <Text style={s.modalTitle}>Runde drucken</Text>
              </View>
              <AnimatedPressable onPress={() => setPrintMenuOpen(false)} activeOpacity={0.7}>
                <Ionicons name="close-circle" size={22} color={colors.textMuted} />
              </AnimatedPressable>
            </View>
            {rounds.length === 0 ? (
              <Text style={[s.modalBody, { marginBottom: 0 }]}>Noch keine Runden gespielt.</Text>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {[...rounds].reverse().map((r) => {
                  const total = r.matches?.length ?? 0;
                  const isCurrent = r.id === currentRound;
                  return (
                    <AnimatedPressable
                      key={r.id}
                      style={[s.roundRow, isCurrent && s.roundRowCurrent]}
                      onPress={() => printSelectedRound(r)}
                      activeOpacity={0.75}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={s.roundRowTop}>
                          <Text style={[s.roundRowTitle, isCurrent && { color: colors.gold }]}>
                            Runde {r.id}
                          </Text>
                          <View style={[r.isSchnellrunde ? s.schnellPill : s.normalPill, { paddingHorizontal: 7, paddingVertical: 2 }]}>
                            <Ionicons
                              name={r.isSchnellrunde ? 'flash' : 'shield-checkmark'}
                              size={9}
                              color={r.isSchnellrunde ? colors.warning : colors.success}
                            />
                            <Text style={[r.isSchnellrunde ? s.schnellPillText : s.normalPillText, { fontSize: 9 }]}>
                              {r.isSchnellrunde ? 'SCHNELL' : 'NORMAL'}
                            </Text>
                          </View>
                          {isCurrent && (
                            <View style={s.currentBadge}>
                              <Text style={s.currentBadgeText}>AKTIV</Text>
                            </View>
                          )}
                        </View>
                        <Text style={s.roundRowMeta}>{total} Spiele · tippen zum Drucken</Text>
                      </View>
                      <Ionicons name="print-outline" size={18} color={colors.gold} />
                    </AnimatedPressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Edit Modal ── */}
      <Modal visible={editOpen} animationType="slide" transparent={false}>
        <View style={s.editScreen}>
          {/* Edit Header */}
          <View style={s.editHeader}>
            <Text style={s.editTitle}>Runde {currentRound} bearbeiten</Text>
            <AnimatedPressable onPress={() => { setEditOpen(false); setSelectedSlot(null); }} activeOpacity={0.7}>
              <Ionicons name="close-circle" size={26} color={colors.textMuted} />
            </AnimatedPressable>
          </View>

          {selectedSlot && (
            <View style={s.editHint}>
              <Ionicons name="swap-horizontal" size={13} color={colors.gold} />
              <Text style={s.editHintText}>
                <Text style={{ color: colors.gold }}>{getPlayerName(selectedSlot.pid)}</Text>
                {' '}ausgewählt — tippe einen anderen Spieler zum Tauschen
              </Text>
              <AnimatedPressable onPress={() => setSelectedSlot(null)}>
                <Ionicons name="close" size={14} color={colors.textMuted} />
              </AnimatedPressable>
            </View>
          )}

          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            {allEditMatches.map((match) => {
              const cfg = TYPE_CONFIG[match.type] ?? TYPE_CONFIG.MF;
              const teams = [
                { key: 'A', ids: match.teamA },
                { key: 'B', ids: match.teamB },
              ];
              return (
                <View key={match.id} style={s.editMatchCard}>
                  <View style={s.editMatchTop}>
                    <View style={[s.typePill, { borderColor: cfg.color + '60' }]}>
                      <Ionicons name={cfg.icon} size={10} color={cfg.color} />
                      <Text style={[s.typeLabel, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                    <View style={[s.editDgBadge, match.durchgang === 2 && s.editDgBadge2]}>
                      <Text style={[s.editDgText, match.durchgang === 2 && s.editDgText2]}>D{match.durchgang}</Text>
                    </View>
                  </View>
                  <View style={s.editTeamsRow}>
                    {teams.map(({ key, ids }) => (
                      <View key={key} style={s.editTeamCol}>
                        {ids.map((pid, idx) => {
                          const isSelected = selectedSlot?.matchId === match.id && selectedSlot?.team === key && selectedSlot?.idx === idx;
                          return (
                            <AnimatedPressable
                              key={pid}
                              style={[s.editPlayerBtn, isSelected && s.editPlayerBtnSelected]}
                              onPress={() => handleSlotPress(match.id, key, idx, pid)}
                              activeOpacity={0.75}
                            >
                              <Text style={[s.editPlayerName, isSelected && { color: colors.gold }]} numberOfLines={1}>
                                {getPlayerName(pid)}
                              </Text>
                            </AnimatedPressable>
                          );
                        })}
                      </View>
                    ))}
                    <View style={s.editVsBox}>
                      <Text style={s.editVsText}>:</Text>
                    </View>
                  </View>
                </View>
              );
            })}
            <View style={{ height: 16 }} />
          </ScrollView>

          {/* Delete round */}
          <AnimatedPressable style={s.deleteRoundBtn} onPress={() => setConfirmDelete(true)} activeOpacity={0.8}>
            <Ionicons name="trash-outline" size={15} color={colors.error} />
            <Text style={s.deleteRoundText}>Runde {currentRound} löschen</Text>
          </AnimatedPressable>
        </View>

        {/* Swap confirmation */}
        {pendingSwap && (
          <Modal visible transparent animationType="fade">
            <View style={s.modalOverlay}>
              <View style={s.modalCard}>
                <Text style={s.modalTitle}>Spieler tauschen?</Text>
                <Text style={s.modalBody}>
                  <Text style={{ color: colors.gold }}>{getPlayerName(pendingSwap.slot1.pid)}</Text>
                  {' '}und{' '}
                  <Text style={{ color: colors.gold }}>{getPlayerName(pendingSwap.slot2.pid)}</Text>
                  {'\n'}werden in der Auslosung getauscht.
                </Text>
                <View style={s.modalButtons}>
                  <AnimatedPressable style={s.modalBtnCancel} onPress={() => setPendingSwap(null)} activeOpacity={0.8}>
                    <Text style={s.modalBtnCancelText}>Abbrechen</Text>
                  </AnimatedPressable>
                  <AnimatedPressable style={s.modalBtnRed} onPress={confirmSwap} activeOpacity={0.8}>
                    <Ionicons name="swap-horizontal" size={13} color={colors.white} style={{ marginRight: 5 }} />
                    <Text style={s.modalBtnRedText}>Tauschen</Text>
                  </AnimatedPressable>
                </View>
              </View>
            </View>
          </Modal>
        )}

        {/* Delete confirmation */}
        {confirmDelete && (
          <Modal visible transparent animationType="fade">
            <View style={s.modalOverlay}>
              <View style={s.modalCard}>
                <Text style={s.modalTitle}>Runde löschen?</Text>
                <Text style={s.modalBody}>
                  Runde {currentRound} wird unwiderruflich gelöscht.{'\n'}Alle Paarungen und Ergebnisse gehen verloren.
                </Text>
                <View style={s.modalButtons}>
                  <AnimatedPressable style={s.modalBtnCancel} onPress={() => setConfirmDelete(false)} activeOpacity={0.8}>
                    <Text style={s.modalBtnCancelText}>Abbrechen</Text>
                  </AnimatedPressable>
                  <AnimatedPressable style={s.modalBtnRed} onPress={confirmDeleteRound} activeOpacity={0.8}>
                    <Ionicons name="trash" size={13} color={colors.white} style={{ marginRight: 5 }} />
                    <Text style={s.modalBtnRedText}>Löschen</Text>
                  </AnimatedPressable>
                </View>
              </View>
            </View>
          </Modal>
        )}
      </Modal>

      {/* ── Start/Confirm Modal ── */}
      <Modal visible={showConfirm} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Neue Runde starten?</Text>
            <Text style={s.modalBody}>
              Runde {currentRound + 1} wird jetzt ausgelost.{'\n'}Diese Aktion kann nicht rückgängig gemacht werden.
            </Text>
            <View style={s.modalButtons}>
              <AnimatedPressable style={s.modalBtnCancel} onPress={() => setShowConfirm(false)} activeOpacity={0.8}>
                <Text style={s.modalBtnCancelText}>Abbrechen</Text>
              </AnimatedPressable>
              <AnimatedPressable style={s.modalBtnConfirm} onPress={handleConfirmStart} activeOpacity={0.8}>
                <Ionicons name="play" size={13} color={colors.bg} style={{ marginRight: 5 }} />
                <Text style={s.modalBtnConfirmText}>Starten</Text>
              </AnimatedPressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.logoText}>☽ MOONLIGHT CUP</Text>
          <Text style={s.logoSub}>Badminton Turniermanager</Text>
        </View>
        {currentRound > 0 && (
          <View style={s.headerBtnGroup}>
            <AnimatedPressable style={s.editRoundBtn} onPress={() => setRoundsMenuOpen(true)}>
              <Ionicons name="layers-outline" size={12} color={colors.silver} />
              <Text style={s.editRoundBtnText}>Runden</Text>
            </AnimatedPressable>
            <AnimatedPressable style={s.editRoundBtn} onPress={() => setEditOpen(true)}>
              <Ionicons name="create-outline" size={12} color={colors.silver} />
              <Text style={s.editRoundBtnText}>Bearbeiten</Text>
            </AnimatedPressable>
            <AnimatedPressable style={s.editRoundBtn} onPress={() => doPrintBoth(round)}>
              <Ionicons name="print-outline" size={12} color={colors.silver} />
              <Text style={s.editRoundBtnText}>Drucken</Text>
            </AnimatedPressable>
          </View>
        )}
        <View style={{ flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
          {currentRound > 0 && (round?.isFinalRunde ? (
            <View style={s.finalPill}>
              <Ionicons name="trophy" size={10} color={colors.gold} />
              <Text style={s.finalPillText}>FINALE</Text>
            </View>
          ) : isSchnellrunde ? (
            <View style={s.schnellPill}>
              <Ionicons name="flash" size={10} color={colors.warning} />
              <Text style={s.schnellPillText}>SCHNELL</Text>
            </View>
          ) : (
            <View style={s.normalPill}>
              <Ionicons name="shield-checkmark" size={10} color={colors.success} />
              <Text style={s.normalPillText}>NORMAL</Text>
            </View>
          ))}
          {currentRound > 0 && (
            <View style={s.roundPill}>
              <Text style={s.roundPillText}>RUNDE {currentRound}</Text>
            </View>
          )}
          {currentRound > 0 && (
            <View style={[s.durchgangPill, durchgang === 2 && s.durchgangPill2]}>
              <Ionicons name={durchgang === 1 ? 'layers-outline' : 'layers'} size={10} color={durchgang === 1 ? colors.info : colors.gold} />
              <Text style={[s.durchgangPillText, durchgang === 2 && s.durchgangPillText2]}>D{durchgang}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Banner when viewing a past round */}
      {viewingRoundId && (
        <AnimatedPressable
          style={s.viewingBanner}
          onPress={() => setViewingRoundId(null)}
          activeOpacity={0.8}
        >
          <Ionicons name="eye-outline" size={13} color={colors.info} />
          <Text style={s.viewingBannerText}>Ansicht: Runde {viewingRoundId}</Text>
          <Text style={s.viewingBannerBack}>← Aktuelle Runde</Text>
        </AnimatedPressable>
      )}

      {displayRound ? (
        <>
          {/* Stats row */}
          <View style={s.statsRow}>
            <View style={s.statBox}>
              <Text style={s.statNum}>{visibleMatches.length}</Text>
              <Text style={s.statLbl}>{viewingRoundId ? 'Spiele' : `Spiele D${durchgang}`}</Text>
            </View>
            <View style={[s.statBox, s.statBoxMid]}>
              <Text style={[s.statNum, { color: colors.success }]}>{doneCount}</Text>
              <Text style={s.statLbl}>Fertig</Text>
            </View>
            <View style={s.statBox}>
              <Text style={[s.statNum, pendingCount > 0 && { color: colors.warning }]}>{pendingCount}</Text>
              <Text style={s.statLbl}>Offen</Text>
            </View>
          </View>

          {displayRound.sittingOut?.length > 0 && (
            <View style={s.sittingBanner}>
              <Ionicons name="pause-circle-outline" size={14} color={colors.warning} />
              <Text style={s.sittingText}>
                Freilos: {displayRound.sittingOut.map(getName).join(', ')}
              </Text>
            </View>
          )}

          <Text style={shared.sectionLabel}>
            {viewingRoundId ? `PAARUNGEN — RUNDE ${viewingRoundId}` : `PAARUNGEN — DURCHGANG ${durchgang}`}
          </Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            {visibleMatches.map((match, idx) => {
              const cfg = TYPE_CONFIG[match.type] ?? TYPE_CONFIG.MF;
              // DG-Trenner beim Blättern in vergangenen Runden
              const prevMatch = visibleMatches[idx - 1];
              const showDgHeader = viewingRoundId && (idx === 0 || match.durchgang !== prevMatch?.durchgang);
              return (
                <View key={match.id}>
                {showDgHeader && (
                  <Text style={[shared.sectionLabel, { marginTop: idx > 0 ? 12 : 0 }]}>DURCHGANG {match.durchgang}</Text>
                )}
                <View style={[s.matchCard, match.done && s.matchCardDone]}>
                  {/* Top accent line — type color */}
                  <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: match.done ? colors.success : cfg.color, opacity: 0.7, borderTopLeftRadius: 14, borderTopRightRadius: 14 }} />
                  <View style={s.matchCardHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={[s.typePill, { borderColor: cfg.color + '60' }]}>
                        <Ionicons name={cfg.icon} size={10} color={cfg.color} />
                        <Text style={[s.typeLabel, { color: cfg.color }]}>{cfg.label}</Text>
                      </View>
                      {match.feld != null && (
                        <View style={s.feldPill}>
                          <Text style={s.feldText}>Feld {match.feld}</Text>
                        </View>
                      )}
                    </View>
                    {match.done ? (
                      <View style={s.doneBadge}>
                        <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                        <Text style={s.doneText}>Fertig</Text>
                      </View>
                    ) : (
                      <View style={s.pendingBadge}>
                        <Text style={s.pendingText}>Ausstehend</Text>
                      </View>
                    )}
                  </View>

                  <View style={s.teamsRow}>
                    <Text style={s.teamA} numberOfLines={1}>{getTeam(match.teamA)}</Text>
                    <View style={s.vsBox}>
                      {match.done ? (
                        <Text style={s.scoreText}>{match.scoreA} – {match.scoreB}</Text>
                      ) : (
                        <Text style={s.vsText}>:</Text>
                      )}
                    </View>
                    <Text style={s.teamB} numberOfLines={1}>{getTeam(match.teamB)}</Text>
                  </View>
                </View>
                </View>
              );
            })}
            <View style={{ height: 24 }} />
          </ScrollView>
        </>
      ) : (
        <View style={s.emptyState}>
          <View style={s.emptyIcon}>
            <BadmintonRacketIcon size={44} color={colors.gold} />
          </View>
          <Text style={s.emptyTitle}>Noch keine Runde</Text>
          <Text style={s.emptyHint}>Tippe unten auf "Neue Runde starten" um die Auslosung zu beginnen.</Text>
        </View>
      )}

      <Modal visible={showConfirm} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Neue Runde starten?</Text>
            <Text style={s.modalBody}>
              Runde {currentRound + 1} wird jetzt ausgelost.{'\n'}Diese Aktion kann nicht rückgängig gemacht werden.
            </Text>
            <View style={s.modalButtons}>
              <AnimatedPressable style={s.modalBtnCancel} onPress={() => setShowConfirm(false)} activeOpacity={0.8}>
                <Text style={s.modalBtnCancelText}>Abbrechen</Text>
              </AnimatedPressable>
              <AnimatedPressable style={s.modalBtnConfirm} onPress={handleConfirmStart} activeOpacity={0.8}>
                <Ionicons name="play" size={13} color={colors.bg} style={{ marginRight: 5 }} />
                <Text style={s.modalBtnConfirmText}>Starten</Text>
              </AnimatedPressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Druckvorschau Modal ── */}
      <Modal visible={!!printPreview} animationType="slide" transparent={false}>
        {printPreview && (
          <View style={s.previewScreen}>
            <View style={s.previewHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.previewTitle}>☽ Moonlight Cup — Runde {printPreview.id}</Text>
                <Text style={s.previewSub}>
                  {previewDg === 1 ? 'Schritt 1/2 — Durchgang 1 drucken' : previewDg === 2 ? 'Schritt 2/2 — Durchgang 2 drucken' : 'Wähle einen Durchgang'}
                </Text>
              </View>
              <AnimatedPressable onPress={() => { setPrintPreview(null); setPreviewDg(null); }} activeOpacity={0.7}>
                <Ionicons name="close-circle" size={26} color="#999" />
              </AnimatedPressable>
            </View>

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {[1, 2].map((dg) => {
                if (previewDg && previewDg !== dg) return null; // zeige nur gewählten DG
                const dgMatches = [...printPreview.matches.filter((m) => m.durchgang === dg)]
                  .sort((a, b) => (a.feld ?? 0) - (b.feld ?? 0));
                if (!dgMatches.length) return null;
                return (
                  <View key={dg}>
                    <View style={[s.previewDgHeader, previewDg === dg && { backgroundColor: '#2a5298' }]}>
                      <Text style={s.previewDgLabel}>DURCHGANG {dg}</Text>
                    </View>
                    {dgMatches.map((m, i) => {
                      const cfg = TYPE_CONFIG[m.type] ?? TYPE_CONFIG.MF;
                      return (
                        <View key={m.id} style={[s.previewRow, i % 2 === 0 && s.previewRowAlt]}>
                          {m.feld != null && (
                            <Text style={s.previewFeld}>Feld {m.feld}</Text>
                          )}
                          <Text style={[s.previewType, { color: cfg.color }]}>{cfg.label}</Text>
                          <Text style={s.previewTeam} numberOfLines={1}>{getTeam(m.teamA)}</Text>
                          <Text style={s.previewVs}>vs</Text>
                          <Text style={[s.previewTeam, { textAlign: 'right' }]} numberOfLines={1}>{getTeam(m.teamB)}</Text>
                        </View>
                      );
                    })}
                  </View>
                );
              })}
              {previewDg === 2 && printPreview.sittingOut?.length > 0 && (
                <Text style={s.previewSitOut}>Freilos: {printPreview.sittingOut.map(getName).join(', ')}</Text>
              )}
              <View style={{ height: 20 }} />
            </ScrollView>

            {/* Buttons: ohne Auswahl → D1/D2 wählen; mit Auswahl → Drucken/Zurück */}
            <View style={s.previewActions}>
              {!previewDg ? (
                <>
                  <AnimatedPressable style={[s.previewBtnShare, { flex: 1 }]} onPress={() => doPrintBoth(printPreview)} activeOpacity={0.8}>
                    <Ionicons name="print-outline" size={15} color="#1a1a2e" />
                    <Text style={[s.previewBtnShareText, { color: '#1a1a2e', fontWeight: '800' }]}>Beide auf einmal</Text>
                  </AnimatedPressable>
                  <AnimatedPressable style={s.previewBtnPrint} onPress={() => setPreviewDg(1)} activeOpacity={0.8}>
                    <Ionicons name="print-outline" size={15} color="#fff" />
                    <Text style={s.previewBtnPrintText}>D1 drucken</Text>
                  </AnimatedPressable>
                  <AnimatedPressable style={s.previewBtnPrint} onPress={() => setPreviewDg(2)} activeOpacity={0.8}>
                    <Ionicons name="print-outline" size={15} color="#fff" />
                    <Text style={s.previewBtnPrintText}>D2 drucken</Text>
                  </AnimatedPressable>
                </>
              ) : (
                <>
                  <AnimatedPressable style={s.previewBtnShare} onPress={() => setPreviewDg(null)} activeOpacity={0.8}>
                    <Ionicons name="arrow-back" size={15} color="#555" />
                    <Text style={s.previewBtnShareText}>Zurück</Text>
                  </AnimatedPressable>
                  <AnimatedPressable style={[s.previewBtnPrint, { flex: 2 }]} onPress={doPrint} activeOpacity={0.8}>
                    <Ionicons name="print-outline" size={15} color="#fff" />
                    <Text style={s.previewBtnPrintText}>Durchgang {previewDg} drucken</Text>
                  </AnimatedPressable>
                </>
              )}
            </View>
          </View>
        )}
      </Modal>

      <AnimatedPressable
        style={[shared.goldBtn, !primaryEnabled && shared.disabledBtn]}
        onPress={handlePrimaryPress}
        disabled={!primaryEnabled}
      >
        <View style={s.btnInner}>
          <Ionicons
            name={inD1 ? 'arrow-forward' : 'play'}
            size={14}
            color={primaryEnabled ? colors.bg : colors.textMuted}
            style={{ marginRight: 8 }}
          />
          <Text style={[shared.goldBtnText, !primaryEnabled && shared.disabledBtnText]}>
            {primaryLabel}
          </Text>
        </View>
      </AnimatedPressable>

      {/* Sieger drucken — sichtbar wenn Finale abgeschlossen */}
      {isFinalRunde && allDone && (
        <AnimatedPressable style={s.siegerBtn} onPress={printSieger}>
          <View style={s.btnInner}>
            <Ionicons name="print-outline" size={14} color={colors.gold} style={{ marginRight: 8 }} />
            <Text style={s.finalBtnText}>SIEGER DRUCKEN</Text>
          </View>
        </AnimatedPressable>
      )}

      {/* Finale starten — nur sichtbar wenn mind. 1 Runde gespielt, nicht bereits in Finale und keine Schnellrunde aktiv */}
      {currentRound > 0 && !round?.isFinalRunde && !isSchnellrunde && (
        <AnimatedPressable
          style={s.finalBtn}
          onPress={() => setShowFinalConfirm(true)}
        >
          <View style={s.btnInner}>
            <Ionicons name="trophy" size={14} color={colors.gold} style={{ marginRight: 8 }} />
            <Text style={s.finalBtnText}>FINALE AUSLOSUNG</Text>
          </View>
        </AnimatedPressable>
      )}

      {/* Turnier neu starten */}
      {currentRound > 0 && (
        <AnimatedPressable style={s.resetBtn} onPress={() => setShowResetConfirm(true)}>
          <View style={s.btnInner}>
            <Ionicons name="refresh-outline" size={14} color={colors.error} style={{ marginRight: 8 }} />
            <Text style={s.resetBtnText}>TURNIER NEU STARTEN</Text>
          </View>
        </AnimatedPressable>
      )}

      {/* Bestätigung Turnier-Reset */}
      <Modal visible={showResetConfirm} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Ionicons name="refresh-outline" size={20} color={colors.error} />
              <Text style={s.modalTitle}>Turnier neu starten?</Text>
            </View>
            <Text style={s.modalBody}>
              Alle Runden und Ergebnisse werden unwiderruflich gelöscht.{'\n'}
              Die Rangliste wird zurückgesetzt.{'\n\n'}
              Die Teilnehmerliste bleibt erhalten.
            </Text>
            <View style={s.modalButtons}>
              <AnimatedPressable style={s.modalBtnCancel} onPress={() => setShowResetConfirm(false)} activeOpacity={0.8}>
                <Text style={s.modalBtnCancelText}>Abbrechen</Text>
              </AnimatedPressable>
              <AnimatedPressable
                style={s.modalBtnRed}
                onPress={() => { setShowResetConfirm(false); resetTournament(); }}
                activeOpacity={0.8}
              >
                <Ionicons name="refresh" size={13} color={colors.white} style={{ marginRight: 5 }} />
                <Text style={s.modalBtnRedText}>Neu starten</Text>
              </AnimatedPressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Bestätigung Finale */}
      <Modal visible={showFinalConfirm} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Ionicons name="trophy" size={20} color={colors.gold} />
              <Text style={s.modalTitle}>Finale starten?</Text>
            </View>
            <Text style={s.modalBody}>
              Die Finale-Auslosung verwendet Gruppen von je 4 Spielern:{'\n'}
              Platz 1+4 vs 2+3, Platz 5+8 vs 6+7 usw.{'\n\n'}
              Diese Aktion kann nicht rückgängig gemacht werden.
            </Text>
            <View style={s.modalButtons}>
              <AnimatedPressable style={s.modalBtnCancel} onPress={() => setShowFinalConfirm(false)} activeOpacity={0.8}>
                <Text style={s.modalBtnCancelText}>Abbrechen</Text>
              </AnimatedPressable>
              <AnimatedPressable
                style={s.modalBtnFinal}
                onPress={() => { setShowFinalConfirm(false); startFinalRunde(); }}
                activeOpacity={0.8}
              >
                <Ionicons name="trophy" size={13} color={colors.bg} style={{ marginRight: 5 }} />
                <Text style={s.modalBtnConfirmText}>Finale starten</Text>
              </AnimatedPressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  logoText: {
    color: colors.silver,
    fontSize: 16,
    fontFamily: fonts.heading,
    letterSpacing: 3,
  },
  logoSub: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: fonts.body,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  roundPill: {
    backgroundColor: colors.goldGlow,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderGoldGlow,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  roundPillText: {
    color: colors.gold,
    fontSize: 11,
    fontFamily: fonts.headingSemi,
    letterSpacing: 1.5,
  },
  finalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.goldGlow,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderGoldGlow,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  finalPillText: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  siegerBtn: {
    marginTop: 10,
    backgroundColor: colors.goldGlow,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: colors.gold,
    alignItems: 'center',
  },
  finalBtn: {
    marginTop: 10,
    backgroundColor: colors.goldGlow,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: colors.borderGoldGlow,
    alignItems: 'center',
  },
  finalBtnText: {
    color: colors.gold,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
  },
  resetBtn: {
    marginTop: 10,
    backgroundColor: 'rgba(220,50,50,0.08)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(220,50,50,0.25)',
    alignItems: 'center',
  },
  resetBtnText: {
    color: colors.error,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
  },
  modalBtnFinal: {
    flex: 1,
    backgroundColor: colors.gold,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  schnellPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.warning + '18',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.warning + '40',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  schnellPillText: {
    color: colors.warning,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  normalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.success + '18',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.success + '40',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  normalPillText: {
    color: colors.success,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  durchgangPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.info + '18',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.info + '40',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  durchgangPill2: {
    backgroundColor: colors.goldGlow,
    borderColor: colors.borderGoldGlow,
  },
  durchgangPillText: {
    color: colors.info,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  durchgangPillText2: {
    color: colors.gold,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.panel,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    ...cardShadow,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
  },
  statBoxMid: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
  },
  statNum: {
    color: colors.gold,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statLbl: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  sittingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.warning + '15',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.warning + '30',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  sittingText: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  matchCard: {
    backgroundColor: colors.panel,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
    marginBottom: 8,
    overflow: 'hidden',
    ...cardShadow,
  },
  matchCardDone: {
    borderColor: colors.success + '35',
    backgroundColor: colors.panel,
  },
  matchCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  typeLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  doneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  doneText: {
    color: colors.success,
    fontSize: 11,
    fontFamily: fonts.bodySemi,
  },
  pendingBadge: {},
  pendingText: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: fonts.body,
  },
  feldPill: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  feldText: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: fonts.headingSemi,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  teamA: {
    flex: 1,
    color: colors.white,
    fontSize: 14,
    fontFamily: fonts.bodySemi,
  },
  teamB: {
    flex: 1,
    color: colors.white,
    fontSize: 14,
    fontFamily: fonts.bodySemi,
    textAlign: 'right',
  },
  vsBox: {
    minWidth: 80,
    alignItems: 'center',
  },
  vsText: {
    color: colors.textDim,
    fontSize: 10,
    fontFamily: fonts.headingSemi,
    letterSpacing: 1,
  },
  scoreText: {
    color: colors.gold,
    fontSize: 34,
    fontFamily: fonts.heading,
    letterSpacing: 0,
    lineHeight: 36,
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
    backgroundColor: colors.panelLight,
    borderWidth: 1,
    borderColor: colors.borderStrong,
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
    lineHeight: 20,
    paddingHorizontal: 24,
  },
  btnInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.panelLight,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderGoldGlow,
    padding: 24,
    ...cardShadow,
  },
  modalTitle: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  modalBody: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  modalBtnCancel: {
    flex: 1,
    backgroundColor: colors.panel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalBtnCancelText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  modalBtnConfirm: {
    flex: 1,
    backgroundColor: colors.gold,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnConfirmText: {
    color: colors.bg,
    fontSize: 13,
    fontWeight: '800',
  },
  modalBtnRed: {
    flex: 1,
    backgroundColor: colors.error,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnRedText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '800',
  },

  viewingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.info + '15',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.info + '35',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  viewingBannerText: {
    color: colors.info,
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  viewingBannerBack: {
    color: colors.info + 'BB',
    fontSize: 11,
    fontWeight: '600',
  },
  roundRowViewing: {
    borderColor: colors.info + '50',
    backgroundColor: colors.info + '10',
  },
  viewingBadge: {
    backgroundColor: colors.info,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  viewingBadgeText: {
    color: colors.white,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
  },

  headerBtnGroup: {
    flexDirection: 'row',
    gap: 6,
  },

  // Runden menu
  roundsMenuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  roundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  roundRowCurrent: {
    borderColor: colors.borderGoldGlow,
    backgroundColor: colors.goldGlow,
  },
  roundRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  roundRowTitle: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '800',
  },
  currentBadge: {
    backgroundColor: colors.gold,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  currentBadgeText: {
    color: colors.bg,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
  },
  roundRowMeta: {
    color: colors.textMuted,
    fontSize: 11,
  },
  roundDeleteBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: colors.error + '12',
    borderWidth: 1,
    borderColor: colors.error + '30',
  },

  // Edit round button
  editRoundBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.panel,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  editRoundBtnText: {
    color: colors.silver,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Edit modal screen
  editScreen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  editTitle: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  editHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.goldGlow,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderGoldGlow,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
    flex: 0,
  },
  editHintText: {
    color: colors.textMuted,
    fontSize: 12,
    flex: 1,
    lineHeight: 17,
  },
  editMatchCard: {
    backgroundColor: colors.panel,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 8,
    ...cardShadow,
  },
  editMatchTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  editDgBadge: {
    backgroundColor: colors.info + '18',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.info + '40',
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  editDgBadge2: {
    backgroundColor: colors.goldGlow,
    borderColor: colors.borderGoldGlow,
  },
  editDgText: {
    color: colors.info,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  editDgText2: {
    color: colors.gold,
  },
  editTeamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editTeamCol: {
    flex: 1,
    gap: 4,
  },
  editVsBox: {
    width: 28,
    alignItems: 'center',
  },
  editVsText: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  editPlayerBtn: {
    backgroundColor: colors.panelLight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  editPlayerBtnSelected: {
    backgroundColor: colors.goldGlow,
    borderColor: colors.borderGoldGlow,
  },
  editPlayerName: {
    color: colors.silver,
    fontSize: 12,
    fontWeight: '600',
  },
  deleteRoundBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.error + '12',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.error + '40',
    paddingVertical: 14,
    marginTop: 8,
  },
  deleteRoundText: {
    color: colors.error,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Print preview
  previewScreen: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111',
  },
  previewSub: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  previewDgHeader: {
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 10,
    marginBottom: 2,
    borderRadius: 6,
  },
  previewDgLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 6,
  },
  previewRowAlt: {
    backgroundColor: '#f9f9f9',
  },
  previewFeld: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1a1a2e',
    width: 46,
  },
  previewType: {
    fontSize: 10,
    fontWeight: '700',
    width: 72,
  },
  previewTeam: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#111',
  },
  previewVs: {
    fontSize: 11,
    color: '#aaa',
    fontWeight: '600',
    width: 22,
    textAlign: 'center',
  },
  previewSitOut: {
    marginTop: 14,
    fontSize: 12,
    color: '#888',
    paddingHorizontal: 8,
  },
  previewActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  previewBtnPrint: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    paddingVertical: 14,
  },
  previewBtnPrintText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  previewBtnShare: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    paddingVertical: 14,
  },
  previewBtnShareText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '700',
  },
});
