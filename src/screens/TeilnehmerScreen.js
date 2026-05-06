import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { shared, cardShadow } from '../theme/styles';
import { useTournament, LEAGUES } from '../store/tournament';

export default function TeilnehmerScreen() {
  const { participants, addParticipant, removeParticipant, getStandings } = useTournament();
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGender, setNewGender] = useState('M');
  const [newLeague, setNewLeague] = useState('FZ');
  const standings = getStandings();

  const getRank = (id) => {
    const idx = standings.findIndex((s) => s.id === id);
    return idx === -1 ? '—' : `#${idx + 1}`;
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
    addParticipant(newName.trim(), newGender, newLeague);
    setNewName('');
    setNewGender('M');
    setNewLeague('FZ');
    setShowAdd(false);
  };

  const handleRemove = (p) => {
    Alert.alert('Entfernen', `${p.name} wirklich entfernen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Entfernen', style: 'destructive', onPress: () => removeParticipant(p.id) },
    ]);
  };

  const closeSheet = () => { setShowAdd(false); setNewName(''); setNewGender('M'); setNewLeague('FZ'); };
  const maxReached = participants.length >= 99;
  const menCount = participants.filter((p) => p.gender === 'M').length;
  const womenCount = participants.filter((p) => p.gender === 'F').length;

  return (
    <View style={shared.screen}>
      {/* Header */}
      <View style={s.header}>
        <Text style={shared.screenTitle}>Teilnehmer</Text>
        <TouchableOpacity
          style={[s.addBtn, maxReached && s.addBtnDisabled]}
          onPress={() => !maxReached && setShowAdd(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={18} color={maxReached ? colors.textMuted : colors.gold} />
          <Text style={[s.addBtnText, maxReached && s.addBtnTextDisabled]}>
            {maxReached ? 'Max 99' : 'Neu'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={s.statsRow}>
        <View style={s.statCard}>
          <Ionicons name="male" size={16} color={colors.info} />
          <Text style={s.statValue}>{menCount}</Text>
          <Text style={s.statLabel}>Herren</Text>
        </View>
        <View style={[s.statCard, s.statCardMid]}>
          <Ionicons name="female" size={16} color="#E879A0" />
          <Text style={s.statValue}>{womenCount}</Text>
          <Text style={s.statLabel}>Damen</Text>
        </View>
        <View style={s.statCard}>
          <Ionicons name="people" size={16} color={colors.gold} />
          <Text style={[s.statValue, { color: colors.gold }]}>{participants.length}</Text>
          <Text style={s.statLabel}>Gesamt</Text>
        </View>
      </View>

      {/* Search */}
      <View style={s.searchBox}>
        <Ionicons name="search-outline" size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
        <TextInput
          style={s.searchInput}
          placeholder="Name suchen..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* List */}
      <ScrollView showsVerticalScrollIndicator={false}>
        {filtered.length === 0 && (
          <View style={s.emptySearch}>
            <Ionicons name="search-outline" size={32} color={colors.textDim} />
            <Text style={s.emptySearchText}>Keine Teilnehmer gefunden</Text>
          </View>
        )}
        {filtered.map((p) => {
          const isFemale = p.gender === 'F';
          const accentColor = isFemale ? '#E879A0' : colors.info;
          return (
            <TouchableOpacity
              key={p.id}
              style={s.card}
              onLongPress={() => handleRemove(p)}
              activeOpacity={0.75}
            >
              <View style={[s.avatar, { backgroundColor: accentColor + '20', borderColor: accentColor + '40' }]}>
                <Text style={[s.avatarText, { color: accentColor }]}>
                  {p.name[0].toUpperCase()}
                </Text>
              </View>
              <View style={s.cardBody}>
                <View style={s.nameRow}>
                  <Text style={s.cardName} numberOfLines={1}>{p.name}</Text>
                  <View style={[s.genderBadge, { borderColor: accentColor + '50', backgroundColor: accentColor + '15' }]}>
                    <Ionicons name={isFemale ? 'female' : 'male'} size={10} color={accentColor} />
                  </View>
                  <View style={s.leagueBadge}>
                    <Text style={s.leagueBadgeText}>{p.league ?? 'FZ'}</Text>
                  </View>
                </View>
                <Text style={s.cardSub}>{getRank(p.id)}  ·  {getWins(p.id)} Siege</Text>
              </View>
              <Ionicons name="ellipsis-vertical" size={16} color={colors.textDim} />
            </TouchableOpacity>
          );
        })}
        <Text style={s.hint}>Lang gedrückt halten zum Entfernen</Text>
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={[shared.goldBtn, maxReached && shared.disabledBtn]}
        onPress={() => !maxReached && setShowAdd(true)}
        disabled={maxReached}
        activeOpacity={0.8}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons
            name={maxReached ? 'lock-closed-outline' : 'person-add-outline'}
            size={16}
            color={maxReached ? colors.textMuted : colors.bg}
          />
          <Text style={[shared.goldBtnText, maxReached && shared.disabledBtnText]}>
            {maxReached ? 'MAXIMUM ERREICHT (99)' : 'TEILNEHMER HINZUFÜGEN'}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Add Modal */}
      <Modal visible={showAdd} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={shared.modalBg}>
          <View style={shared.sheet}>
            <View style={s.sheetHeader}>
              <Text style={shared.sheetTitle}>Neuer Teilnehmer</Text>
              <TouchableOpacity onPress={closeSheet} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={shared.input}
              placeholder="Name (z.B. Müller, Max)"
              placeholderTextColor={colors.textMuted}
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />

            <Text style={s.genderLabel}>GESCHLECHT</Text>
            <View style={s.genderRow}>
              <TouchableOpacity
                style={[s.genderBtn, newGender === 'M' && s.genderBtnActiveM]}
                onPress={() => setNewGender('M')}
                activeOpacity={0.7}
              >
                <Ionicons name="male" size={18} color={newGender === 'M' ? colors.info : colors.textMuted} />
                <Text style={[s.genderBtnText, newGender === 'M' && { color: colors.white }]}>Herr</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.genderBtn, newGender === 'F' && s.genderBtnActiveF]}
                onPress={() => setNewGender('F')}
                activeOpacity={0.7}
              >
                <Ionicons name="female" size={18} color={newGender === 'F' ? '#E879A0' : colors.textMuted} />
                <Text style={[s.genderBtnText, newGender === 'F' && { color: colors.white }]}>Dame</Text>
              </TouchableOpacity>
            </View>

            <Text style={s.genderLabel}>LIGA</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.leagueScroll} contentContainerStyle={s.leagueScrollContent}>
              {LEAGUES.map((lg) => (
                <TouchableOpacity
                  key={lg.key}
                  style={[s.leagueBtn, newLeague === lg.key && s.leagueBtnActive]}
                  onPress={() => setNewLeague(lg.key)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.leagueBtnKey, newLeague === lg.key && s.leagueBtnKeyActive]}>{lg.key}</Text>
                  <Text style={[s.leagueBtnLabel, newLeague === lg.key && s.leagueBtnLabelActive]} numberOfLines={1}>{lg.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={shared.saveBtn} onPress={handleAdd} activeOpacity={0.8}>
              <Text style={shared.saveBtnText}>SPEICHERN</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={closeSheet} activeOpacity={0.7}>
              <Text style={shared.cancelText}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderGoldGlow,
    backgroundColor: colors.goldGlow,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  addBtnDisabled: {
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  addBtnText: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '700',
  },
  addBtnTextDisabled: {
    color: colors.textMuted,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.panel,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
    ...cardShadow,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    gap: 4,
  },
  statCardMid: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
  },
  statValue: {
    color: colors.silver,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    color: colors.white,
    fontSize: 14,
    paddingVertical: 13,
  },
  emptySearch: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptySearchText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 8,
    ...cardShadow,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 17,
    fontWeight: '700',
  },
  cardBody: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  cardName: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  genderBadge: {
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  cardSub: {
    color: colors.textMuted,
    fontSize: 12,
    letterSpacing: 0.3,
  },
  hint: {
    color: colors.textDim,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  genderLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  genderRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  genderBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 13,
  },
  genderBtnActiveM: {
    backgroundColor: colors.info + '15',
    borderColor: colors.info + '60',
  },
  genderBtnActiveF: {
    backgroundColor: '#E879A0' + '15',
    borderColor: '#E879A0' + '60',
  },
  genderBtnText: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '600',
  },
  leagueBadge: {
    backgroundColor: colors.goldGlow,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.borderGoldGlow,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  leagueBadgeText: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  leagueScroll: {
    marginBottom: 20,
  },
  leagueScrollContent: {
    gap: 8,
    paddingRight: 4,
  },
  leagueBtn: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 72,
  },
  leagueBtnActive: {
    backgroundColor: colors.goldGlow,
    borderColor: colors.borderGoldGlow,
  },
  leagueBtnKey: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  leagueBtnKeyActive: {
    color: colors.gold,
  },
  leagueBtnLabel: {
    color: colors.textDim,
    fontSize: 9,
    fontWeight: '500',
    marginTop: 2,
    textAlign: 'center',
  },
  leagueBtnLabelActive: {
    color: colors.goldDim,
  },
});
