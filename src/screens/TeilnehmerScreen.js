import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { colors } from '../theme/colors';
import { useTournament } from '../store/tournament';

export default function TeilnehmerScreen() {
  const { participants, addParticipant, removeParticipant, getStandings } = useTournament();
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const standings = getStandings();

  const getRank = (id) => {
    const idx = standings.findIndex((s) => s.id === id);
    return idx === -1 ? '-' : `#${idx + 1}`;
  };

  const getWins = (id) => standings.find((s) => s.id === id)?.wins ?? 0;

  const filtered = participants.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = () => {
    if (!newName.trim()) return;
    if (participants.length >= 99) {
      Alert.alert('Maximum erreicht', 'Es können maximal 99 Teilnehmer teilnehmen.');
      return;
    }
    addParticipant(newName.trim());
    setNewName('');
    setShowAdd(false);
  };

  const handleRemove = (p) => {
    Alert.alert('Entfernen', `${p.name} wirklich entfernen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Entfernen', style: 'destructive', onPress: () => removeParticipant(p.id) },
    ]);
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>👥 Teilnehmer</Text>
        <TouchableOpacity
          style={[s.addBtn, participants.length >= 99 && s.addBtnDisabled]}
          onPress={() => setShowAdd(true)}
          disabled={participants.length >= 99}
        >
          <Text style={[s.addBtnText, participants.length >= 99 && s.addBtnTextDisabled]}>
            {participants.length >= 99 ? 'Max. 99' : '+ Neu'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={s.searchBox}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput
          style={s.searchInput} placeholder="Suchen..." placeholderTextColor={colors.textMuted}
          value={search} onChangeText={setSearch}
        />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {filtered.map((p) => (
          <TouchableOpacity key={p.id} style={s.card} onLongPress={() => handleRemove(p)}>
            <View style={s.avatar}><Text style={s.avatarText}>{p.name[0]}</Text></View>
            <View style={s.cardInfo}>
              <Text style={s.cardName}>{p.name}</Text>
              <Text style={s.cardSub}>{getRank(p.id)} · {getWins(p.id)} Siege</Text>
            </View>
          </TouchableOpacity>
        ))}
        <Text style={s.total}>Gesamt: {participants.length} Teilnehmer</Text>
        <Text style={s.hint}>Lang gedrückt halten zum Entfernen</Text>
      </ScrollView>

      <TouchableOpacity
        style={[s.fabButton, participants.length >= 99 && s.fabButtonDisabled]}
        onPress={() => setShowAdd(true)}
        disabled={participants.length >= 99}
      >
        <Text style={s.fabText}>
          {participants.length >= 99 ? '👥 MAXIMUM ERREICHT (99)' : '👤+  TEILNEHMER HINZUFÜGEN'}
        </Text>
      </TouchableOpacity>

      <Modal visible={showAdd} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalBg}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>Neuer Teilnehmer</Text>
            <TextInput
              style={s.input} placeholder="Name (z.B. Müller, Max)"
              placeholderTextColor={colors.textMuted} value={newName}
              onChangeText={setNewName} autoFocus
            />
            <TouchableOpacity style={s.saveBtn} onPress={handleAdd}>
              <Text style={s.saveBtnText}>SPEICHERN</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowAdd(false)}>
              <Text style={s.cancelText}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16, paddingTop: 56 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { color: colors.white, fontSize: 22, fontWeight: '800' },
  addBtn: { backgroundColor: colors.panel, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: colors.gold },
  addBtnText: { color: colors.gold, fontSize: 14, fontWeight: '600' },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.panel, borderRadius: 12, paddingHorizontal: 12, marginBottom: 16 },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, color: colors.white, fontSize: 14, paddingVertical: 12 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.panel, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.gold + '33', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { color: colors.gold, fontSize: 16, fontWeight: '700' },
  cardInfo: { flex: 1 },
  cardName: { color: colors.white, fontSize: 15, fontWeight: '600' },
  cardSub: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  total: { color: colors.textMuted, fontSize: 13, marginTop: 8 },
  hint: { color: colors.border, fontSize: 11, marginTop: 4, marginBottom: 80 },
  fabButton: { backgroundColor: colors.gold, borderRadius: 12, padding: 16, alignItems: 'center', marginVertical: 16 },
  fabButtonDisabled: { backgroundColor: colors.border },
  fabText: { color: colors.bg, fontSize: 14, fontWeight: '800' },
  addBtnDisabled: { borderColor: colors.border },
  addBtnTextDisabled: { color: colors.textMuted },
  modalBg: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { backgroundColor: colors.panel, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  sheetTitle: { color: colors.white, fontSize: 18, fontWeight: '800', marginBottom: 16 },
  input: { backgroundColor: colors.bg, color: colors.white, fontSize: 16, borderRadius: 12, padding: 14, marginBottom: 16 },
  saveBtn: { backgroundColor: colors.gold, borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12 },
  saveBtnText: { color: colors.bg, fontSize: 15, fontWeight: '800' },
  cancelText: { color: colors.textMuted, textAlign: 'center', fontSize: 14, paddingVertical: 8 },
});
