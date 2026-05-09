import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Animated,
  Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { shared, cardShadow, fonts } from '../theme/styles';
import { useTournament } from '../store/tournament';
import AnimatedPressable from '../components/AnimatedPressable';

const TYPE_CONFIG = {
  MM: { label: 'HERRENDOPPEL', color: colors.info },
  FF: { label: 'DAMENDOPPEL',  color: '#E879A0' },
  MF: { label: 'MIXED',        color: colors.gold },
};

export default function ErgebnisseScreen() {
  const { rounds, participants, saveResult, getCurrentRoundData, currentRound } = useTournament();
  const [selectedRound, setSelectedRound] = useState(() => currentRound > 0 ? String(currentRound) : 'all');

  useEffect(() => {
    if (currentRound > 0) setSelectedRound(String(currentRound));
  }, [currentRound]);
  const [editMatch, setEditMatch] = useState(null);
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [errorA, setErrorA] = useState('');
  const [errorB, setErrorB] = useState('');

  const getName = (id) => {
    const p = participants.find((x) => x.id === id);
    if (!p) return '?';
    const parts = p.name.split(','); const first = parts.length > 1 ? `${parts[1].trim()} ${parts[0].trim()}` : p.name.trim();
    return p.league ? `${first} [${p.league}]` : first;
  };
  const getTeam = (ids) => ids.map(getName).join(' & ');

  const allMatches = rounds.flatMap((r) =>
    r.matches.map((m) => ({ ...m, roundId: r.id, isSchnellrunde: r.isSchnellrunde, durchgang: m.durchgang ?? 1 }))
  );
  const filtered = selectedRound === 'all'
    ? allMatches
    : allMatches.filter((m) => m.roundId === Number(selectedRound));

  // Pending first, done at bottom
  // Pending first, done at bottom; within same done-state sort by Feld ascending
  const sortMatches = (arr) => [...arr].sort((a, b) =>
    (a.done ? 1 : 0) - (b.done ? 1 : 0) || (a.feld ?? 0) - (b.feld ?? 0)
  );
  const isRoundView = selectedRound !== 'all';
  const selectedRoundObj = rounds.find((r) => r.id === Number(selectedRound));
  // Wenn die ausgewählte Runde in D2 ist, D1 ausblenden
  const activeDurchgang = selectedRoundObj?.currentDurchgang ?? 1;
  const hideD1 = isRoundView && activeDurchgang === 2;
  const d1 = isRoundView && !hideD1 ? sortMatches(filtered.filter((m) => m.durchgang === 1)) : [];
  const d2 = isRoundView ? sortMatches(filtered.filter((m) => m.durchgang === 2)) : [];

  const isEditSchnellrunde = editMatch?.isSchnellrunde ?? false;
  const maxScore = isEditSchnellrunde ? 21 : 40;

  const validate = (value, setError) => {
    if (value === '') { setError(''); return true; }
    if (!/^\d+$/.test(value)) { setError('Nur Zahlen erlaubt'); return false; }
    if (Number(value) > maxScore) { setError(`Maximal ${maxScore} Punkte`); return false; }
    setError('');
    return true;
  };

  const handleChangeA = (v) => { setScoreA(v); validate(v, setErrorA); };
  const handleChangeB = (v) => { setScoreB(v); validate(v, setErrorB); };

  const isFormValid =
    scoreA !== '' && scoreB !== '' &&
    /^\d+$/.test(scoreA) && /^\d+$/.test(scoreB) &&
    Number(scoreA) <= maxScore && Number(scoreB) <= maxScore;

  const openEdit = (match) => {
    setEditMatch(match);
    setScoreA(match.scoreA?.toString() ?? '');
    setScoreB(match.scoreB?.toString() ?? '');
    setErrorA('');
    setErrorB('');
  };

  const handleSave = () => {
    if (!editMatch || !isFormValid) return;
    saveResult(editMatch.id, Number(scoreA), Number(scoreB));
    setEditMatch(null);
  };

  const doneCount = filtered.filter((m) => m.done).length;

  const renderMatch = (match) => {
    const cfg = TYPE_CONFIG[match.type] ?? TYPE_CONFIG.MF;
    const aWins = match.done && match.winnerTeam === 'A';
    const bWins = match.done && match.winnerTeam === 'B';
    return (
      <AnimatedPressable
        key={match.id}
        style={[s.matchCard, match.done && s.matchCardDone]}
        onPress={() => openEdit(match)}
      >
        <View style={s.cardTop}>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <View style={[s.typePill, { borderColor: cfg.color + (match.done ? '30' : '50') }]}>
              <Text style={[s.typeText, { color: cfg.color + (match.done ? '60' : 'FF') }]}>{cfg.label}</Text>
            </View>
            {match.isSchnellrunde ? (
              <View style={[s.schnellBadge, match.done && s.badgeDone]}>
                <Ionicons name="flash" size={9} color={match.done ? colors.textDim : colors.warning} />
                <Text style={[s.schnellBadgeText, match.done && s.badgeTextDone]}>SCHNELL</Text>
              </View>
            ) : (
              <View style={[s.normalBadge, match.done && s.badgeDone]}>
                <Ionicons name="shield-checkmark" size={9} color={match.done ? colors.textDim : colors.success} />
                <Text style={[s.normalBadgeText, match.done && s.badgeTextDone]}>NORMAL</Text>
              </View>
            )}
          </View>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            {match.feld != null && (
              <View style={[s.feldTag, match.done && s.tagDone]}>
                <Text style={[s.feldTagText, match.done && s.tagTextDone]}>Feld {match.feld}</Text>
              </View>
            )}
            {!isRoundView && (
              <View style={[s.durchgangTag, match.durchgang === 2 && s.durchgangTag2, match.done && s.tagDone]}>
                <Text style={[s.durchgangTagText, match.durchgang === 2 && s.durchgangTagText2, match.done && s.tagTextDone]}>D{match.durchgang}</Text>
              </View>
            )}
            {!isRoundView && (
              <View style={s.roundTag}>
                <Text style={s.roundTagText}>R{match.roundId}</Text>
              </View>
            )}
            {match.done && (
              <Ionicons name="checkmark-circle" size={16} color={colors.success + '60'} />
            )}
          </View>
        </View>

        <View style={s.matchRow}>
          <Text style={[s.teamName, aWins && s.teamWinner, match.done && !aWins && s.teamDimmed]} numberOfLines={1}>
            {getTeam(match.teamA)}
          </Text>
          <View style={s.scoreBox}>
            {match.done ? (
              <Text style={s.scoreText}>{match.scoreA} – {match.scoreB}</Text>
            ) : (
              <View style={s.editHintBox}>
                <Ionicons name="pencil-outline" size={12} color={colors.textMuted} />
                <Text style={s.editHintText}>Eingeben</Text>
              </View>
            )}
          </View>
          <Text style={[s.teamName, s.teamRight, bWins && s.teamWinner, match.done && !bWins && s.teamDimmed]} numberOfLines={1}>
            {getTeam(match.teamB)}
          </Text>
        </View>
      </AnimatedPressable>
    );
  };

  const simulateAll = () => {
    const round = getCurrentRoundData();
    if (!round) return;
    const pending = round.matches.filter(
      (m) => !m.done && m.durchgang === round.currentDurchgang
    );
    pending.forEach((m) => {
      const schnell = round.isSchnellrunde;
      const winScore = schnell ? 21 : 40;
      const loseScore = Math.floor(Math.random() * winScore);
      const aWins = Math.random() < 0.5;
      saveResult(m.id, aWins ? winScore : loseScore, aWins ? loseScore : winScore);
    });
  };

  const currentRoundData = getCurrentRoundData();
  const hasPending = currentRoundData?.matches?.some(
    (m) => !m.done && m.durchgang === currentRoundData.currentDurchgang
  ) ?? false;

  return (
    <View style={shared.screen}>
      {/* Header */}
      <View style={s.header}>
        <Text style={shared.screenTitle}>Ergebnisse</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {filtered.length > 0 && (
            <View style={s.progressPill}>
              <Text style={s.progressText}>{doneCount}/{filtered.length}</Text>
            </View>
          )}
          {hasPending && currentRoundData && (
            <TouchableOpacity style={s.simulateBtn} onPress={simulateAll} activeOpacity={0.75}>
              <Ionicons name="dice-outline" size={14} color={colors.warning} />
              <Text style={s.simulateBtnText}>Simulieren</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Round Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.filterScroll}
        contentContainerStyle={{ paddingRight: 8 }}
      >
        {[{ key: 'all', label: 'Alle' }, ...rounds.map((r) => ({ key: String(r.id), label: `Runde ${r.id}` }))].map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[s.filterChip, selectedRound === f.key && s.filterChipActive]}
            onPress={() => setSelectedRound(f.key)}
            activeOpacity={0.7}
          >
            <Text style={[s.filterText, selectedRound === f.key && s.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Match List */}
      <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="bar-chart-outline" size={36} color={colors.textDim} />
            <Text style={s.emptyText}>Keine Spiele vorhanden</Text>
          </View>
        ) : isRoundView ? (
          <>
            {d1.length > 0 && (
              <>
                <View style={s.dgHeader}>
                  <Text style={s.dgHeaderText}>DURCHGANG 1</Text>
                  <Text style={s.dgHeaderCount}>{d1.filter((m) => m.done).length}/{d1.length}</Text>
                </View>
                {d1.map(renderMatch)}
              </>
            )}
            {d2.length > 0 && (
              <>
                <View style={[s.dgHeader, { marginTop: 8 }]}>
                  <Text style={s.dgHeaderText}>DURCHGANG 2</Text>
                  <Text style={s.dgHeaderCount}>{d2.filter((m) => m.done).length}/{d2.length}</Text>
                </View>
                {d2.map(renderMatch)}
              </>
            )}
          </>
        ) : (
          filtered.map(renderMatch)
        )}
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={!!editMatch} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={shared.modalBg}>
          <View style={shared.sheet}>
            <View style={s.sheetHeader}>
              <Text style={shared.sheetTitle}>Ergebnis eingeben</Text>
              <TouchableOpacity onPress={() => setEditMatch(null)} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            {editMatch && (
              <View style={s.matchPreview}>
                <Text style={s.previewTeam} numberOfLines={1}>{getTeam(editMatch.teamA)}</Text>
                <Text style={s.previewVs}>VS</Text>
                <Text style={s.previewTeam} numberOfLines={1}>{getTeam(editMatch.teamB)}</Text>
              </View>
            )}
            {isEditSchnellrunde ? (
              <View style={s.schnellHint}>
                <Ionicons name="flash" size={13} color={colors.warning} />
                <Text style={s.schnellHintText}>
                  Schnellrunde · Max 21 Pkt · Verlierer mind. 16 Pkt
                </Text>
              </View>
            ) : (
              <View style={s.normalHint}>
                <Ionicons name="shield-checkmark" size={13} color={colors.success} />
                <Text style={s.normalHintText}>
                  Normale Runde · Max 40 Pkt · Verlierer erhält eigene Punkte
                </Text>
              </View>
            )}
            <View style={s.scoreRow}>
              <View style={s.scoreCol}>
                <TextInput
                  style={[s.scoreInput, errorA ? s.scoreInputError : null]}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textDim}
                  value={scoreA}
                  onChangeText={handleChangeA}
                  maxLength={2}
                />
                {errorA ? (
                  <View style={s.errorBox}>
                    <Ionicons name="alert-circle" size={11} color={colors.error} />
                    <Text style={s.errorText}>{errorA}</Text>
                  </View>
                ) : null}
              </View>
              <View style={s.dashBox}>
                <Text style={s.dashText}>–</Text>
              </View>
              <View style={s.scoreCol}>
                <TextInput
                  style={[s.scoreInput, errorB ? s.scoreInputError : null]}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textDim}
                  value={scoreB}
                  onChangeText={handleChangeB}
                  maxLength={2}
                />
                {errorB ? (
                  <View style={s.errorBox}>
                    <Ionicons name="alert-circle" size={11} color={colors.error} />
                    <Text style={s.errorText}>{errorB}</Text>
                  </View>
                ) : null}
              </View>
            </View>
            <AnimatedPressable
              style={[shared.saveBtn, !isFormValid && s.saveBtnDisabled]}
              onPress={handleSave}
              disabled={!isFormValid}
            >
              <Text style={[shared.saveBtnText, !isFormValid && s.saveBtnTextDisabled]}>
                SPEICHERN
              </Text>
            </AnimatedPressable>
            <TouchableOpacity onPress={() => setEditMatch(null)} activeOpacity={0.7}>
              <Text style={shared.cancelText}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  simulateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.warning + '18',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.warning + '40',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  simulateBtnText: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  progressPill: {
    backgroundColor: colors.goldGlow,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderGoldGlow,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  progressText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '700',
  },
  filterScroll: {
    flexGrow: 0,
    marginBottom: 14,
  },
  filterChip: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 7,
    marginRight: 8,
    backgroundColor: colors.panel,
  },
  filterChipActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  filterText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  filterTextActive: {
    color: colors.bg,
    fontWeight: '700',
  },
  list: { flex: 1 },
  empty: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
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
    borderColor: colors.border,
    opacity: 0.42,
  },
  teamDimmed: {
    color: colors.textDim,
  },
  badgeDone: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
  },
  badgeTextDone: {
    color: colors.textDim,
  },
  tagDone: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
  },
  tagTextDone: {
    color: colors.textDim,
  },
  dgHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 6,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dgHeaderText: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: fonts.heading,
    letterSpacing: 1.5,
  },
  dgHeaderCount: {
    color: colors.textDim,
    fontSize: 11,
    fontFamily: fonts.body,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  typePill: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  typeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  feldTag: {
    backgroundColor: colors.goldGlow,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.borderGoldGlow,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  feldTagText: {
    color: colors.gold,
    fontSize: 10,
    fontFamily: fonts.headingSemi,
    letterSpacing: 0.5,
  },
  durchgangTag: {
    backgroundColor: colors.info + '18',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.info + '40',
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  durchgangTag2: {
    backgroundColor: colors.goldGlow,
    borderColor: colors.borderGoldGlow,
  },
  durchgangTagText: {
    color: colors.info,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  durchgangTagText2: {
    color: colors.gold,
  },
  roundTag: {
    backgroundColor: colors.bgSurface,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  roundTagText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamName: {
    flex: 1,
    color: colors.silverDim,
    fontSize: 13,
    fontFamily: fonts.bodySemi,
  },
  teamRight: {
    textAlign: 'right',
  },
  teamWinner: {
    color: colors.gold,
  },
  scoreBox: {
    minWidth: 64,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  scoreText: {
    color: colors.white,
    fontSize: 18,
    fontFamily: fonts.heading,
    letterSpacing: 1,
  },
  editHintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editHintText: {
    color: colors.textMuted,
    fontSize: 11,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  matchPreview: {
    backgroundColor: colors.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    alignItems: 'center',
    marginBottom: 20,
    gap: 4,
  },
  previewTeam: {
    color: colors.gold,
    fontSize: 14,
    fontFamily: fonts.bodySemi,
    textAlign: 'center',
  },
  previewVs: {
    color: colors.textDim,
    fontSize: 11,
    fontFamily: fonts.headingSemi,
    letterSpacing: 1,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 8,
  },
  scoreCol: {
    alignItems: 'center',
    width: 96,
  },
  scoreInput: {
    backgroundColor: colors.bg,
    color: colors.gold,
    fontSize: 36,
    fontWeight: '800',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: 16,
    width: 96,
    textAlign: 'center',
  },
  scoreInputError: {
    borderColor: colors.error,
    color: colors.error,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 6,
  },
  errorText: {
    color: colors.error,
    fontSize: 10,
    fontWeight: '600',
  },
  dashBox: {
    width: 28,
    alignItems: 'center',
    paddingTop: 20,
  },
  dashText: {
    color: colors.textMuted,
    fontSize: 24,
    fontWeight: '300',
  },
  saveBtnDisabled: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
  },
  saveBtnTextDisabled: {
    color: colors.textMuted,
  },
  schnellBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.warning + '18',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.warning + '40',
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  schnellBadgeText: {
    color: colors.warning,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  schnellHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.warning + '12',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.warning + '35',
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 16,
  },
  schnellHintText: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  normalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.success + '18',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.success + '40',
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  normalBadgeText: {
    color: colors.success,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  normalHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.success + '12',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.success + '35',
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 16,
  },
  normalHintText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
});
