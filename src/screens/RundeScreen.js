import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { useTournament } from '../store/tournament';

export default function RundeScreen() {
  const { getCurrentRoundData, currentRound, allMatchesDone, startNewRound, participants } = useTournament();
  const round = getCurrentRoundData();

  const getName = (id) => {
    const p = participants.find((x) => x.id === id);
    return p ? p.name.split(',')[0] : '?';
  };

  const statusIcon = (match) => {
    if (match.done) return { label: '✅ Fertig', color: colors.success };
    return { label: '⏳ Wartet', color: colors.textMuted };
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.logo}>☽ MOONLIGHT CUP</Text>
        <Text style={s.roundBadge}>Runde {currentRound}</Text>
      </View>

      <View style={s.summaryCard}>
        <Text style={s.summaryTitle}>AKTUELLE RUNDE: {currentRound}</Text>
        <Text style={s.summarySubtitle}>
          {round?.matches?.length ?? 0} Spiele · {round?.matches?.filter((m) => !m.done).length ?? 0} ausstehend
        </Text>
      </View>

      <Text style={s.sectionLabel}>── Paarungen ──</Text>

      <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
        {round?.matches?.map((match) => {
          const st = statusIcon(match);
          return (
            <View key={match.id} style={s.matchCard}>
              <Text style={s.matchTitle}>
                {getName(match.playerA)}  vs  {getName(match.playerB)}
              </Text>
              {match.done && (
                <Text style={s.score}>{match.scoreA} – {match.scoreB}</Text>
              )}
              <Text style={[s.matchStatus, { color: st.color }]}>{st.label}</Text>
            </View>
          );
        })}
        {!round && (
          <Text style={s.empty}>Noch keine Runde gestartet.</Text>
        )}
      </ScrollView>

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
  sectionLabel: { color: colors.textMuted, fontSize: 12, marginBottom: 12, letterSpacing: 1 },
  list: { flex: 1 },
  matchCard: {
    backgroundColor: colors.panel, borderRadius: 12, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: colors.border,
  },
  matchTitle: { color: colors.white, fontSize: 15, fontWeight: '600' },
  score: { color: colors.gold, fontSize: 18, fontWeight: '700', marginTop: 4 },
  matchStatus: { fontSize: 13, marginTop: 4 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
  button: {
    backgroundColor: colors.gold, borderRadius: 12, padding: 16,
    alignItems: 'center', marginVertical: 16,
  },
  buttonDisabled: { backgroundColor: colors.border },
  buttonText: { color: colors.bg, fontSize: 15, fontWeight: '800', letterSpacing: 1 },
});
