import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import {
  CustomerLocation,
  deleteAddress,
  getCurrentLocation,
  getSavedAddresses,
  markAddressUsed,
  SavedAddress,
  saveAddress,
  savedToLocation,
  shortAddress,
} from '../lib/location';
import { Place } from '../lib/maps';
import { fonts, radius, spacing } from '../lib/theme';
import { makeStyles, useTheme } from '../lib/theme-context';
import { useUi } from '../lib/ui';
import { AddressInput } from './address-input';

type Props = {
  value: CustomerLocation | null;
  onChange: (location: CustomerLocation) => void;
};

export function LocationBar({ value, onChange }: Props) {
  const ui = useUi();
  const styles = useStyles();
  const { colors } = useTheme();

  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [saved, setSaved] = useState<SavedAddress[]>([]);
  const [savedOpen, setSavedOpen] = useState(false);
  const [searchPlace, setSearchPlace] = useState<Place | null>(null);
  const [label, setLabel] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [searchKey, setSearchKey] = useState(0);

  async function loadSaved() {
    setSaved(await getSavedAddresses());
  }

  function openSheet() {
    setOpen(true);
    loadSaved();
  }

  function close() {
    setOpen(false);
    setSavedOpen(false);
    setSearchPlace(null);
    setLabel('');
    setMessage(null);
    setSavedNote(null);
  }

  function pickSearched(place: Place | null) {
    setSearchPlace(place);
    setSavedNote(null);
  }

  async function useCurrent() {
    setMessage(null);
    setWorking(true);
    const location = await getCurrentLocation();
    setWorking(false);

    if (!location) {
      setMessage("Your location isn't available. Allow location for BeautySlot in your phone's settings, or pick another option.");
      return;
    }

    onChange(location);
    close();
  }

  function useSaved(address: SavedAddress) {
    markAddressUsed(address.id);
    onChange(savedToLocation(address));
    close();
  }

  function confirmDelete(address: SavedAddress) {
    Alert.alert('Remove this address?', shortAddress(address.address), [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const problem = await deleteAddress(address.id);
          if (problem) {
            setMessage(problem);
            return;
          }
          loadSaved();
        },
      },
    ]);
  }

  async function saveSearched() {
    if (!searchPlace) return;

    setMessage(null);
    setWorking(true);
    const problem = await saveAddress(searchPlace, label.trim() || undefined);
    setWorking(false);

    if (problem) {
      setMessage(`The address wasn't saved: ${problem}`);
      return;
    }

    setSavedNote(`Saved${label.trim() ? ` as ${label.trim()}` : ''}. It's in your saved addresses.`);
    setSearchPlace(null);
    setLabel('');
    setSearchKey((k) => k + 1);
    setSavedOpen(true);
    loadSaved();
  }

  function useSearched() {
    if (!searchPlace) return;

    onChange({
      label: searchPlace.area || shortAddress(searchPlace.address),
      lat: searchPlace.lat,
      lng: searchPlace.lng,
      source: 'search',
    });
    close();
  }

  return (
    <>
      <Pressable style={styles.bar} onPress={openSheet}>
        <Ionicons name="location-outline" size={18} color={colors.text} />
        <Text style={styles.barValue} numberOfLines={1}>
          {value ? `Near ${value.label}` : 'Choose your area'}
        </Text>
        <Text style={styles.change}>Change</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.backdrop} onPress={close} />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.title}>Show professionals near</Text>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Pressable style={styles.option} onPress={useCurrent} disabled={working}>
                <Ionicons name="navigate-outline" size={20} color={colors.text} />
                <Text style={styles.optionText}>Where I am now</Text>
              </Pressable>

              <Pressable style={styles.option} onPress={() => setSavedOpen((o) => !o)}>
                <Ionicons name="bookmark-outline" size={20} color={colors.text} />
                <Text style={styles.optionText}>
                  My saved addresses{saved.length > 0 ? ` (${saved.length})` : ''}
                </Text>
                <Ionicons name={savedOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
              </Pressable>

              {savedOpen && (
                <View style={styles.savedList}>
                  {saved.length === 0 ? (
                    <Text style={styles.savedEmpty}>No saved addresses yet. Search for one below to add it.</Text>
                  ) : (
                    saved.map((a) => (
                      <View key={a.id} style={styles.savedRow}>
                        <Pressable style={styles.savedMain} onPress={() => useSaved(a)}>
                          {!!a.label && <Text style={styles.savedLabel}>{a.label}</Text>}
                          <Text style={styles.savedAddress}>{a.address}</Text>
                        </Pressable>
                        <Pressable onPress={() => confirmDelete(a)} hitSlop={10} style={styles.removeButton}>
                          <Ionicons name="close" size={20} color={colors.textMuted} />
                        </Pressable>
                      </View>
                    ))
                  )}
                </View>
              )}

              <Text style={styles.searchLabel}>Or search for an address or area</Text>
              <AddressInput
                key={searchKey}
                value={searchPlace}
                onChange={pickSearched}
                placeholder="Suburb, town or address"
              />

              {searchPlace && (
                <View style={styles.searchCard}>
                  <Text style={styles.nameLabel}>Name it (optional)</Text>
                  <View style={styles.nameChips}>
                    {['Home', 'Work'].map((name) => (
                      <Pressable
                        key={name}
                        style={[ui.chip, label === name && ui.chipSelected]}
                        onPress={() => setLabel(label === name ? '' : name)}
                      >
                        <Text style={[ui.chipText, label === name && ui.chipTextSelected]}>{name}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <TextInput
                    style={[ui.input, styles.nameInput]}
                    value={label}
                    onChangeText={setLabel}
                    placeholder="Or type your own name for it"
                    placeholderTextColor={colors.textFaint}
                    maxLength={30}
                  />

                  <View style={styles.searchButtons}>
                    <Pressable
                      style={[styles.saveButton, working && { opacity: 0.4 }]}
                      onPress={saveSearched}
                      disabled={working}
                    >
                      <Text style={styles.saveButtonText}>Save address</Text>
                    </Pressable>
                    <Pressable style={[styles.useButton, working && { opacity: 0.4 }]} onPress={useSearched} disabled={working}>
                      <Text style={styles.useButtonText}>Use without saving</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {savedNote && <Text style={styles.savedNote}>{savedNote}</Text>}

              {working && <ActivityIndicator style={{ marginTop: spacing.md }} color={colors.accentDark} />}
              {message && <Text style={styles.message}>{message}</Text>}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const useStyles = makeStyles((colors) => ({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  barValue: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  change: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.text, textDecorationLine: 'underline' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  sheet: {
    maxHeight: '88%',
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: 40,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.lg,
  },
  title: { fontFamily: fonts.bold, fontSize: 18, color: colors.text, marginBottom: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionText: { flex: 1, fontFamily: fonts.medium, fontSize: 16, color: colors.text },
  savedList: { backgroundColor: colors.surface, borderRadius: radius.sm, marginTop: spacing.sm },
  savedEmpty: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textMuted, padding: spacing.md },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  savedMain: { flex: 1, paddingVertical: 12, paddingLeft: spacing.md },
  savedLabel: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.text, marginBottom: 2 },
  savedAddress: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 19, color: colors.textMuted },
  removeButton: { paddingHorizontal: spacing.md, paddingVertical: 12 },
  searchLabel: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted, marginTop: spacing.xl, marginBottom: spacing.sm },
  searchCard: { backgroundColor: colors.surface, borderRadius: radius.sm, padding: spacing.md, marginTop: spacing.md },
  nameLabel: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.text, marginBottom: spacing.sm },
  nameChips: { flexDirection: 'row', gap: spacing.sm },
  nameInput: { marginTop: spacing.sm },
  searchButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  saveButton: { flex: 1, backgroundColor: colors.accentDark, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  saveButtonText: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.onAccent },
  useButton: { flex: 1, borderWidth: 1.5, borderColor: colors.accentDark, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  useButtonText: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.text },
  savedNote: { fontFamily: fonts.medium, fontSize: 14, color: colors.text, marginTop: spacing.md },
  message: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.danger, marginTop: spacing.md },
}));