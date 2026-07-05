import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/styles';
import { useTournament } from '../store/tournament';

// Honest freshness indicator, shared by all viewer tabs. Gold + steady dot
// while polls succeed (gold = "the live thing", per PRODUCT.md's authority
// rule); dimmed "STAND HH:MM" when the last successful sync is stale, so a
// viewer on flaky gym Wi-Fi is never lied to by a decorative badge.
export default function LiveBadge() {
  const { loaded, staleSince, online } = useTournament();
  if (!loaded) return null;

  if (online) {
    return (
      <View style={[s.badge, s.badgeLive]}>
        <View style={s.dot} />
        <Text style={s.liveText}>LIVE</Text>
      </View>
    );
  }

  const time = staleSince
    ? new Date(staleSince).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : '—';
  return (
    <View style={[s.badge, s.badgeStale]}>
      <Text style={s.staleText}>STAND {time}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeLive: {
    backgroundColor: colors.goldGlow,
    borderColor: colors.borderGoldGlow,
  },
  badgeStale: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.gold,
  },
  liveText: {
    color: colors.gold,
    fontSize: 11,
    fontFamily: fonts.headingSemi,
    letterSpacing: 1,
  },
  staleText: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: fonts.headingSemi,
    letterSpacing: 1,
  },
});
