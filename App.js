import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useFonts, BarlowCondensed_700Bold, BarlowCondensed_600SemiBold } from '@expo-google-fonts/barlow-condensed';
import { Barlow_400Regular, Barlow_600SemiBold } from '@expo-google-fonts/barlow';
import { handleCallback } from './src/services/spotify';
import { injectWebStyles } from './src/utils/webEnhancements';

import { TournamentProvider, useTournament } from './src/store/tournament';
import { AuthProvider, useAuth } from './src/store/auth';
import { colors } from './src/theme/colors';
import { shared, fonts } from './src/theme/styles';
import AtmosphericBackground from './src/components/AtmosphericBackground';
import AnimatedPressable from './src/components/AnimatedPressable';
import LoginScreen from './src/screens/LoginScreen';

import RundeScreen from './src/screens/RundeScreen';
import ErgebnisseScreen from './src/screens/ErgebnisseScreen';
import RanglisteScreen from './src/screens/RanglisteScreen';
import TeilnehmerScreen from './src/screens/TeilnehmerScreen';
import TimerScreen from './src/screens/TimerScreen';

const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  Runde:      { focused: 'grid',        outline: 'grid-outline' },
  Ergebnisse: { focused: 'bar-chart',   outline: 'bar-chart-outline' },
  Rangliste:  { focused: 'trophy',      outline: 'trophy-outline' },
  Teilnehmer: { focused: 'people',      outline: 'people-outline' },
  Timer:      { focused: 'timer',       outline: 'timer-outline' },
};

// Small always-visible entry point for the admin login — tabs stay purely
// content-oriented (viewers only ever see Ergebnisse/Rangliste/Timer tabs;
// Runde/Teilnehmer only render once isAdmin is true, see AppNavigator below).
function AdminAccessButton() {
  const { isAdmin, checked, logout } = useAuth();
  const [loginVisible, setLoginVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);

  if (!checked) return null;

  return (
    <>
      <AnimatedPressable
        style={s.lockButton}
        onPress={() => (isAdmin ? setConfirmVisible(true) : setLoginVisible(true))}
        activeOpacity={0.7}
      >
        <Ionicons
          name={isAdmin ? 'lock-open' : 'lock-closed'}
          size={16}
          color={isAdmin ? colors.gold : colors.textMuted}
        />
      </AnimatedPressable>

      <LoginScreen visible={loginVisible} onClose={() => setLoginVisible(false)} />

      {confirmVisible && (
        <View style={s.confirmOverlay}>
          <View style={s.confirmCard}>
            <Text style={s.confirmTitle}>Als Admin abmelden?</Text>
            <AnimatedPressable
              style={shared.saveBtn}
              activeOpacity={0.8}
              onPress={() => { logout(); setConfirmVisible(false); }}
            >
              <Text style={shared.saveBtnText}>ABMELDEN</Text>
            </AnimatedPressable>
            <AnimatedPressable onPress={() => setConfirmVisible(false)} activeOpacity={0.7}>
              <Text style={shared.cancelText}>Abbrechen</Text>
            </AnimatedPressable>
          </View>
        </View>
      )}
    </>
  );
}

// Branded gate for the first ~seconds before the initial poll answers.
// Without it the app renders a confident "empty tournament" while loading,
// which reads as broken data rather than a loading state.
function LoadingSplash() {
  return (
    <View style={s.splash}>
      <Text style={s.splashGlyph}>☽</Text>
      <Text style={s.splashWordmark}>MOONLIGHT CUP</Text>
      <Text style={s.splashHint}>Verbinde…</Text>
    </View>
  );
}

function AppNavigator() {
  const { isAdmin } = useAuth();
  const { loaded } = useTournament();

  if (!loaded) return <LoadingSplash />;

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Tab.Navigator
        sceneContainerStyle={{ backgroundColor: 'transparent' }}
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ focused, size }) => {
            const icons = TAB_ICONS[route.name];
            const name = focused ? icons.focused : icons.outline;
            return (
              <Ionicons
                name={name}
                size={22}
                color={focused ? colors.gold : colors.textMuted}
              />
            );
          },
          tabBarLabel: route.name,
          tabBarActiveTintColor: colors.gold,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: {
            fontSize: 10,
            fontFamily: fonts.headingSemi,
            fontWeight: '600',
            marginBottom: 4,
            letterSpacing: 0.5,
          },
          tabBarStyle: {
            backgroundColor: colors.panel,
            borderTopColor: colors.borderStrong,
            borderTopWidth: 1,
            height: 68,
            paddingTop: 8,
          },
        })}
      >
        {isAdmin && <Tab.Screen name="Runde" component={RundeScreen} />}
        <Tab.Screen name="Ergebnisse" component={ErgebnisseScreen} />
        <Tab.Screen name="Rangliste" component={RanglisteScreen} />
        {isAdmin && <Tab.Screen name="Teilnehmer" component={TeilnehmerScreen} />}
        <Tab.Screen name="Timer" component={TimerScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    BarlowCondensed_700Bold,
    BarlowCondensed_600SemiBold,
    Barlow_400Regular,
    Barlow_600SemiBold,
  });

  useEffect(() => {
    handleCallback();
    injectWebStyles();
  }, []);

  return (
    <AuthProvider>
      <TournamentProvider>
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <AtmosphericBackground />
          <AppNavigator />
          <AdminAccessButton />
        </View>
      </TournamentProvider>
    </AuthProvider>
  );
}

const s = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashGlyph: {
    color: colors.gold,
    fontSize: 52,
    lineHeight: 60,
    marginBottom: 10,
  },
  splashWordmark: {
    color: colors.gold,
    fontSize: 17,
    fontFamily: fonts.heading,
    letterSpacing: 5,
    marginBottom: 20,
  },
  splashHint: {
    color: colors.textMuted,
    fontSize: 13,
  },
  lockButton: {
    // Vertically centered on the screens' header row (paddingTop 58 +
    // ~36pt title line → row center at ~76), sized to match the header
    // badges so it reads as part of that row, not a floating stray.
    position: 'absolute',
    top: 61,
    right: 18,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  confirmOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
    paddingHorizontal: 32,
  },
  confirmCard: {
    backgroundColor: colors.panelLight,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: 24,
    width: '100%',
    maxWidth: 360,
  },
  confirmTitle: {
    color: colors.white,
    fontSize: 18,
    fontFamily: fonts.heading,
    marginBottom: 16,
    textAlign: 'center',
  },
});
