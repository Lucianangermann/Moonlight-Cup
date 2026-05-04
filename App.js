import { Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';

import { TournamentProvider } from './src/store/tournament';
import { colors } from './src/theme/colors';

import RundeScreen from './src/screens/RundeScreen';
import ErgebnisseScreen from './src/screens/ErgebnisseScreen';
import RanglisteScreen from './src/screens/RanglisteScreen';
import TeilnehmerScreen from './src/screens/TeilnehmerScreen';
import TimerScreen from './src/screens/TimerScreen';

const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  Runde: '🏸',
  Ergebnisse: '📊',
  Rangliste: '🏆',
  Teilnehmer: '👥',
  Timer: '⏱️',
};

export default function App() {
  return (
    <TournamentProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarIcon: ({ focused }) => (
              <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>
                {TAB_ICONS[route.name]}
              </Text>
            ),
            tabBarLabel: ({ focused }) => (
              <Text style={{
                fontSize: 10,
                color: focused ? colors.gold : colors.textMuted,
                fontWeight: focused ? '700' : '400',
                marginBottom: 4,
              }}>
                {route.name}
              </Text>
            ),
            tabBarStyle: {
              backgroundColor: colors.panel,
              borderTopColor: colors.border,
              borderTopWidth: 1,
              height: 64,
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
