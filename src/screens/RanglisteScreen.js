import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useState } from 'react';
import { colors } from '../theme/colors';
import { useTournament } from '../store/tournament';

const medals = ['🥇', '🥈', '🥉'];

export default function RanglisteScreen() {
  const { getStandings } = useTournament();
  const [selected, setSelected] = useState(null);
  const standings = getStandings();

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>🏆 Rangliste</Text>
        <View style={s.liveBadge}><Text style={s.liveText}>● LIVE</Text></View>
      </View>

      <View style={s.tableHeader}>
        <Text style={[s.col, s.colRank]}>#</Text>
        <Text style={[s.col, s.colName]}>Name</Text>
        <Text style={[s.col, s.colNum]}>Pkt</Text>
        <Text style={[s.col, s.colNum]}>Siege</Text>
        <Text style={[s.col, s.colNum]}>Spiele</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {standings.map((p, i) => (
          <TouchableOpacity
            key={p.id}
            style={[s.row, selected === p.id && s.rowSelected]}
            onPress={() => setSelected(selected === p.id ? null : p.id)}
          >
            <Text style={[s.col, s.colRank, s.rankText]}>
              {medals[i] ?? i + 1}
            </Text>
            <Text style={[s.col, s.colName, s.nameText, i === 0 && s.gold]}>
              {p.name}
            </Text>
            <Text style={[s.col, s.colNum, s.numText, s.gold]}>{p.points}</Text>
            <Text style={[s.col, s.colNum, s.numText]}>{p.wins}</Text>
            <Text style={[s.col, s.colNum, s.numText]}>{p.games}</Text>
          </TouchableOpacity>
        ))}

        {selected && (() => {
          const p = standings.find((x) => x.id === selected);
          return p ? (
            <View style={s.detailCard}>
              <Text style={s.detailName}>📈 {p.name}</Text>
              <Text style={s.detailStat}>{p.games} Spiele · {p.wins} Siege · {p.points} Pkt</Text>
              <Text style={s.detailStat}>Punkte-Diff: {p.diff > 0 ? '+' : ''}{p.diff}</Text>
            </View>
          ) : null;
        })()}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16, paddingTop: 56 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title: { color: colors.white, fontSize: 22, fontWeight: '800' },
  liveBadge: { backgroundColor: colors.error + '22', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  liveText: { color: colors.error, fontSize: 12, fontWeight: '700' },
  tableHeader: { flexDirection: 'row', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border + '55' },
  rowSelected: { backgroundColor: colors.panel, borderRadius: 10 },
  col: { paddingHorizontal: 4 },
  colRank: { width: 36 },
  colName: { flex: 1 },
  colNum: { width: 50, textAlign: 'right' },
  rankText: { fontSize: 16 },
  nameText: { color: colors.silver, fontSize: 14, fontWeight: '600' },
  numText: { color: colors.silver, fontSize: 14 },
  gold: { color: colors.gold },
  detailCard: { backgroundColor: colors.panel, borderRadius: 12, padding: 16, marginTop: 16, borderWidth: 1, borderColor: colors.gold + '44' },
  detailName: { color: colors.gold, fontSize: 16, fontWeight: '700', marginBottom: 6 },
  detailStat: { color: colors.silver, fontSize: 14, marginBottom: 2 },
});
