import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Vibration, TextInput, ScrollView, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useEntranceAnimation } from '../hooks/useEntranceAnimation';
import { colors } from '../theme/colors';
import { shared, goldGlowShadow, cardShadow } from '../theme/styles';
import { useTournament } from '../store/tournament';
import {
  initiateLogin, isConnected, disconnect, spotifyPlay, spotifyPause, getClientId, getRedirectUriDisplay,
} from '../services/spotify';

const PREP_SECONDS = 60;          // 1 Min. Blätter anschauen, keine Musik
const WARMUP_SECONDS = 3 * 60;
const FIRST_ROUND_WARMUP_SECONDS = 5 * 60;
const DEFAULT_SECONDS = 20 * 60;
const WARNING_SECONDS = 60; // letzte Minute

export default function TimerScreen() {
  const { autoTimerTrigger, timerResetTrigger } = useTournament();
  const [phase, setPhaseState] = useState('idle');
  const [timerDurchgang, setTimerDurchgang] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_SECONDS);
  const [running, setRunning] = useState(false);
  const [warned, setWarned] = useState(false);
  const [phaseComplete, setPhaseComplete] = useState(null);
  const [speed, setSpeed] = useState(1);
  const [warmupSeconds, setWarmupSeconds] = useState(WARMUP_SECONDS);
  const intervalRef = useRef(null);
  const phaseRef = useRef('idle');
  const speedRef = useRef(1);

  // Spotify
  const [spConnected, setSpConnected] = useState(false);
  const [clientIdInput, setClientIdInput] = useState('');
  const [showSpotify, setShowSpotify] = useState(false);

  useEffect(() => {
    setSpConnected(isConnected());
    setClientIdInput(getClientId());
  }, []);

  const sp = (fn) => { if (isConnected()) fn(); };

  const setPhase = (p) => { phaseRef.current = p; setPhaseState(p); };

  const SPEED_STEPS = [1, 2, 3, 4, 5, 10, 15, 20];
  const cycleSpeed = () => {
    const idx = SPEED_STEPS.indexOf(speed);
    const next = SPEED_STEPS[(idx + 1) % SPEED_STEPS.length];
    speedRef.current = next;
    setSpeed(next);
  };

  // Auto-start from RundeScreen print trigger
  useEffect(() => {
    if (!autoTimerTrigger) return;
    const warmup = autoTimerTrigger.isFirstRound ? FIRST_ROUND_WARMUP_SECONDS : WARMUP_SECONDS;
    const isDurchgang2 = autoTimerTrigger.durchgang === 2;
    setRunning(false);
    clearInterval(intervalRef.current);
    setTimerDurchgang(autoTimerTrigger.durchgang);
    setWarmupSeconds(warmup);
    setWarned(false);
    setPhaseComplete(null);
    speedRef.current = 1;
    setSpeed(1);
    if (isDurchgang2) {
      // Auslosung bereits gedruckt — direkt Einspielzeit starten
      setPhase('warmup');
      setSecondsLeft(warmup);
      sp(spotifyPlay);
    } else {
      setPhase('prep'); // 1 Min. Blätter anschauen, bevor Einspielen beginnt
      setSecondsLeft(PREP_SECONDS);
      // Keine Musik während Vorbereitung
    }
    setRunning(true);
  }, [autoTimerTrigger]);

  // Reset timer to idle when tournament is reset
  useEffect(() => {
    if (!timerResetTrigger) return;
    clearInterval(intervalRef.current);
    setRunning(false);
    setPhase('idle');
    setTimerDurchgang(null);
    setSecondsLeft(DEFAULT_SECONDS);
    setWarned(false);
    setPhaseComplete(null);
    speedRef.current = 1;
    setSpeed(1);
    sp(spotifyPause);
  }, [timerResetTrigger]);

  // Phase transitions + Spotify
  useEffect(() => {
    if (phaseComplete === 'prep') {
      // 1 Min. vorbei → Einspielen starten + Musik an
      Vibration.vibrate(200);
      setPhase('warmup');
      setSecondsLeft(warmupSeconds);
      setPhaseComplete(null);
      setRunning(true);
      sp(spotifyPlay);
    } else if (phaseComplete === 'warmup') {
      sp(spotifyPause); // Musik aus = Signal: Spiel beginnt!
      setPhase('game');
      setSecondsLeft(DEFAULT_SECONDS);
      setWarned(false);
      setPhaseComplete(null);
      setRunning(true);
    } else if (phaseComplete === 'game') {
      sp(spotifyPause); // Musik aus = Spiel vorbei
      setPhaseComplete(null);
    }
  }, [phaseComplete]);

  // Letzte Minute → Vibration + Musik an (eigener Effect, kein stale closure)
  useEffect(() => {
    if (phase === 'game' && running && secondsLeft <= WARNING_SECONDS && secondsLeft > 0 && !warned) {
      setWarned(true);
      Vibration.vibrate(200);
      sp(spotifyPlay);
    }
  }, [secondsLeft]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          const next = s - speedRef.current;
          if (next <= 0) {
            clearInterval(intervalRef.current);
            setRunning(false);
            const currentPhase = phaseRef.current;
            if (currentPhase === 'prep') {
              setPhaseComplete('prep');
            } else if (currentPhase === 'warmup') {
              Vibration.vibrate([0, 300, 100, 300, 100, 300]);
              setPhaseComplete('warmup');
            } else {
              Vibration.vibrate([0, 400, 100, 400]);
              setPhaseComplete('game');
            }
            return 0;
          }
          return next;
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
    if (phaseRef.current === 'prep') {
      setPhaseComplete('prep');
    } else if (phaseRef.current === 'warmup') {
      Vibration.vibrate([0, 300, 100, 300, 100, 300]);
      sp(spotifyPause);
      setPhaseComplete('warmup');
    } else if (phaseRef.current === 'game') {
      Vibration.vibrate([0, 400, 100, 400]);
      sp(spotifyPause);
      setSecondsLeft(0);
      setPhaseComplete('game');
    }
  };

  const reset = () => {
    setRunning(false);
    sp(spotifyPause);
    setPhase('idle');
    setTimerDurchgang(null);
    setSecondsLeft(DEFAULT_SECONDS);
    setWarned(false);
    setPhaseComplete(null);
    speedRef.current = 1;
    setSpeed(1);
  };

  const handleConnectSpotify = () => {
    if (!clientIdInput.trim()) return;
    initiateLogin(clientIdInput.trim());
  };

  const handleDisconnect = () => {
    disconnect();
    setSpConnected(false);
    setClientIdInput('');
  };

  const mins = Math.floor(secondsLeft / 60).toString().padStart(2, '0');
  const secs = (secondsLeft % 60).toString().padStart(2, '0');
  const isWarning = phase === 'game' && secondsLeft <= WARNING_SECONDS && secondsLeft > 0;
  const isFinished = secondsLeft === 0 && phase !== 'idle';

  const phaseColor = phase === 'prep' ? colors.silver
    : phase === 'warmup' ? colors.success
    : isFinished ? colors.error
    : isWarning ? colors.warning
    : phase === 'game' ? colors.gold
    : colors.gold;

  const ringColor = phase === 'prep' ? colors.silver + '40'
    : phase === 'warmup' ? colors.success + '60'
    : isFinished ? colors.error + '60'
    : isWarning ? colors.warning + '60'
    : colors.borderGoldGlow;

  const totalSeconds = phase === 'prep' ? PREP_SECONDS : phase === 'warmup' ? warmupSeconds : DEFAULT_SECONDS;
  const progress = phase === 'idle' ? 1 : secondsLeft / totalSeconds;
  const progressPct = Math.round(progress * 100);

  const phaseLabel = phase === 'prep' ? 'VORBEREITUNG'
    : phase === 'warmup' ? 'EINSPIELEN'
    : phase === 'game' ? 'SPIELZEIT'
    : 'BEREIT';

  const phaseHint = phase === 'prep' ? '1 Min. Blätter anschauen'
    : phase === 'warmup' ? `${warmupSeconds / 60} Min. Einspielen`
    : phase === 'game' ? '20 Min. Spielzeit'
    : 'Warte auf Rundenstart';

  const entranceStyle = useEntranceAnimation();

  const RING_SIZE = 240;
  const RING_CENTER = RING_SIZE / 2;
  const RING_RADIUS = 98;
  const TRACK_RADIUS = 98;
  const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
  const dashOffset = CIRCUMFERENCE * (1 - progress);

  return (
    <Animated.View style={[{ flex: 1 }, entranceStyle]}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={[shared.screen, s.screen]} showsVerticalScrollIndicator={false}>
      <Text style={s.title}>Timer</Text>

      {/* Phase banner */}
      {phase !== 'idle' && (
        <View style={[s.phaseBanner, { borderColor: phaseColor + '40', backgroundColor: phaseColor + '12' }]}>
          <Ionicons
            name={phase === 'prep' ? 'document-text-outline' : phase === 'warmup' ? 'fitness-outline' : 'tennisball-outline'}
            size={13}
            color={phaseColor}
          />
          <Text style={[s.phaseBannerText, { color: phaseColor }]}>
            {phaseLabel}{timerDurchgang ? ` — Durchgang ${timerDurchgang}` : ''}
          </Text>
          {isFinished && (
            <View style={[s.finishedBadge, { backgroundColor: colors.error }]}>
              <Text style={s.finishedBadgeText}>FERTIG</Text>
            </View>
          )}
        </View>
      )}

      {/* ── SVG Timer Ring ── */}
      <View style={s.ringContainer}>
        <Svg width={RING_SIZE} height={RING_SIZE} style={{ position: 'absolute' }}>
          <Defs>
            <RadialGradient id="timerGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%"   stopColor={phaseColor} stopOpacity={isFinished ? '0.2' : running ? '0.12' : '0.06'} />
              <Stop offset="100%" stopColor={phaseColor} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          {/* Ambient glow */}
          <Circle cx={RING_CENTER} cy={RING_CENTER} r={RING_RADIUS + 28} fill="url(#timerGlow)" />
          {/* Background track */}
          <Circle
            cx={RING_CENTER} cy={RING_CENTER} r={TRACK_RADIUS}
            stroke={phaseColor + '18'} strokeWidth={7} fill="none"
          />
          {/* Progress arc — counterclockwise from top */}
          <Circle
            cx={RING_CENTER} cy={RING_CENTER} r={RING_RADIUS}
            stroke={phaseColor}
            strokeWidth={7}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${RING_CENTER} ${RING_CENTER})`}
            opacity={phase === 'idle' ? 0.25 : 1}
          />
        </Svg>

        {/* Center content */}
        <View style={s.ringInner}>
          <Text style={[s.timerText, { color: phaseColor }]}>{mins}:{secs}</Text>
          <Text style={[s.statusText, { color: running ? phaseColor : isFinished ? colors.error : colors.textMuted }]}>
            {isFinished ? 'ZEIT!' : running ? phaseLabel : phase === 'idle' ? 'BEREIT' : 'PAUSE'}
          </Text>
          {isWarning && !isFinished && (
            <Text style={s.warningText}>⚡ 1 Min. Rest</Text>
          )}
          {phase === 'prep' && !isFinished && (
            <Text style={[s.phaseHintText, { color: colors.textMuted }]}>
              dann {warmupSeconds / 60} Min. einspielen
            </Text>
          )}
          {phase === 'warmup' && !isFinished && (
            <Text style={[s.phaseHintText, { color: colors.textMuted }]}>
              danach 20 Min. Spielzeit
            </Text>
          )}
        </View>
      </View>

      <Text style={s.progressLabel}>{phaseHint}  ·  {progressPct}%</Text>

      {/* ── Controls ── */}
      <View style={s.controls}>
        <TouchableOpacity
          style={[s.ctrlBtn, running && s.ctrlBtnActive]}
          onPress={() => {
            if (phase === 'idle') setPhase('game');
            setRunning((r) => !r);
          }}
          activeOpacity={0.8}
        >
          <Ionicons name={running ? 'pause' : 'play'} size={22} color={running ? colors.bg : colors.gold} />
          <Text style={[s.ctrlLabel, running && s.ctrlLabelActive]}>
            {running ? 'Pause' : 'Start'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.ctrlBtn} onPress={reset} activeOpacity={0.8}>
          <Ionicons name="refresh" size={20} color={colors.silver} />
          <Text style={s.ctrlLabel}>Reset</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.ctrlBtn, s.ctrlBtnStop]}
          onPress={() => { setRunning(false); sp(spotifyPause); setSecondsLeft(0); }}
          activeOpacity={0.8}
        >
          <Ionicons name="stop" size={20} color={colors.error} />
          <Text style={[s.ctrlLabel, { color: colors.error + 'BB' }]}>Stop</Text>
        </TouchableOpacity>
      </View>

      {/* Skip button */}
      {phase !== 'idle' && !isFinished && (
        <TouchableOpacity style={s.skipBtn} onPress={skipCurrent} activeOpacity={0.75}>
          <Ionicons name="play-skip-forward" size={15} color={colors.textMuted} />
          <Text style={s.skipBtnText}>
            {phase === 'prep' ? 'Vorbereitung überspringen → Einspielen starten'
              : phase === 'warmup' ? 'Einspielen überspringen → Spielzeit starten'
              : 'Spielzeit überspringen'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Speed button */}
      <TouchableOpacity style={s.speedBtn} onPress={cycleSpeed} activeOpacity={0.75}>
        <Ionicons name="speedometer-outline" size={14} color={speed > 1 ? colors.warning : colors.textMuted} />
        <Text style={[s.speedBtnText, speed > 1 && { color: colors.warning }]}>
          {speed}×
        </Text>
        <Text style={s.speedBtnHint}>Geschwindigkeit</Text>
      </TouchableOpacity>

      <Text style={s.hint}>
        {phase === 'idle'
          ? 'Startet automatisch nach dem Drucken der Durchgänge'
          : phase === 'prep'
          ? 'Blätter anschauen — Einspielen startet danach automatisch'
          : 'Vibration bei Phasenwechsel, 1 Min. Rest & Ende'}
      </Text>

      {/* ── Spotify Card ── */}
      <TouchableOpacity
        style={s.spHeader}
        onPress={() => setShowSpotify((v) => !v)}
        activeOpacity={0.8}
      >
        <Ionicons name="musical-notes" size={14} color={spConnected ? '#1DB954' : colors.textMuted} />
        <Text style={[s.spHeaderText, spConnected && { color: '#1DB954' }]}>
          {spConnected ? 'Spotify verbunden' : 'Spotify verbinden'}
        </Text>
        {spConnected && <View style={s.spDot} />}
        <Ionicons
          name={showSpotify ? 'chevron-up' : 'chevron-down'}
          size={13}
          color={colors.textMuted}
        />
      </TouchableOpacity>

      {showSpotify && (
        <View style={s.spCard}>
          {spConnected ? (
            <>
              <Text style={s.spInfoText}>
                Spotify steuert Musik automatisch:{'\n'}
                • Einspielen → Musik startet{'\n'}
                • Einspielen endet → Musik stoppt (Signal: Spiel beginnt){'\n'}
                • Letzte Minute → Musik startet erneut{'\n'}
                • Spiel endet → Musik stoppt
              </Text>
              <Text style={s.spInfoHint}>
                Starte Spotify auf deinem Gerät und wähle einen Song/Playlist — die App übernimmt die Steuerung.
              </Text>
              <TouchableOpacity style={s.spDisconnectBtn} onPress={handleDisconnect} activeOpacity={0.8}>
                <Ionicons name="unlink-outline" size={13} color={colors.error} />
                <Text style={s.spDisconnectText}>Trennen</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={s.spSetupText}>
                1. Gehe zu{' '}
                <Text style={s.spLink}>developer.spotify.com</Text>
                {' '}→ „Create App"{'\n'}
                2. Redirect URI <Text style={{fontWeight:'800'}}>exakt so</Text> eintragen:
              </Text>
              <View style={s.spUriBox}>
                <Text style={s.spUriText} selectable>{getRedirectUriDisplay()}</Text>
              </View>
              <Text style={s.spSetupText}>3. Client ID hier einfügen:</Text>
              <TextInput
                style={s.spInput}
                value={clientIdInput}
                onChangeText={setClientIdInput}
                placeholder="Spotify Client ID"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={[s.spConnectBtn, !clientIdInput.trim() && { opacity: 0.4 }]}
                onPress={handleConnectSpotify}
                activeOpacity={0.8}
                disabled={!clientIdInput.trim()}
              >
                <Ionicons name="logo-google-playstore" size={14} color="#fff" />
                <Text style={s.spConnectText}>Mit Spotify verbinden</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      <View style={{ height: 24 }} />
    </ScrollView>
    </Animated.View>
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
  ringContainer: {
    width: 240,
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  ringInner: {
    width: 240,
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
  },
  timerText: {
    fontSize: 54,
    fontFamily: 'BarlowCondensed_700Bold',
    letterSpacing: 3,
  },
  statusText: {
    fontSize: 11,
    fontFamily: 'BarlowCondensed_600SemiBold',
    letterSpacing: 2.5,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  warningText: {
    color: colors.warning,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
    letterSpacing: 0.5,
  },
  phaseHintText: {
    fontSize: 10,
    fontWeight: '400',
    marginTop: 5,
    letterSpacing: 0.3,
  },
  progressLabel: {
    color: colors.textDim,
    fontSize: 10,
    fontFamily: 'BarlowCondensed_600SemiBold',
    letterSpacing: 1,
    marginBottom: 24,
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
  speedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.panel,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 12,
    alignSelf: 'center',
  },
  speedBtnText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '800',
    minWidth: 24,
    textAlign: 'center',
  },
  speedBtnHint: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '500',
  },
  hint: {
    color: colors.textDim,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
    marginBottom: 24,
  },

  // Spotify
  spHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    backgroundColor: colors.panel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 2,
  },
  spHeaderText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  spDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#1DB954',
  },
  spCard: {
    width: '100%',
    backgroundColor: colors.panel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopWidth: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    padding: 14,
    gap: 10,
  },
  spInfoText: {
    color: colors.silver,
    fontSize: 12,
    lineHeight: 20,
    fontWeight: '500',
  },
  spInfoHint: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 17,
    fontStyle: 'italic',
  },
  spDisconnectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.error + '18',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.error + '35',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  spDisconnectText: {
    color: colors.error,
    fontSize: 12,
    fontWeight: '700',
  },
  spSetupText: {
    color: colors.silver,
    fontSize: 12,
    lineHeight: 20,
  },
  spLink: {
    color: colors.gold,
    fontWeight: '700',
  },
  spUriBox: {
    backgroundColor: colors.bg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.gold + '60',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  spUriText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  spInput: {
    backgroundColor: colors.bg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.white,
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: 'monospace',
  },
  spConnectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1DB954',
    borderRadius: 10,
    paddingVertical: 12,
  },
  spConnectText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
