import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { shared, cardShadow } from '../theme/styles';
import { useTournament } from '../store/tournament';

const TYPE_CONFIG = {
  MM: { label: 'HERRENDOPPEL', icon: 'man',       color: colors.info },
  FF: { label: 'DAMENDOPPEL',  icon: 'woman',     color: '#E879A0' },
  MF: { label: 'MIXED',        icon: 'swap-horizontal', color: colors.gold },
};

export default function RundeScreen() {
  const { getCurrentRoundData, currentRound, allMatchesDone, startNewRound, participants, advanceDurchgang, currentDurchgangDone } = useTournament();
  const round = getCurrentRoundData();
  const isSchnellrunde = round?.isSchnellrunde ?? false;
  const durchgang = round?.currentDurchgang ?? 1;

  const getName = (id) => {
    const p = participants.find((x) => x.id === id);
    if (!p) return '?';
    const first = p.name.split(',')[0].trim();
    return p.league ? `${first} [${p.league}]` : first;
  };
  const getTeam = (ids) => ids.map(getName).join(' & ');

  // Nur Matches des aktuellen Durchgangs anzeigen
  const visibleMatches = round?.matches?.filter((m) => m.durchgang === durchgang) ?? [];
  const pendingCount = visibleMatches.filter((m) => !m.done).length;
  const doneCount = visibleMatches.filter((m) => m.done).length;

  const d1Done = currentDurchgangDone();
  const allDone = allMatchesDone();

  // Primäre Aktion: In D1 → "Durchgang 2 starten"; in D2 → "Neue Runde starten"
  const inD1 = round && durchgang === 1;
  const primaryLabel = !round ? 'NEUE RUNDE STARTEN' : inD1 ? 'DURCHGANG 2 STARTEN' : 'NEUE RUNDE STARTEN';
  const primaryEnabled = !round || (inD1 ? d1Done : allDone);
  const primaryAction = inD1 ? advanceDurchgang : startNewRound;

  return (
    <View style={shared.screen}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.logoText}>☽ MOONLIGHT CUP</Text>
          <Text style={s.logoSub}>Badminton Turniermanager</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
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
                Pausiert: {round.sittingOut.map(getName).join(', ')}
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
                    <View style={[s.typePill, { borderColor: cfg.color + '60' }]}>
                      <Ionicons name={cfg.icon} size={10} color={cfg.color} />
                      <Text style={[s.typeLabel, { color: cfg.color }]}>{cfg.label}</Text>
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

      <TouchableOpacity
        style={[shared.goldBtn, !primaryEnabled && shared.disabledBtn]}
        onPress={primaryAction}
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
});
