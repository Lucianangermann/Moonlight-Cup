import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { shared, cardShadow } from '../theme/styles';
import { useTournament } from '../store/tournament';

const TYPE_CONFIG = {
  MM: { label: 'HERRENDOPPEL', color: colors.info },
  FF: { label: 'DAMENDOPPEL',  color: '#E879A0' },
  MF: { label: 'MIXED',        color: colors.gold },
};

export default function ErgebnisseScreen() {
  const { rounds, participants, saveResult } = useTournament();
  const [selectedRound, setSelectedRound] = useState('all');
  const [editMatch, setEditMatch] = useState(null);
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');

  const getName = (id) => participants.find((x) => x.id === id)?.name.split(',')[0] ?? '?';
  const getTeam = (ids) => ids.map(getName).join(' & ');

  const allMatches = rounds.flatMap((r) =>
    r.matches.map((m) => ({ ...m, roundId: r.id, isSchnellrunde: r.isSchnellrunde }))
  );
  const filtered = selectedRound === 'all'
    ? allMatches
    : allMatches.filter((m) => m.roundId === Number(selectedRound));

  const isEditSchnellrunde = editMatch?.isSchnellrunde ?? false;

  const openEdit = (match) => {
    setEditMatch(match);
    setScoreA(match.scoreA?.toString() ?? '');
    setScoreB(match.scoreB?.toString() ?? '');
  };

  const handleSave = () => {
    if (!editMatch) return;
    saveResult(editMatch.id, Number(scoreA), Number(scoreB));
    setEditMatch(null);
  };

  const doneCount = filtered.filter((m) => m.done).length;

  return (
    <View style={shared.screen}>
      {/* Header */}
      <View style={s.header}>
        <Text style={shared.screenTitle}>Ergebnisse</Text>
        {filtered.length > 0 && (
          <View style={s.progressPill}>
            <Text style={s.progressText}>{doneCount}/{filtered.length}</Text>
          </View>
        )}
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
        ) : (
          filtered.map((match) => {
            const cfg = TYPE_CONFIG[match.type] ?? TYPE_CONFIG.MF;
            const aWins = match.done && match.scoreA > match.scoreB;
            const bWins = match.done && match.scoreB > match.scoreA;
            return (
              <TouchableOpacity
                key={match.id}
                style={[s.matchCard, match.done && s.matchCardDone]}
                onPress={() => openEdit(match)}
                activeOpacity={0.75}
              >
                <View style={s.cardTop}>
                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    <View style={[s.typePill, { borderColor: cfg.color + '50' }]}>
                      <Text style={[s.typeText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                    {match.isSchnellrunde && (
                      <View style={s.schnellBadge}>
                        <Ionicons name="flash" size={9} color={colors.warning} />
                        <Text style={s.schnellBadgeText}>SCHNELL</Text>
                      </View>
                    )}
                  </View>
                  <View style={s.roundTag}>
                    <Text style={s.roundTagText}>R{match.roundId}</Text>
                  </View>
                </View>

                <View style={s.matchRow}>
                  <Text style={[s.teamName, aWins && s.teamWinner]} numberOfLines={1}>
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

                  <Text style={[s.teamName, s.teamRight, bWins && s.teamWinner]} numberOfLines={1}>
                    {getTeam(match.teamB)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
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
            {isEditSchnellrunde && (
              <View style={s.schnellHint}>
                <Ionicons name="flash" size={13} color={colors.warning} />
                <Text style={s.schnellHintText}>
                  Schnellrunde · Max 21 Pkt · Verlierer mind. 16 Pkt
                </Text>
              </View>
            )}
            <View style={s.scoreRow}>
              <TextInput
                style={s.scoreInput}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.textDim}
                value={scoreA}
                onChangeText={setScoreA}
              />
              <View style={s.dashBox}>
                <Text style={s.dashText}>–</Text>
              </View>
              <TextInput
                style={s.scoreInput}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.textDim}
                value={scoreB}
                onChangeText={setScoreB}
              />
            </View>
            <TouchableOpacity style={shared.saveBtn} onPress={handleSave} activeOpacity={0.8}>
              <Text style={shared.saveBtnText}>SPEICHERN</Text>
            </TouchableOpacity>
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
    borderColor: colors.success + '25',
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
    fontWeight: '600',
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
    fontSize: 16,
    fontWeight: '800',
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
    fontWeight: '700',
    textAlign: 'center',
  },
  previewVs: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 8,
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
  dashBox: {
    width: 28,
    alignItems: 'center',
  },
  dashText: {
    color: colors.textMuted,
    fontSize: 24,
    fontWeight: '300',
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
});
