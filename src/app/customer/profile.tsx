import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AddressInput } from '../../components/address-input';
import { Avatar } from '../../components/avatar';
import { DeleteAccount } from '../../components/delete-account';
import { ThemePicker } from '../../components/theme-picker';
import { deleteAddress, getSavedAddresses, SavedAddress, saveAddress, shortAddress } from '../../lib/location';
import { Place } from '../../lib/maps';
import { customerPhotoUrls, deletePhoto, PhotoSource, pickPhoto, uploadPhoto } from '../../lib/photos';
import { supabase } from '../../lib/supabase';
import { fonts, radius, spacing } from '../../lib/theme';
import { makeStyles, useTheme } from '../../lib/theme-context';
import { useUi } from '../../lib/ui';

export default function CustomerProfile() {
  const ui = useUi();
  const styles = useStyles();
  const { colors } = useTheme();
  const scrollRef = useRef<ScrollView>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [adding, setAdding] = useState(false);
  const [newAddress, setNewAddress] = useState<Place | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setUserId(user.id);
      setEmail(user.email ?? '');

      const [{ data: customer }, saved] = await Promise.all([
        supabase.from('customers').select('first_name, last_name, avatar_path').eq('id', user.id).single(),
        getSavedAddresses(),
      ]);

      if (customer) {
        setName(`${customer.first_name} ${customer.last_name}`);
        setAvatarPath(customer.avatar_path);
        if (customer.avatar_path) {
          const urls = await customerPhotoUrls([customer.avatar_path]);
          setAvatarUrl(urls[customer.avatar_path] ?? null);
        }
      }
      setAddresses(saved);
      setLoading(false);
    }

    load();
  }, []);

  async function changePhoto(source: PhotoSource) {
    if (!userId) return;
    setError(null);

    try {
      const uri = await pickPhoto(source, true);
      if (!uri) return;

      setBusy(true);
      const newPath = await uploadPhoto('customer-photos', userId, uri, 600);

      const { error: saveError } = await supabase.from('customers').update({ avatar_path: newPath }).eq('id', userId);
      if (saveError) {
        await deletePhoto('customer-photos', newPath);
        throw new Error(saveError.message);
      }

      if (avatarPath) await deletePhoto('customer-photos', avatarPath);

      const urls = await customerPhotoUrls([newPath]);
      setAvatarPath(newPath);
      setAvatarUrl(urls[newPath] ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Your photo didn't update. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto() {
    if (!userId || !avatarPath) return;
    setBusy(true);
    setError(null);

    const { error: saveError } = await supabase.from('customers').update({ avatar_path: null }).eq('id', userId);

    if (saveError) {
      setError(saveError.message);
    } else {
      await deletePhoto('customer-photos', avatarPath);
      setAvatarPath(null);
      setAvatarUrl(null);
    }
    setBusy(false);
  }

  function handlePhotoPress() {
    const options = [
      { text: 'Take a photo', onPress: () => changePhoto('camera') },
      { text: 'Choose from library', onPress: () => changePhoto('library') },
      ...(avatarPath ? [{ text: 'Remove photo', style: 'destructive' as const, onPress: removePhoto }] : []),
      { text: 'Cancel', style: 'cancel' as const },
    ];
    Alert.alert('Profile photo', undefined, options);
  }

  function startAdding() {
    setAdding(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
  }

  function stopAdding() {
    setAdding(false);
    setNewAddress(null);
    setNewLabel('');
  }

  async function handleSaveAddress() {
    if (!newAddress) return;
    setSavingAddress(true);
    setError(null);

    const problem = await saveAddress(newAddress, newLabel.trim() || undefined);

    setSavingAddress(false);

    if (problem) {
      setError(`The address wasn't saved: ${problem}`);
      return;
    }

    setAddresses(await getSavedAddresses());
    stopAdding();
  }

  function confirmRemove(address: SavedAddress) {
    Alert.alert('Remove this address?', shortAddress(address.address), [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const problem = await deleteAddress(address.id);
          if (problem) {
            setError(problem);
            return;
          }
          setAddresses((list) => list.filter((a) => a.id !== address.id));
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={ui.centered}>
        <ActivityIndicator size="large" color={colors.accentDark} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={ui.screen} behavior="padding" keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
      <ScrollView
        ref={scrollRef}
        style={ui.screen}
        contentContainerStyle={[ui.content, adding && { paddingBottom: 320 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Pressable onPress={handlePhotoPress} disabled={busy}>
            <Avatar name={name || '?'} url={avatarUrl} size={88} />
            <View style={styles.cameraBadge}>
              {busy ? (
                <ActivityIndicator size="small" color={colors.onAccent} />
              ) : (
                <Ionicons name="camera" size={16} color={colors.onAccent} />
              )}
            </View>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.email}>{email}</Text>
          </View>
        </View>

        <View style={styles.privacyBox}>
          <Ionicons name="lock-closed-outline" size={16} color={colors.text} />
          <Text style={styles.privacyText}>
            Your photo is private. Only professionals you've booked or messaged can see it.
          </Text>
        </View>

        {error && <Text style={ui.error}>{error}</Text>}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>My addresses</Text>
          <Text style={styles.cardHelp}>
            For house calls. A professional only sees an address once you book a visit with them.
          </Text>

          {addresses.length === 0 && !adding && <Text style={styles.empty}>No saved addresses yet.</Text>}

          {addresses.map((a) => (
            <View key={a.id} style={styles.addressRow}>
              <Ionicons
                name={a.label?.toLowerCase() === 'work' ? 'briefcase-outline' : 'home-outline'}
                size={18}
                color={colors.textMuted}
              />
              <View style={{ flex: 1 }}>
                {!!a.label && <Text style={styles.addressLabel}>{a.label}</Text>}
                <Text style={styles.addressText}>{a.address}</Text>
              </View>
              <Pressable onPress={() => confirmRemove(a)} hitSlop={10}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </Pressable>
            </View>
          ))}

          {adding ? (
            <View style={styles.addBox}>
              <AddressInput
                value={newAddress}
                onChange={(place) => {
                  setNewAddress(place);
                  setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
                }}
              />

              {newAddress && (
                <>
                  <Text style={styles.nameLabel}>Name it (optional)</Text>
                  <View style={styles.nameChips}>
                    {['Home', 'Work'].map((n) => (
                      <Pressable
                        key={n}
                        style={[ui.chip, newLabel === n && ui.chipSelected]}
                        onPress={() => setNewLabel(newLabel === n ? '' : n)}
                      >
                        <Text style={[ui.chipText, newLabel === n && ui.chipTextSelected]}>{n}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <TextInput
                    style={[ui.input, { marginTop: spacing.sm }]}
                    value={newLabel}
                    onChangeText={setNewLabel}
                    placeholder="Or type your own name for it"
                    placeholderTextColor={colors.textFaint}
                    maxLength={30}
                  />
                </>
              )}

              <View style={styles.buttons}>
                <Pressable style={styles.cancelButton} onPress={stopAdding}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.saveButton, (!newAddress || savingAddress) && ui.buttonDisabled]}
                  onPress={handleSaveAddress}
                  disabled={!newAddress || savingAddress}
                >
                  {savingAddress ? (
                    <ActivityIndicator color={colors.onAccent} />
                  ) : (
                    <Text style={styles.saveText}>Save address</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable style={styles.addButton} onPress={startAdding}>
              <Ionicons name="add" size={18} color={colors.text} />
              <Text style={styles.addText}>Add an address</Text>
            </Pressable>
          )}
        </View>

        <ThemePicker />
        <DeleteAccount />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((colors) => ({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginBottom: spacing.xl },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accentDark,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.background,
  },
  name: { fontFamily: fonts.extraBold, fontSize: 22, lineHeight: 26, color: colors.text },
  email: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted, marginTop: 4 },
  privacyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  privacyText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.text },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg },
  cardTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.text },
  cardHelp: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  empty: { fontFamily: fonts.regular, fontSize: 15, color: colors.textMuted, marginBottom: spacing.sm },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  addressLabel: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.text, marginBottom: 2 },
  addressText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 19, color: colors.textMuted },
  addBox: { marginTop: spacing.md },
  nameLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  nameChips: { flexDirection: 'row', gap: spacing.sm },
  buttons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  cancelButton: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.text },
  saveButton: {
    flex: 1,
    backgroundColor: colors.accentDark,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveText: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.onAccent },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: colors.accentDark,
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: spacing.md,
  },
  addText: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.text },
}));