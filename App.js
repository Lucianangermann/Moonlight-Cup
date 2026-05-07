import { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { handleCallback } from './src/services/spotify';

import { TournamentProvider } from './src/store/tournament';
import { colors } from './src/theme/colors';

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

export default function App() {
  useEffect(() => { handleCallback(); }, []);

  return (
    <TournamentProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <Tab.Navigator
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
              fontWeight: '600',
              marginBottom: 4,
              letterSpacing: 0.3,
            },
            tabBarStyle: {
              backgroundColor: colors.panel,
              borderTopColor: colors.border,
              borderTopWidth: 1,
              height: 68,
              paddingTop: 8,
            },
          })}
        >
          <Tab.Screen name="Runde" component={RundeScreen} />
          <Tab.Screen name="Ergebnisse" component={ErgebnisseScreen} />
          <Tab.Screen name="Rangliste" component={RanglisteScreen} />
          <Tab.Screen name="Teilnehmer" component={TeilnehmerScreen} />
          <Tab.Screen name="Timer" component={TimerScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </TournamentProvider>
  );
}
