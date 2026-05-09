import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { shared, cardShadow, fonts } from '../theme/styles';
import { useTournament, LEAGUES } from '../store/tournament';

export default function TeilnehmerScreen() {
  const {
    participants, pausedParticipants,
    addParticipant, removeParticipant,
    updateParticipant, pauseParticipant, resumeParticipant,
    statAdjustments, setStatAdjustment,
    getStandings,
  } = useTournament();

  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGender, setNewGender] = useState('M');
  const [newLeague, setNewLeague] = useState('FZ');

  const [editTarget, setEditTarget] = useState(null);
  const [editName, setEditName] = useState('');
  const [editGender, setEditGender] = useState('M');
  const [editLeague, setEditLeague] = useState('FZ');
  const [editGames, setEditGames] = useState('');
  const [editWins, setEditWins] = useState('');
  const [editDiff, setEditDiff] = useState('');
  const [statsError, setStatsError] = useState('');

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

  const openEdit = (p) => {
    const standing = standings.find((s) => s.id === p.id);
    setEditTarget(p);
    setEditName(p.name);
    setEditGender(p.gender);
    setEditLeague(p.league ?? 'FZ');
    setEditGames(String(standing?.games ?? 0));
    setEditWins(String(standing?.wins ?? 0));
    setEditDiff(String(standing?.diff ?? 0));
  };

  const closeEdit = () => {
    setEditTarget(null);
    setEditName('');
    setEditGender('M');
    setEditLeague('FZ');
    setEditGames('');
    setEditWins('');
    setEditDiff('');
    setStatsError('');
  };

  const handleSaveEdit = () => {
    if (!editName.trim() || !editTarget) return;
    const games = parseInt(editGames, 10) || 0;
    const wins  = parseInt(editWins,  10) || 0;
    const diff  = parseInt(editDiff,  10) || 0;
    if (wins > games) {
      setStatsError('Siege dürfen die Anzahl der Spiele nicht überschreiten.');
      return;
    }
    setStatsError('');
    updateParticipant(editTarget.id, {
      name: editName.trim(),
      gender: editGender,
      league: editLeague,
    });
    const standing = standings.find((s) => s.id === editTarget.id);
    const prevAdj = statAdjustments[editTarget.id] ?? { games: 0, wins: 0, diff: 0 };
    const baseGames = (standing?.games ?? 0) - (prevAdj.games ?? 0);
    const baseWins  = (standing?.wins  ?? 0) - (prevAdj.wins  ?? 0);
    const baseDiff  = (standing?.diff  ?? 0) - (prevAdj.diff  ?? 0);
    setStatAdjustment(editTarget.id, {
      games: games - baseGames,
      wins:  wins  - baseWins,
      diff:  diff  - baseDiff,
    });
    closeEdit();
  };

  const handlePause = () => {
    if (!editTarget) return;
    pauseParticipant(editTarget.id);
    closeEdit();
  };

  const handleResume = (p) => {
    resumeParticipant(p.id);
  };

  const handleRemove = (p) => {
    Alert.alert('Entfernen', `${p.name} wirklich dauerhaft entfernen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Entfernen', style: 'destructive', onPress: () => { removeParticipant(p.id); closeEdit(); } },
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

      <ScrollView showsVerticalScrollIndicator={false}>
        {filtered.length === 0 && (
          <View style={s.emptySearch}>
            <Ionicons name="search-outline" size={32} color={colors.textDim} />
            <Text style={s.emptySearchText}>Keine Teilnehmer gefunden</Text>
          </View>
        )}

        {/* Active participants */}
        {filtered.map((p) => {
          const isFemale = p.gender === 'F';
          const accentColor = isFemale ? '#E879A0' : colors.info;
          return (
            <TouchableOpacity
              key={p.id}
              style={s.card}
              onPress={() => openEdit(p)}
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
              <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
            </TouchableOpacity>
          );
        })}

        {/* Paused participants section */}
        {pausedParticipants.length > 0 && (
          <>
            <View style={s.sectionDivider}>
              <View style={s.dividerLine} />
              <Text style={s.sectionLabel}>AUSGESTIEGEN ({pausedParticipants.length})</Text>
              <View style={s.dividerLine} />
            </View>
            {pausedParticipants.map((p) => {
              const isFemale = p.gender === 'F';
              const accentColor = isFemale ? '#E879A0' : colors.info;
              return (
                <View key={p.id} style={[s.card, s.cardPaused]}>
                  <View style={[s.avatar, { backgroundColor: accentColor + '10', borderColor: accentColor + '20' }]}>
                    <Text style={[s.avatarText, { color: accentColor + '80' }]}>
                      {p.name[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={s.cardBody}>
                    <View style={s.nameRow}>
                      <Text style={[s.cardName, { color: colors.textMuted }]} numberOfLines={1}>{p.name}</Text>
                      <View style={[s.leagueBadge, { opacity: 0.5 }]}>
                        <Text style={s.leagueBadgeText}>{p.league ?? 'FZ'}</Text>
                      </View>
                    </View>
                    <Text style={s.cardSub}>Pausiert</Text>
                  </View>
                  <View style={s.pausedActions}>
                    <TouchableOpacity
                      style={s.resumeBtn}
                      onPress={() => handleResume(p)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="enter-outline" size={14} color={colors.success} />
                      <Text style={s.resumeBtnText}>Einsteigen</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </>
        )}

        <Text style={s.hint}>Antippen zum Bearbeiten</Text>
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

      {/* Edit Modal */}
      <Modal visible={!!editTarget} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={shared.modalBg}>
          <View style={shared.sheet}>
            <View style={s.sheetHeader}>
              <Text style={shared.sheetTitle}>Teilnehmer bearbeiten</Text>
              <TouchableOpacity onPress={closeEdit} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={shared.input}
              placeholder="Name (z.B. Müller, Max)"
              placeholderTextColor={colors.textMuted}
              value={editName}
              onChangeText={setEditName}
              autoFocus
            />

            <Text style={s.genderLabel}>GESCHLECHT</Text>
            <View style={s.genderRow}>
              <TouchableOpacity
                style={[s.genderBtn, editGender === 'M' && s.genderBtnActiveM]}
                onPress={() => setEditGender('M')}
                activeOpacity={0.7}
              >
                <Ionicons name="male" size={18} color={editGender === 'M' ? colors.info : colors.textMuted} />
                <Text style={[s.genderBtnText, editGender === 'M' && { color: colors.white }]}>Herr</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.genderBtn, editGender === 'F' && s.genderBtnActiveF]}
                onPress={() => setEditGender('F')}
                activeOpacity={0.7}
              >
                <Ionicons name="female" size={18} color={editGender === 'F' ? '#E879A0' : colors.textMuted} />
                <Text style={[s.genderBtnText, editGender === 'F' && { color: colors.white }]}>Dame</Text>
              </TouchableOpacity>
            </View>

            <Text style={s.genderLabel}>LIGA</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.leagueScroll} contentContainerStyle={s.leagueScrollContent}>
              {LEAGUES.map((lg) => (
                <TouchableOpacity
                  key={lg.key}
                  style={[s.leagueBtn, editLeague === lg.key && s.leagueBtnActive]}
                  onPress={() => setEditLeague(lg.key)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.leagueBtnKey, editLeague === lg.key && s.leagueBtnKeyActive]}>{lg.key}</Text>
                  <Text style={[s.leagueBtnLabel, editLeague === lg.key && s.leagueBtnLabelActive]} numberOfLines={1}>{lg.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={s.genderLabel}>STATISTIKEN</Text>
            <View style={s.statsEditRow}>
              <View style={s.statsEditField}>
                <Text style={s.statsEditLabel}>Spiele</Text>
                <TextInput
                  style={[s.statsEditInput, statsError && parseInt(editWins,10) > parseInt(editGames,10) && s.statsEditInputError]}
                  keyboardType="numeric"
                  value={editGames}
                  onChangeText={(v) => { setEditGames(v); setStatsError(''); }}
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={s.statsEditField}>
                <Text style={s.statsEditLabel}>Siege</Text>
                <TextInput
                  style={[s.statsEditInput, statsError && s.statsEditInputError]}
                  keyboardType="numeric"
                  value={editWins}
                  onChangeText={(v) => { setEditWins(v); setStatsError(''); }}
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={s.statsEditField}>
                <Text style={s.statsEditLabel}>Diff.</Text>
                <TextInput
                  style={s.statsEditInput}
                  keyboardType="numbers-and-punctuation"
                  value={editDiff}
                  onChangeText={setEditDiff}
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>
            {!!statsError && (
              <View style={s.statsErrorBox}>
                <Ionicons name="warning-outline" size={13} color={colors.error} />
                <Text style={s.statsErrorText}>{statsError}</Text>
              </View>
            )}

            <TouchableOpacity style={shared.saveBtn} onPress={handleSaveEdit} activeOpacity={0.8}>
              <Text style={shared.saveBtnText}>SPEICHERN</Text>
            </TouchableOpacity>

            {/* Pause / exit button */}
            <TouchableOpacity style={s.pauseBtn} onPress={handlePause} activeOpacity={0.8}>
              <Ionicons name="exit-outline" size={16} color={colors.warning} />
              <Text style={s.pauseBtnText}>AUSSTEIGEN (vorerst pausieren)</Text>
            </TouchableOpacity>

            {/* Permanent remove */}
            <TouchableOpacity
              onPress={() => editTarget && handleRemove(editTarget)}
              activeOpacity={0.7}
              style={s.removeLink}
            >
              <Text style={s.removeLinkText}>Dauerhaft entfernen</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={closeEdit} activeOpacity={0.7}>
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
    fontSize: 22,
    fontFamily: fonts.heading,
    letterSpacing: -0.5,
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: fonts.body,
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
  cardPaused: {
    opacity: 0.6,
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
    fontFamily: fonts.heading,
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
    fontFamily: fonts.bodySemi,
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
  sectionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  sectionLabel: {
    color: colors.textDim,
    fontSize: 10,
    fontFamily: fonts.headingSemi,
    letterSpacing: 1.5,
  },
  pausedActions: {
    alignItems: 'flex-end',
  },
  resumeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.success + '15',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.success + '40',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  resumeBtnText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '700',
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
  statsEditRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statsEditField: {
    flex: 1,
    alignItems: 'center',
  },
  statsEditLabel: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 6,
  },
  statsEditInput: {
    width: '100%',
    backgroundColor: colors.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 10,
  },
  statsEditInputError: {
    borderColor: colors.error,
    color: colors.error,
  },
  statsErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.error + '15',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.error + '40',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  statsErrorText: {
    color: colors.error,
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  pauseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.warning + '40',
    backgroundColor: colors.warning + '10',
    paddingVertical: 14,
    marginTop: 10,
    marginBottom: 4,
  },
  pauseBtnText: {
    color: colors.warning,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  removeLink: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  removeLinkText: {
    color: colors.error + 'AA',
    fontSize: 13,
    fontWeight: '500',
  },
});
