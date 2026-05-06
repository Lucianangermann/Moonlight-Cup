import { StyleSheet, Platform } from 'react-native';
import { colors } from './colors';

export const cardShadow = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  android: { elevation: 8 },
  default: {},
});

export const goldGlowShadow = Platform.select({
  ios: {
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  android: { elevation: 12 },
  default: {},
});

export const shared = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: 18,
    paddingTop: 58,
  },
  card: {
    backgroundColor: colors.panel,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 10,
    ...cardShadow,
  },
  cardHighlight: {
    backgroundColor: colors.panelLight,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: 16,
    marginBottom: 10,
    ...cardShadow,
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 12,
    marginTop: 4,
  },
  screenTitle: {
    color: colors.white,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  goldBtn: {
    backgroundColor: colors.gold,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginVertical: 16,
    ...goldGlowShadow,
  },
  goldBtnText: {
    color: colors.bg,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  disabledBtn: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
  },
  disabledBtnText: {
    color: colors.textMuted,
  },
  modalBg: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  sheet: {
    backgroundColor: colors.panelLight,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: colors.borderStrong,
    padding: 24,
    paddingBottom: 36,
  },
  sheetTitle: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 20,
    letterSpacing: -0.2,
  },
  input: {
    backgroundColor: colors.bg,
    color: colors.white,
    fontSize: 16,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  saveBtn: {
    backgroundColor: colors.gold,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  saveBtnText: {
    color: colors.bg,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1,
  },
  cancelText: {
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 14,
    paddingVertical: 10,
  },
});
