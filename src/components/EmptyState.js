import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/styles';

// Shared branded empty state for viewer-facing tabs. Speaks to the audience
// ("the tournament hasn't started"), never to the admin, and carries the
// wordmark — for most players this screen is their first contact with the
// app, before any data exists.
export default function EmptyState({ title, hint }) {
  return (
    <View style={s.container}>
      <Text style={s.glyph}>☽</Text>
      <Text style={s.wordmark}>MOONLIGHT CUP</Text>
      <Text style={s.title}>{title}</Text>
      {!!hint && <Text style={s.hint}>{hint}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 72,
    paddingHorizontal: 32,
  },
  glyph: {
    color: colors.gold,
    fontSize: 44,
    lineHeight: 52,
    marginBottom: 8,
  },
  wordmark: {
    color: colors.gold,
    fontSize: 15,
    fontFamily: fonts.heading,
    letterSpacing: 4,
    marginBottom: 28,
  },
  title: {
    color: colors.white,
    fontSize: 20,
    fontFamily: fonts.heading,
    letterSpacing: 0.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  hint: {
    color: colors.textMuted,
    fontSize: 14,
    fontFamily: fonts.body,
    textAlign: 'center',
    lineHeight: 21,
  },
});
