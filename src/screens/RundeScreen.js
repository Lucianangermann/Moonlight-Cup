import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { useTournament } from '../store/tournament';

const TYPE_LABEL = { MM: '♂ Herrendoppel', FF: '♀ Damendoppel', MF: '⚤ Mixed' };

export default function RundeScreen() {
  const { getCurrentRoundData, currentRound, allMatchesDone, startNewRound, participants } = useTournament();
  const round = getCurrentRoundData();

  const getName = (id) => participants.find((x) => x.id === id)?.name.split(',')[0] ?? '?';
  const getTeam = (ids) => ids.map(getName).join(' & ');

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.logo}>☽ MOONLIGHT CUP</Text>
        {currentRound > 0 && <Text style={s.roundBadge}>Runde {currentRound}</Text>}
      </View>

      {round ? (
        <>
          <View style={s.summaryCard}>
            <Text style={s.summaryTitle}>AKTUELLE RUNDE: {currentRound}</Text>
            <Text style={s.summarySubtitle}>
              {round.matches.length} Spiele · {round.matches.filter((m) => !m.done).length} ausstehend
            </Text>
            {round.sittingOut?.length > 0 && (
              <Text style={s.sittingOut}>
                Pausiert: {round.sittingOut.map(getName).join(', ')}
              </Text>
            )}
          </View>

          <Text style={s.sectionLabel}>── Paarungen ──</Text>

          <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
            {round.matches.map((match) => (
              <View key={match.id} style={s.matchCard}>
                <Text style={s.matchType}>{TYPE_LABEL[match.type]}</Text>
                <View style={s.teamsRow}>
                  <Text style={s.teamName}>{getTeam(match.teamA)}</Text>
                  <Text style={s.vs}>vs</Text>
                  <Text style={[s.teamName, s.teamRight]}>{getTeam(match.teamB)}</Text>
                </View>
                {match.done ? (
                  <Text style={s.score}>{match.scoreA} – {match.scoreB}</Text>
                ) : (
                  <Text style={s.matchStatus}>⏳ Ausstehend</Text>
                )}
              </View>
            ))}
            <View style={{ height: 20 }} />
          </ScrollView>
        </>
      ) : (
        <View style={s.emptyState}>
          <Text style={s.emptyIcon}>🏸</Text>
          <Text style={s.emptyText}>Noch keine Runde gestartet.</Text>
          <Text style={s.emptyHint}>Tippe auf "Neue Runde starten" um die Auslosung zu beginnen.</Text>
        </View>
      )}

      <TouchableOpacity
        style={[s.button, !allMatchesDone() && s.buttonDisabled]}
        onPress={startNewRound}
        disabled={!allMatchesDone()}
      >
        <Text style={s.buttonText}>▶  NEUE RUNDE STARTEN</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16, paddingTop: 56 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  logo: { color: colors.silver, fontSize: 16, fontWeight: '700', letterSpacing: 1 },
  roundBadge: { color: colors.gold, fontSize: 14, fontWeight: '600' },
  summaryCard: { backgroundColor: colors.panel, borderRadius: 12, padding: 16, marginBottom: 20 },
  summaryTitle: { color: colors.white, fontSize: 15, fontWeight: '700' },
  summarySubtitle: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  sittingOut: { color: colors.warning, fontSize: 12, marginTop: 6 },
  sectionLabel: { color: colors.textMuted, fontSize: 12, marginBottom: 12, letterSpacing: 1 },
  list: { flex: 1 },
  matchCard: {
    backgroundColor: colors.panel, borderRadius: 12, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: colors.border,
  },
  matchType: { color: colors.textMuted, fontSize: 11, fontWeight: '600', letterSpacing: 1, marginBottom: 8 },
  teamsRow: { flexDirection: 'row', alignItems: 'center' },
  teamName: { flex: 1, color: colors.white, fontSize: 14, fontWeight: '600' },
  teamRight: { textAlign: 'right' },
  vs: { color: colors.textMuted, fontSize: 12, marginHorizontal: 8 },
  score: { color: colors.gold, fontSize: 18, fontWeight: '700', marginTop: 8, textAlign: 'center' },
  matchStatus: { color: colors.textMuted, fontSize: 12, marginTop: 6 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { color: colors.white, fontSize: 16, fontWeight: '700', marginBottom: 8 },
  emptyHint: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  button: {
    backgroundColor: colors.gold, borderRadius: 12, padding: 16,
    alignItems: 'center', marginVertical: 16,
  },
  buttonDisabled: { backgroundColor: colors.border },
  buttonText: { color: colors.bg, fontSize: 15, fontWeight: '800', letterSpacing: 1 },
});
