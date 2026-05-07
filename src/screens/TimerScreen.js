import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Vibration } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { shared, goldGlowShadow, cardShadow } from '../theme/styles';
import { useTournament } from '../store/tournament';

const WARMUP_SECONDS = 3 * 60;
const DEFAULT_SECONDS = 20 * 60;
const WARNING_SECONDS = 5 * 60;

export default function TimerScreen() {
  const { autoTimerTrigger } = useTournament();
  const [phase, setPhaseState] = useState('idle'); // 'idle' | 'warmup' | 'game'
  const [timerDurchgang, setTimerDurchgang] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_SECONDS);
  const [running, setRunning] = useState(false);
  const [warned, setWarned] = useState(false);
  const [phaseComplete, setPhaseComplete] = useState(null);
  const intervalRef = useRef(null);
  const phaseRef = useRef('idle');

  const setPhase = (p) => { phaseRef.current = p; setPhaseState(p); };


  // Auto-start from RundeScreen print trigger
  useEffect(() => {
    if (!autoTimerTrigger) return;
    setRunning(false);
    clearInterval(intervalRef.current);
    setPhase('warmup');
    setTimerDurchgang(autoTimerTrigger.durchgang);
    setSecondsLeft(WARMUP_SECONDS);
    setWarned(false);
    setPhaseComplete(null);
    setRunning(true);
  }, [autoTimerTrigger]);

  // Auto-advance warmup → game
  useEffect(() => {
    if (phaseComplete === 'warmup') {
      setPhase('game');
      setSecondsLeft(DEFAULT_SECONDS);
      setWarned(false);
      setPhaseComplete(null);
      setRunning(true);
    } else if (phaseComplete === 'game') {
      setPhaseComplete(null);
    }
  }, [phaseComplete]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            clearInterval(intervalRef.current);
            setRunning(false);
            const currentPhase = phaseRef.current;
            if (currentPhase === 'warmup') {
              Vibration.vibrate([0, 300, 100, 300, 100, 300]);
              setPhaseComplete('warmup');
            } else {
              Vibration.vibrate([0, 400, 100, 400]);
              setPhaseComplete('game');
            }
            return 0;
          }
          if (phaseRef.current === 'game' && s === WARNING_SECONDS + 1 && !warned) {
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

  const skipCurrent = () => {
    clearInterval(intervalRef.current);
    setRunning(false);
    if (phaseRef.current === 'warmup') {
      Vibration.vibrate([0, 300, 100, 300, 100, 300]);
      setPhaseComplete('warmup');
    } else if (phaseRef.current === 'game') {
      Vibration.vibrate([0, 400, 100, 400]);
      setSecondsLeft(0);
      setPhaseComplete('game');
    }
  };

  const reset = () => {
    setRunning(false);
    setPhase('idle');
    setTimerDurchgang(null);
    setSecondsLeft(DEFAULT_SECONDS);
    setWarned(false);
    setPhaseComplete(null);
  };

  const mins = Math.floor(secondsLeft / 60).toString().padStart(2, '0');
  const secs = (secondsLeft % 60).toString().padStart(2, '0');
  const isWarning = phase === 'game' && secondsLeft <= WARNING_SECONDS && secondsLeft > 0;
  const isFinished = secondsLeft === 0 && phase !== 'idle';

  const phaseColor = phase === 'warmup' ? colors.success
    : isFinished ? colors.error
    : isWarning ? colors.warning
    : phase === 'game' ? colors.gold
    : colors.gold;

  const ringColor = phase === 'warmup' ? colors.success + '60'
    : isFinished ? colors.error + '60'
    : isWarning ? colors.warning + '60'
    : colors.borderGoldGlow;

  const totalSeconds = phase === 'warmup' ? WARMUP_SECONDS : DEFAULT_SECONDS;
  const progress = phase === 'idle' ? 1 : secondsLeft / totalSeconds;
  const progressPct = Math.round(progress * 100);

  const phaseLabel = phase === 'warmup' ? 'EINSPIELEN'
    : phase === 'game' ? 'SPIELZEIT'
    : 'BEREIT';

  const phaseHint = phase === 'warmup' ? '3 Min. Einspielen'
    : phase === 'game' ? '20 Min. Spielzeit'
    : 'Warte auf Rundenstart';

  return (
    <View style={[shared.screen, s.screen]}>
      <Text style={s.title}>Timer</Text>

      {/* Phase banner */}
      {phase !== 'idle' && (
        <View style={[s.phaseBanner, { borderColor: phaseColor + '50', backgroundColor: phaseColor + '15' }]}>
          <Ionicons
            name={phase === 'warmup' ? 'fitness-outline' : 'tennisball-outline'}
            size={14}
            color={phaseColor}
          />
          <Text style={[s.phaseBannerText, { color: phaseColor }]}>
            {phaseLabel}{timerDurchgang ? ` — Durchgang ${timerDurchgang}` : ''}
          </Text>
          {isFinished && (
            <View style={s.finishedBadge}>
              <Text style={s.finishedBadgeText}>FERTIG</Text>
            </View>
          )}
        </View>
      )}

      {/* Timer Ring */}
      <View style={[s.ringOuter, { borderColor: ringColor }, isFinished && s.ringFinished]}>
        <View style={s.ringInner}>
          <Text style={[s.timerText, { color: phaseColor }]}>
            {mins}:{secs}
          </Text>
          <Text style={[s.statusText, { color: running ? phaseColor : isFinished ? colors.error : colors.textMuted }]}>
            {isFinished ? 'ZEIT!' : running ? phaseLabel : phase === 'idle' ? 'BEREIT' : 'PAUSE'}
          </Text>
          {isWarning && !isFinished && (
            <Text style={s.warningText}>5 Min. Rest</Text>
          )}
          {phase === 'warmup' && !isFinished && (
            <Text style={[s.phaseHintText, { color: colors.success + 'AA' }]}>→ danach 20 Min.</Text>
          )}
        </View>
      </View>

      {/* Progress Bar */}
      <View style={s.progressBar}>
        <View style={[s.progressFill, { width: `${progressPct}%`, backgroundColor: phaseColor }]} />
      </View>
      <Text style={s.progressLabel}>{phaseHint}  ·  {progressPct}%</Text>

      {/* Controls */}
      <View style={s.controls}>
        <TouchableOpacity
          style={[s.ctrlBtn, running && s.ctrlBtnActive]}
          onPress={() => {
            if (phase === 'idle') setPhase('game');
            setRunning((r) => !r);
          }}
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

      {/* Skip button — only visible during active phase */}
      {phase !== 'idle' && !isFinished && (
        <TouchableOpacity style={s.skipBtn} onPress={skipCurrent} activeOpacity={0.75}>
          <Ionicons name="play-skip-forward" size={15} color={colors.textMuted} />
          <Text style={s.skipBtnText}>
            {phase === 'warmup' ? 'Einspielen überspringen → Spielzeit starten' : 'Spielzeit überspringen'}
          </Text>
        </TouchableOpacity>
      )}

      <Text style={s.hint}>
        {phase === 'idle'
          ? 'Startet automatisch nach dem Drucken der Durchgänge'
          : 'Vibration bei Phasenwechsel, 5 Min. Rest & Ende'}
      </Text>
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
    marginBottom: 12,
  },
  phaseBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginBottom: 12,
  },
  phaseBannerText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
    flex: 1,
  },
  finishedBadge: {
    backgroundColor: colors.error,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  finishedBadgeText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
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
  phaseHintText: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 6,
    letterSpacing: 0.3,
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
    marginBottom: 28,
  },
  controls: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
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
  skipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.panel,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 16,
  },
  skipBtnText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  hint: {
    color: colors.textDim,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
  },
});
