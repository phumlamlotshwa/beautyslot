import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { CustomerLocation, getCurrentLocation, getSavedLocation } from '../lib/location';
import { Place } from '../lib/maps';
import { colors, fonts, radius, spacing } from '../lib/theme';
import { AddressInput } from './address-input';

type Props = {
  value: CustomerLocation | null;
  onChange: (location: CustomerLocation) => void;
};

export function LocationBar({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [searchPlace, setSearchPlace] = useState<Place | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function close() {
    setOpen(false);
    setSearchPlace(null);
    setMessage(null);
  }

  async function useCurrent() {
    setMessage(null);
    setWorking(true);
    const location = await getCurrentLocation();
    setWorking(false);

    if (!location) {
      setMessage("We couldn't get your location. Check that location is allowed for this app in your phone's settings, or choose another option.");
      return;
    }

    onChange(location);
    close();
  }

  async function useSaved() {
    setMessage(null);
    setWorking(true);
    const location = await getSavedLocation();
    setWorking(false);

    if (!location) {
      setMessage("You don't have a saved address yet. It's saved the first time you book a home visit.");
      return;
    }

    onChange(location);
    close();
  }

  function handlePlace(place: Place | null) {
    setSearchPlace(place);

    if (place) {
      onChange({
        label: place.area || place.address,
        lat: place.lat,
        lng: place.lng,
        source: 'search',
      });
      close();
    }
  }

  return (
    <>
      <Pressable style={styles.bar} onPress={() => setOpen(true)}>
        <Ionicons name="location-outline" size={18} color={colors.accentDark} />
        <Text style={styles.barLabel}>Near</Text>
        <Text style={styles.barValue} numberOfLines={1}>
          {value ? value.label : 'Choose your area'}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.backdrop} onPress={close} />
          <View style={styles.sheet}>
            <Text style={styles.title}>Show professionals near</Text>

            <Pressable style={styles.option} onPress={useCurrent} disabled={working}>
              <Ionicons name="navigate-outline" size={20} color={colors.accentDark} />
              <Text style={styles.optionText}>My current location</Text>
            </Pressable>

            <Pressable style={styles.option} onPress={useSaved} disabled={working}>
              <Ionicons name="home-outline" size={20} color={colors.accentDark} />
              <Text style={styles.optionText}>My saved address</Text>
            </Pressable>

            <Text style={styles.searchLabel}>Or search another area</Text>
            <AddressInput value={searchPlace} onChange={handlePlace} placeholder="Suburb, town or address" />

            {working && <ActivityIndicator style={{ marginTop: spacing.md }} color={colors.accentDark} />}
            {message && <Text style={styles.message}>{message}</Text>}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  barLabel: { fontFamily: fonts.regular, fontSize: 15, color: colors.textMuted },
  barValue: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.35)' },
  sheet: { backgroundColor: colors.background, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.xl, paddingBottom: 40 },
  title: { fontFamily: fonts.bold, fontSize: 18, color: colors.text, marginBottom: spacing.sm },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  optionText: { fontFamily: fonts.medium, fontSize: 16, color: colors.text },
  searchLabel: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted, marginTop: spacing.xl, marginBottom: spacing.sm },
  message: { fontFamily: fonts.regular, fontSize: 14, color: colors.danger, marginTop: spacing.md },
});