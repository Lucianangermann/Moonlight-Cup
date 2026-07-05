import { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Modal, KeyboardAvoidingView,
  Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { shared } from '../theme/styles';
import { useAuth } from '../store/auth';
import AnimatedPressable from '../components/AnimatedPressable';

export default function LoginScreen({ visible, onClose }) {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setUsername('');
    setPassword('');
    setError('');
    setLoading(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!username.trim() || !password) {
      setError('Benutzername und Passwort erforderlich.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(username.trim(), password);
      close();
    } catch (e) {
      setError(e.message || 'Anmeldung fehlgeschlagen.');
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={shared.modalBg}>
        <View style={shared.sheet}>
          <View style={s.sheetHeader}>
            <Text style={shared.sheetTitle}>Admin-Login</Text>
            <AnimatedPressable onPress={close} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </AnimatedPressable>
          </View>

          <TextInput
            style={shared.input}
            placeholder="Benutzername"
            placeholderTextColor={colors.textMuted}
            value={username}
            onChangeText={(v) => { setUsername(v); setError(''); }}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />
          <TextInput
            style={shared.input}
            placeholder="Passwort"
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={(v) => { setPassword(v); setError(''); }}
            secureTextEntry
            onSubmitEditing={handleSubmit}
          />

          {!!error && (
            <View style={s.errorBox}>
              <Ionicons name="warning-outline" size={13} color={colors.error} />
              <Text style={s.errorText}>{error}</Text>
            </View>
          )}

          <AnimatedPressable
            style={[shared.saveBtn, loading && shared.disabledBtn]}
            onPress={handleSubmit}
            activeOpacity={0.8}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <Text style={shared.saveBtnText}>ANMELDEN</Text>
            )}
          </AnimatedPressable>
          <AnimatedPressable onPress={close} activeOpacity={0.7}>
            <Text style={shared.cancelText}>Abbrechen</Text>
          </AnimatedPressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -8,
    marginBottom: 16,
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
  },
});
