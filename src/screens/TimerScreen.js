import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Vibration } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { shared, cardShadow, goldGlowShadow } from '../theme/styles';
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
  const getName = (id) => {
    const p = participants.find((x) => x.id === id);
    if (!p) return '?';
    const parts = p.name.split(','); const first = parts.length > 1 ? `${parts[1].trim()} ${parts[0].trim()}` : p.name.trim();
    return p.league ? `${first} [${p.league}]` : first;
  };
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
  const isFinished = secondsLeft === 0;

  const timerColor = isFinished ? colors.error : isWarning ? colors.warning : colors.gold;
  const ringColor = isFinished ? colors.error + '60' : isWarning ? colors.warning + '60' : colors.borderGoldGlow;

  const progress = secondsLeft / DEFAULT_SECONDS;
  const progressPct = Math.round(progress * 100);

  return (
    <View style={[shared.screen, s.screen]}>
      <Text style={s.title}>Timer</Text>

      {/* Match Info Card */}
      <View style={s.matchCard}>
        {activeMatch ? (
          <>
            <Text style={s.matchLabel}>AKTIVES SPIEL</Text>
            <Text style={s.teamText} numberOfLines={1}>{getTeam(activeMatch.teamA)}</Text>
            <View style={s.vsRow}>
              <View style={s.vsLine} />
              <Text style={s.vsText}>VS</Text>
              <View style={s.vsLine} />
            </View>
            <Text style={s.teamText} numberOfLines={1}>{getTeam(activeMatch.teamB)}</Text>
            <Text style={s.roundMeta}>Runde {round?.id}</Text>
          </>
        ) : (
          <View style={s.noMatch}>
            <Ionicons name="tennisball-outline" size={20} color={colors.textMuted} />
            <Text style={s.noMatchText}>Kein aktives Spiel</Text>
          </View>
        )}
      </View>

      {/* Timer Ring */}
      <View style={[s.ringOuter, { borderColor: ringColor }, isFinished && s.ringFinished]}>
        <View style={s.ringInner}>
          <Text style={[s.timerText, { color: timerColor }]}>
            {mins}:{secs}
          </Text>
          <Text style={[s.statusText, { color: running ? colors.success : isFinished ? colors.error : colors.textMuted }]}>
            {isFinished ? 'ZEIT!' : running ? 'LÄUFT' : 'PAUSE'}
          </Text>
          {isWarning && !isFinished && (
            <Text style={s.warningText}>5 Min. Rest</Text>
          )}
        </View>
      </View>

      {/* Progress Bar */}
      <View style={s.progressBar}>
        <View style={[s.progressFill, { width: `${progressPct}%`, backgroundColor: timerColor }]} />
      </View>
      <Text style={s.progressLabel}>{progressPct}%</Text>

      {/* Controls */}
      <View style={s.controls}>
        <TouchableOpacity
          style={[s.ctrlBtn, running && s.ctrlBtnActive]}
          onPress={() => setRunning((r) => !r)}
          activeOpacity={0.75}
        >
          <Ionicons
            name={running ? 'pause' : 'play'}
            size={24}
            color={running ? colors.bg : colors.gold}
          />
          <Text style={[s.ctrlLabel, running && s.ctrlLabelActive]}>
            {running ? 'Pause' : 'Start'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.ctrlBtn} onPress={reset} activeOpacity={0.75}>
          <Ionicons name="refresh" size={22} color={colors.silver} />
          <Text style={s.ctrlLabel}>Reset</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.ctrlBtn, s.ctrlBtnStop]}
          onPress={() => { setRunning(false); setSecondsLeft(0); }}
          activeOpacity={0.75}
        >
          <Ionicons name="stop" size={22} color={colors.error} />
          <Text style={[s.ctrlLabel, { color: colors.error + 'AA' }]}>Stop</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.hint}>Standard: 20 Min.  ·  Vibration bei 5 Min. Rest & Ende</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    alignItems: 'center',
  },
  title: {
    color: colors.white,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.3,
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
  matchCard: {
    width: '100%',
    backgroundColor: colors.panel,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 32,
    alignItems: 'center',
    ...cardShadow,
  },
  matchLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  teamText: {
    color: colors.gold,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  vsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 6,
    width: '80%',
  },
  vsLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  vsText: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  roundMeta: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 8,
    letterSpacing: 0.5,
  },
  noMatch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  noMatchText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  ringOuter: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 3,
    backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    ...goldGlowShadow,
  },
  ringFinished: {
    borderColor: colors.error + '80',
  },
  ringInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerText: {
    fontSize: 50,
    fontWeight: '800',
    letterSpacing: 2,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 4,
  },
  warningText: {
    color: colors.warning,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
    letterSpacing: 0.5,
  },
  progressBar: {
    width: '80%',
    height: 3,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressLabel: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 32,
  },
  controls: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  ctrlBtn: {
    backgroundColor: colors.panel,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 82,
    gap: 4,
    ...cardShadow,
  },
  ctrlBtnActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  ctrlBtnStop: {
    borderColor: colors.error + '40',
  },
  ctrlLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  ctrlLabelActive: {
    color: colors.bg,
    fontWeight: '700',
  },
  hint: {
    color: colors.textDim,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 18,
  },
});
