import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { colors } from '../theme/colors';
import { useTournament } from '../store/tournament';

const TYPE_LABEL = { MM: '♂ Herrendoppel', FF: '♀ Damendoppel', MF: '⚤ Mixed' };

export default function ErgebnisseScreen() {
  const { rounds, participants, saveResult } = useTournament();
  const [selectedRound, setSelectedRound] = useState('all');
  const [editMatch, setEditMatch] = useState(null);
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');

  const getName = (id) => participants.find((x) => x.id === id)?.name.split(',')[0] ?? '?';
  const getTeam = (ids) => ids.map(getName).join(' & ');

  const allMatches = rounds.flatMap((r) =>
    r.matches.map((m) => ({ ...m, roundId: r.id }))
  );
  const filtered = selectedRound === 'all'
    ? allMatches
    : allMatches.filter((m) => m.roundId === Number(selectedRound));

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

  return (
    <View style={s.container}>
      <Text style={s.title}>Ergebnisse</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow}>
        {[{ key: 'all', label: 'Alle' }, ...rounds.map((r) => ({ key: String(r.id), label: `Runde ${r.id}` }))].map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[s.filterChip, selectedRound === f.key && s.filterChipActive]}
            onPress={() => setSelectedRound(f.key)}
          >
            <Text style={[s.filterText, selectedRound === f.key && s.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
        {filtered.map((match) => (
          <TouchableOpacity key={match.id} style={s.matchCard} onPress={() => openEdit(match)}>
            <Text style={s.matchType}>{TYPE_LABEL[match.type]} · Runde {match.roundId}</Text>
            <View style={s.matchRow}>
              <Text style={[s.teamName, match.done && match.scoreA > match.scoreB && s.winner]}>
                {getTeam(match.teamA)}
              </Text>
              <Text style={s.scoreText}>
                {match.done ? `${match.scoreA} – ${match.scoreB}` : '? – ?'}
              </Text>
              <Text style={[s.teamName, s.right, match.done && match.scoreB > match.scoreA && s.winner]}>
                {getTeam(match.teamB)}
              </Text>
            </View>
            {!match.done && <Text style={s.editHint}>✏️ Tippen zum Eingeben</Text>}
          </TouchableOpacity>
        ))}
        {filtered.length === 0 && <Text style={s.empty}>Keine Spiele vorhanden.</Text>}
      </ScrollView>

      <Modal visible={!!editMatch} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalBg}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>Ergebnis eingeben</Text>
            {editMatch && (
              <>
                <Text style={s.sheetTeamA}>{getTeam(editMatch.teamA)}</Text>
                <Text style={s.sheetVs}>vs</Text>
                <Text style={s.sheetTeamB}>{getTeam(editMatch.teamB)}</Text>
              </>
            )}
            <View style={s.scoreRow}>
              <TextInput
                style={s.scoreInput} keyboardType="numeric" placeholder="0"
                placeholderTextColor={colors.textMuted} value={scoreA}
                onChangeText={setScoreA}
              />
              <Text style={s.dash}>–</Text>
              <TextInput
                style={s.scoreInput} keyboardType="numeric" placeholder="0"
                placeholderTextColor={colors.textMuted} value={scoreB}
                onChangeText={setScoreB}
              />
            </View>
            <TouchableOpacity style={s.saveBtn} onPress={handleSave}>
              <Text style={s.saveBtnText}>SPEICHERN</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setEditMatch(null)}>
              <Text style={s.cancelText}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16, paddingTop: 56 },
  title: { color: colors.white, fontSize: 22, fontWeight: '800', marginBottom: 16 },
  filterRow: { flexGrow: 0, marginBottom: 14 },
  filterChip: { borderRadius: 20, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 6, marginRight: 8 },
  filterChipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  filterText: { color: colors.textMuted, fontSize: 13 },
  filterTextActive: { color: colors.bg, fontWeight: '700' },
  list: { flex: 1 },
  matchCard: { backgroundColor: colors.panel, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  matchType: { color: colors.textMuted, fontSize: 11, fontWeight: '600', letterSpacing: 1, marginBottom: 8 },
  matchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  teamName: { color: colors.silver, fontSize: 13, fontWeight: '600', flex: 1 },
  right: { textAlign: 'right' },
  winner: { color: colors.gold },
  scoreText: { color: colors.white, fontSize: 16, fontWeight: '700', marginHorizontal: 8 },
  editHint: { color: colors.textMuted, fontSize: 11, marginTop: 6 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
  modalBg: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { backgroundColor: colors.panel, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  sheetTitle: { color: colors.white, fontSize: 18, fontWeight: '800', marginBottom: 12 },
  sheetTeamA: { color: colors.gold, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  sheetVs: { color: colors.textMuted, fontSize: 12, textAlign: 'center', marginVertical: 2 },
  sheetTeamB: { color: colors.gold, fontSize: 14, fontWeight: '700', textAlign: 'center', marginBottom: 20 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  scoreInput: { backgroundColor: colors.bg, color: colors.white, fontSize: 32, fontWeight: '700', borderRadius: 12, padding: 16, width: 90, textAlign: 'center' },
  dash: { color: colors.textMuted, fontSize: 24, marginHorizontal: 16 },
  saveBtn: { backgroundColor: colors.gold, borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12 },
  saveBtnText: { color: colors.bg, fontSize: 15, fontWeight: '800' },
  cancelText: { color: colors.textMuted, textAlign: 'center', fontSize: 14, paddingVertical: 8 },
});
