import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, Share } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import { colors } from '../theme/colors';
import { shared, cardShadow } from '../theme/styles';
import { useTournament } from '../store/tournament';

const TYPE_CONFIG = {
  MM: { label: 'HERRENDOPPEL', icon: 'man',       color: colors.info },
  FF: { label: 'DAMENDOPPEL',  icon: 'woman',     color: '#E879A0' },
  MF: { label: 'MIXED',        icon: 'swap-horizontal', color: colors.gold },
};

export default function RundeScreen() {
  const {
    getCurrentRoundData, currentRound, rounds, allMatchesDone, startNewRound,
    participants, advanceDurchgang, currentDurchgangDone,
    deleteCurrentRound, deleteRound, swapMatchPlayers,
    triggerAutoTimer,
  } = useTournament();
  const [showConfirm, setShowConfirm] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [pendingSwap, setPendingSwap] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [roundsMenuOpen, setRoundsMenuOpen] = useState(false);
  const [roundToDelete, setRoundToDelete] = useState(null);  // round object
  const [printMenuOpen, setPrintMenuOpen] = useState(false);
  const [printPreview, setPrintPreview] = useState(null); // round object to preview
  const [previewDg, setPreviewDg] = useState(null);      // null = beide, 1 = nur D1, 2 = nur D2
  const prevRoundRef = useRef(0);
  const round = getCurrentRoundData();
  const isSchnellrunde = round?.isSchnellrunde ?? false;
  const durchgang = round?.currentDurchgang ?? 1;

  const getName = (id) => {
    const p = participants.find((x) => x.id === id);
    if (!p) return '?';
    const parts = p.name.split(','); const first = parts.length > 1 ? `${parts[1].trim()} ${parts[0].trim()}` : p.name.trim();
    return p.league ? `${first} [${p.league}]` : first;
  };
  const getTeam = (ids) => ids.map(getName).join(' & ');

  // Nur Matches des aktuellen Durchgangs anzeigen, nach Feld sortiert (Feld 1 zuerst)
  const visibleMatches = (round?.matches?.filter((m) => m.durchgang === durchgang) ?? [])
    .sort((a, b) => (a.feld ?? 0) - (b.feld ?? 0));
  const pendingCount = visibleMatches.filter((m) => !m.done).length;
  const doneCount = visibleMatches.filter((m) => m.done).length;

  const d1Done = currentDurchgangDone();
  const allDone = allMatchesDone();

  // Primäre Aktion: In D1 → "Durchgang 2 starten"; in D2 → "Neue Runde starten"
  const inD1 = round && durchgang === 1;
  const primaryLabel = !round ? 'NEUE RUNDE STARTEN' : inD1 ? 'DURCHGANG 2 STARTEN' : 'NEUE RUNDE STARTEN';
  const primaryEnabled = !round || (inD1 ? d1Done : allDone);

  const handlePrimaryPress = () => {
    if (!round || !inD1) {
      setShowConfirm(true);
    } else {
      advanceDurchgang();
      triggerAutoTimer(2);
    }
  };

  const handleConfirmStart = () => {
    setShowConfirm(false);
    startNewRound();
  };

  // Auto-open print preview with D1 pre-selected when a new round starts
  useEffect(() => {
    if (currentRound > prevRoundRef.current) {
      prevRoundRef.current = currentRound;
      const newRound = rounds.find((r) => r.id === currentRound);
      if (newRound) {
        setPrintPreview(newRound);
        setPreviewDg(1); // start directly on D1
      }
    }
  }, [currentRound, rounds]);

  const TYPE_LABELS = { MM: 'Herrendoppel', FF: 'Damendoppel', MF: 'Mixed' };

  const buildPageHtml = (r, dg) => {
    const matches = [...r.matches.filter((m) => m.durchgang === dg)]
      .sort((a, b) => (a.feld ?? 0) - (b.feld ?? 0));
    const sitOut = dg === 2 && r.sittingOut?.length > 0
      ? `<p style="margin-top:14px;font-size:12px;color:#888"><b>Freilos:</b> ${r.sittingOut.map(getName).join(', ')}</p>` : '';
    const rows = matches.map((m, i) => `
      <tr style="background:${i % 2 === 0 ? '#f5f5f5' : '#fff'}">
        <td style="padding:9px 10px;font-size:12px;font-weight:800;color:#1a1a2e;white-space:nowrap;text-align:center">${m.feld != null ? `Feld ${m.feld}` : ''}</td>
        <td style="padding:9px 12px;font-size:11px;color:#555;font-weight:700;white-space:nowrap">${TYPE_LABELS[m.type] ?? m.type}</td>
        <td style="padding:9px 12px;font-size:14px;font-weight:700">${m.teamA.map(getName).join(' &amp; ')}</td>
        <td style="padding:9px 8px;text-align:center;color:#bbb;font-size:12px;font-weight:700">VS</td>
        <td style="padding:9px 12px;font-size:14px;font-weight:700">${m.teamB.map(getName).join(' &amp; ')}</td>
      </tr>`).join('');
    return `<html><body style="font-family:Arial,sans-serif;padding:28px 32px;color:#222;margin:0">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:6px">
        <div>
          <div style="font-size:20px;font-weight:800">☽ Moonlight Cup — Runde ${r.id}</div>
          <div style="font-size:12px;color:#666;margin-top:2px">${r.isSchnellrunde ? 'Schnellrunde' : 'Normale Runde'}</div>
        </div>
        <div style="background:#1a1a2e;color:#fff;padding:6px 14px;border-radius:6px;font-size:13px;font-weight:800;letter-spacing:1px">DURCHGANG ${dg}</div>
      </div>
      <hr style="border:none;border-top:2px solid #1a1a2e;margin:10px 0 16px"/>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead>
          <tr style="background:#1a1a2e;color:#fff">
            <th style="padding:8px 10px;text-align:center;font-size:10px;letter-spacing:1px;width:36px">FELD</th>
            <th style="padding:8px 12px;text-align:left;font-size:10px;letter-spacing:1px">TYP</th>
            <th style="padding:8px 12px;text-align:left">TEAM A</th>
            <th style="padding:8px 8px;width:36px"></th>
            <th style="padding:8px 12px;text-align:left">TEAM B</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      ${sitOut}
    </body></html>`;
  };

  // Try printing both Durchgänge in one job via HTML rendering
  const doPrintBoth = async (r) => {
    const d1html = buildPageHtml(r, 1);
    const d2html = buildPageHtml(r, 2);
    const html = `<html><head><style>
      @page{margin:0} body{margin:0}
      .pg{page-break-after:always;break-after:page}
      .last{page-break-after:auto;break-after:auto}
    </style></head><body>
      <div class="pg">${d1html.replace(/<\/?html>|<\/?body[^>]*>/g,'')}</div>
      <div class="last">${d2html.replace(/<\/?html>|<\/?body[^>]*>/g,'')}</div>
    </body></html>`;
    try {
      await Print.printAsync({ html });
      setPrintPreview(null);
      setPreviewDg(null);
    } catch (_) {}
  };

  // expo-print captures the current screen — preview shows only one Durchgang,
  // then print captures it. After D1 print auto-advances to D2.
  const doPrint = async () => {
    try {
      await Print.printAsync({ html: buildPageHtml(printPreview, previewDg) });
      if (previewDg === 1) {
        triggerAutoTimer(1);
        setPreviewDg(2);
      } else {
        setPreviewDg(null);
        setPrintPreview(null);
      }
    } catch (_) {}
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
    setPrintPreview(r);
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
    <View style={shared.screen}>

      {/* ── Runden-Übersicht Modal ── */}
      <Modal visible={roundsMenuOpen} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={[s.modalCard, { maxHeight: '80%' }]}>
            <View style={s.roundsMenuHeader}>
              <Text style={s.modalTitle}>Alle Runden</Text>
              <TouchableOpacity onPress={() => setRoundsMenuOpen(false)} activeOpacity={0.7}>
                <Ionicons name="close-circle" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            {rounds.length === 0 ? (
              <Text style={[s.modalBody, { marginBottom: 0 }]}>Noch keine Runden gespielt.</Text>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {[...rounds].reverse().map((r) => {
                  const total = r.matches?.length ?? 0;
                  const done = r.matches?.filter((m) => m.done).length ?? 0;
                  const isCurrent = r.id === currentRound;
                  return (
                    <View key={r.id} style={[s.roundRow, isCurrent && s.roundRowCurrent]}>
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
                        <Text style={s.roundRowMeta}>{total} Spiele · {done} fertig · {total - done} offen</Text>
                      </View>
                      <TouchableOpacity
                        style={s.roundDeleteBtn}
                        onPress={() => setRoundToDelete(r)}
                        activeOpacity={0.75}
                      >
                        <Ionicons name="trash-outline" size={16} color={colors.error} />
                      </TouchableOpacity>
                    </View>
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
                  <TouchableOpacity style={s.modalBtnCancel} onPress={() => setRoundToDelete(null)} activeOpacity={0.8}>
                    <Text style={s.modalBtnCancelText}>Abbrechen</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
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
                  </TouchableOpacity>
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
              <TouchableOpacity onPress={() => setPrintMenuOpen(false)} activeOpacity={0.7}>
                <Ionicons name="close-circle" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            {rounds.length === 0 ? (
              <Text style={[s.modalBody, { marginBottom: 0 }]}>Noch keine Runden gespielt.</Text>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {[...rounds].reverse().map((r) => {
                  const total = r.matches?.length ?? 0;
                  const isCurrent = r.id === currentRound;
                  return (
                    <TouchableOpacity
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
                    </TouchableOpacity>
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
            <TouchableOpacity onPress={() => { setEditOpen(false); setSelectedSlot(null); }} activeOpacity={0.7}>
              <Ionicons name="close-circle" size={26} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {selectedSlot && (
            <View style={s.editHint}>
              <Ionicons name="swap-horizontal" size={13} color={colors.gold} />
              <Text style={s.editHintText}>
                <Text style={{ color: colors.gold }}>{getPlayerName(selectedSlot.pid)}</Text>
                {' '}ausgewählt — tippe einen anderen Spieler zum Tauschen
              </Text>
              <TouchableOpacity onPress={() => setSelectedSlot(null)}>
                <Ionicons name="close" size={14} color={colors.textMuted} />
              </TouchableOpacity>
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
                            <TouchableOpacity
                              key={pid}
                              style={[s.editPlayerBtn, isSelected && s.editPlayerBtnSelected]}
                              onPress={() => handleSlotPress(match.id, key, idx, pid)}
                              activeOpacity={0.75}
                            >
                              <Text style={[s.editPlayerName, isSelected && { color: colors.gold }]} numberOfLines={1}>
                                {getPlayerName(pid)}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    ))}
                    <View style={s.editVsBox}>
                      <Text style={s.editVsText}>VS</Text>
                    </View>
                  </View>
                </View>
              );
            })}
            <View style={{ height: 16 }} />
          </ScrollView>

          {/* Delete round */}
          <TouchableOpacity style={s.deleteRoundBtn} onPress={() => setConfirmDelete(true)} activeOpacity={0.8}>
            <Ionicons name="trash-outline" size={15} color={colors.error} />
            <Text style={s.deleteRoundText}>Runde {currentRound} löschen</Text>
          </TouchableOpacity>
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
                  <TouchableOpacity style={s.modalBtnCancel} onPress={() => setPendingSwap(null)} activeOpacity={0.8}>
                    <Text style={s.modalBtnCancelText}>Abbrechen</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.modalBtnRed} onPress={confirmSwap} activeOpacity={0.8}>
                    <Ionicons name="swap-horizontal" size={13} color={colors.white} style={{ marginRight: 5 }} />
                    <Text style={s.modalBtnRedText}>Tauschen</Text>
                  </TouchableOpacity>
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
                  <TouchableOpacity style={s.modalBtnCancel} onPress={() => setConfirmDelete(false)} activeOpacity={0.8}>
                    <Text style={s.modalBtnCancelText}>Abbrechen</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.modalBtnRed} onPress={confirmDeleteRound} activeOpacity={0.8}>
                    <Ionicons name="trash" size={13} color={colors.white} style={{ marginRight: 5 }} />
                    <Text style={s.modalBtnRedText}>Löschen</Text>
                  </TouchableOpacity>
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
              <TouchableOpacity style={s.modalBtnCancel} onPress={() => setShowConfirm(false)} activeOpacity={0.8}>
                <Text style={s.modalBtnCancelText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalBtnConfirm} onPress={handleConfirmStart} activeOpacity={0.8}>
                <Ionicons name="play" size={13} color={colors.bg} style={{ marginRight: 5 }} />
                <Text style={s.modalBtnConfirmText}>Starten</Text>
              </TouchableOpacity>
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
            <TouchableOpacity style={s.editRoundBtn} onPress={() => setRoundsMenuOpen(true)} activeOpacity={0.75}>
              <Ionicons name="layers-outline" size={12} color={colors.silver} />
              <Text style={s.editRoundBtnText}>Runden</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.editRoundBtn} onPress={() => setEditOpen(true)} activeOpacity={0.75}>
              <Ionicons name="create-outline" size={12} color={colors.silver} />
              <Text style={s.editRoundBtnText}>Bearbeiten</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.editRoundBtn} onPress={() => setPrintMenuOpen(true)} activeOpacity={0.75}>
              <Ionicons name="print-outline" size={12} color={colors.silver} />
              <Text style={s.editRoundBtnText}>Drucken</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={{ flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
          {currentRound > 0 && (isSchnellrunde ? (
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

      {round ? (
        <>
          {/* Stats row */}
          <View style={s.statsRow}>
            <View style={s.statBox}>
              <Text style={s.statNum}>{visibleMatches.length}</Text>
              <Text style={s.statLbl}>Spiele D{durchgang}</Text>
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

          {round.sittingOut?.length > 0 && (
            <View style={s.sittingBanner}>
              <Ionicons name="pause-circle-outline" size={14} color={colors.warning} />
              <Text style={s.sittingText}>
                Freilos: {round.sittingOut.map(getName).join(', ')}
              </Text>
            </View>
          )}

          <Text style={shared.sectionLabel}>PAARUNGEN — DURCHGANG {durchgang}</Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            {visibleMatches.map((match, idx) => {
              const cfg = TYPE_CONFIG[match.type] ?? TYPE_CONFIG.MF;
              return (
                <View key={match.id} style={[s.matchCard, match.done && s.matchCardDone]}>
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
                        <Text style={s.vsText}>VS</Text>
                      )}
                    </View>
                    <Text style={s.teamB} numberOfLines={1}>{getTeam(match.teamB)}</Text>
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
            <Ionicons name="tennisball-outline" size={40} color={colors.gold} />
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
              <TouchableOpacity style={s.modalBtnCancel} onPress={() => setShowConfirm(false)} activeOpacity={0.8}>
                <Text style={s.modalBtnCancelText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalBtnConfirm} onPress={handleConfirmStart} activeOpacity={0.8}>
                <Ionicons name="play" size={13} color={colors.bg} style={{ marginRight: 5 }} />
                <Text style={s.modalBtnConfirmText}>Starten</Text>
              </TouchableOpacity>
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
              <TouchableOpacity onPress={() => { setPrintPreview(null); setPreviewDg(null); }} activeOpacity={0.7}>
                <Ionicons name="close-circle" size={26} color="#999" />
              </TouchableOpacity>
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
                  <TouchableOpacity style={[s.previewBtnShare, { flex: 1 }]} onPress={() => doPrintBoth(printPreview)} activeOpacity={0.8}>
                    <Ionicons name="print-outline" size={15} color="#1a1a2e" />
                    <Text style={[s.previewBtnShareText, { color: '#1a1a2e', fontWeight: '800' }]}>Beide auf einmal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.previewBtnPrint} onPress={() => setPreviewDg(1)} activeOpacity={0.8}>
                    <Ionicons name="print-outline" size={15} color="#fff" />
                    <Text style={s.previewBtnPrintText}>D1 drucken</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.previewBtnPrint} onPress={() => setPreviewDg(2)} activeOpacity={0.8}>
                    <Ionicons name="print-outline" size={15} color="#fff" />
                    <Text style={s.previewBtnPrintText}>D2 drucken</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity style={s.previewBtnShare} onPress={() => setPreviewDg(null)} activeOpacity={0.8}>
                    <Ionicons name="arrow-back" size={15} color="#555" />
                    <Text style={s.previewBtnShareText}>Zurück</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.previewBtnPrint, { flex: 2 }]} onPress={doPrint} activeOpacity={0.8}>
                    <Ionicons name="print-outline" size={15} color="#fff" />
                    <Text style={s.previewBtnPrintText}>Durchgang {previewDg} drucken</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        )}
      </Modal>

      <TouchableOpacity
        style={[shared.goldBtn, !primaryEnabled && shared.disabledBtn]}
        onPress={handlePrimaryPress}
        disabled={!primaryEnabled}
        activeOpacity={0.8}
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
      </TouchableOpacity>
    </View>
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
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 2,
  },
  logoSub: {
    color: colors.textMuted,
    fontSize: 11,
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
    fontWeight: '800',
    letterSpacing: 1.5,
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
    ...cardShadow,
  },
  matchCardDone: {
    borderColor: colors.success + '30',
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
    fontWeight: '600',
  },
  pendingBadge: {},
  pendingText: {
    color: colors.textMuted,
    fontSize: 11,
  },
  feldPill: {
    backgroundColor: colors.goldGlow,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.borderGoldGlow,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  feldText: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  teamA: {
    flex: 1,
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
  teamB: {
    flex: 1,
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
  },
  vsBox: {
    minWidth: 52,
    alignItems: 'center',
  },
  vsText: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  scoreText: {
    color: colors.gold,
    fontSize: 16,
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
