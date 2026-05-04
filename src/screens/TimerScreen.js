import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Vibration } from 'react-native';
import { colors } from '../theme/colors';
import { useTournament } from '../store/tournament';

const DEFAULT_SECONDS = 20 * 60;
const WARNING_SECONDS = 5 * 60;

export default function TimerScreen() {
  const { getCurrentRoundData, participants } = useTournament();
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_SECONDS);
  const [running, setRunning] = useState(false);
  const [warned, setWarned] = useState(false);
  const intervalRef = useRef(null);

  const round = getCurrentRoundData();
  const activeMatch = round?.matches?.find((m) => !m.done) ?? round?.matches?.[0];
  const getName = (id) => participants.find((x) => x.id === id)?.name.split(',')[0] ?? '?';
  const getTeam = (ids) => ids?.map(getName).join(' & ') ?? '';

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            clearInterval(intervalRef.current);
            setRunning(false);
            Vibration.vibrate([0, 400, 100, 400]);
            return 0;
          }
          if (s === WARNING_SECONDS + 1 && !warned) {
            setWarned(true);
            Vibration.vibrate(200);
          }
          return s - 1;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [running]);

  const reset = () => {
    setRunning(false);
    setSecondsLeft(DEFAULT_SECONDS);
    setWarned(false);
  };

  const mins = Math.floor(secondsLeft / 60).toString().padStart(2, '0');
  const secs = (secondsLeft % 60).toString().padStart(2, '0');
  const isWarning = secondsLeft <= WARNING_SECONDS && secondsLeft > 0;
  const timerColor = secondsLeft === 0 ? colors.error : isWarning ? colors.warning : colors.gold;

  return (
    <View style={s.container}>
      <Text style={s.title}>⏱️  Timer</Text>

      {activeMatch ? (
        <View style={s.matchInfo}>
          <Text style={s.teamA}>{getTeam(activeMatch.teamA)}</Text>
          <Text style={s.vs}>vs</Text>
          <Text style={s.teamB}>{getTeam(activeMatch.teamB)}</Text>
          <Text style={s.matchMeta}>Runde {round?.id}</Text>
        </View>
      ) : (
        <View style={s.matchInfo}>
          <Text style={s.matchMeta}>Kein aktives Spiel</Text>
        </View>
      )}

      <View style={s.timerRing}>
        <View style={[s.timerInner, { borderColor: timerColor }]}>
          <Text style={[s.timerText, { color: timerColor }]}>{mins}:{secs}</Text>
          <Text style={[s.timerStatus, { color: running ? colors.success : colors.textMuted }]}>
            {secondsLeft === 0 ? '⏰ ZEIT!' : running ? '◉ LÄUFT' : '◎ PAUSE'}
          </Text>
          {isWarning && <Text style={s.warningHint}>🔔 5 Min. Rest</Text>}
        </View>
      </View>

      <View style={s.controls}>
        <TouchableOpacity style={s.ctrlBtn} onPress={() => setRunning((r) => !r)}>
          <Text style={s.ctrlIcon}>{running ? '⏸' : '▶'}</Text>
          <Text style={s.ctrlLabel}>{running ? 'Pause' : 'Start'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.ctrlBtn} onPress={reset}>
          <Text style={s.ctrlIcon}>⟳</Text>
          <Text style={s.ctrlLabel}>Reset</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.ctrlBtn, s.ctrlStop]} onPress={() => { setRunning(false); setSecondsLeft(0); }}>
          <Text style={s.ctrlIcon}>⏹</Text>
          <Text style={s.ctrlLabel}>Stop</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.hint}>Standard: 20 Min. · Vibration bei 5 Min. Rest & Ende</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16, paddingTop: 56, alignItems: 'center' },
  title: { color: colors.white, fontSize: 22, fontWeight: '800', alignSelf: 'flex-start', marginBottom: 16 },
  matchInfo: { backgroundColor: colors.panel, borderRadius: 12, padding: 14, width: '100%', alignItems: 'center', marginBottom: 32 },
  teamA: { color: colors.gold, fontSize: 14, fontWeight: '700' },
  vs: { color: colors.textMuted, fontSize: 12, marginVertical: 2 },
  teamB: { color: colors.gold, fontSize: 14, fontWeight: '700' },
  matchMeta: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  timerRing: { width: 240, height: 240, borderRadius: 120, backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center', marginBottom: 40 },
  timerInner: { width: 210, height: 210, borderRadius: 105, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  timerText: { fontSize: 52, fontWeight: '800', letterSpacing: 2 },
  timerStatus: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  warningHint: { color: colors.warning, fontSize: 12, marginTop: 6 },
  controls: { flexDirection: 'row', gap: 16, marginBottom: 24 },
  ctrlBtn: { backgroundColor: colors.panel, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center', borderWidth: 1, borderColor: colors.border, minWidth: 80 },
  ctrlStop: { borderColor: colors.error + '55' },
  ctrlIcon: { fontSize: 22 },
  ctrlLabel: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  hint: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
});
