import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AddressInput } from '../../components/address-input';
import { Avatar } from '../../components/avatar';
import { Place } from '../../lib/maps';
import { customerPhotoUrls, deletePhoto, PhotoSource, pickPhoto, uploadPhoto } from '../../lib/photos';
import { supabase } from '../../lib/supabase';
import { colors, fonts, radius, spacing } from '../../lib/theme';
import { ui } from '../../lib/ui';

export default function CustomerProfile() {
  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [address, setAddress] = useState<Place | null>(null);
  const [editingAddress, setEditingAddress] = useState(false);
  const [newAddress, setNewAddress] = useState<Place | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setUserId(user.id);
      setEmail(user.email ?? '');

      const [{ data: customer }, { data: saved }] = await Promise.all([
        supabase.from('customers').select('first_name, last_name, avatar_path').eq('id', user.id).single(),
        supabase.from('customer_private').select('home_address, home_lat, home_lng').eq('customer_id', user.id).maybeSingle(),
      ]);

      if (customer) {
        setName(`${customer.first_name} ${customer.last_name}`);
        setAvatarPath(customer.avatar_path);
        if (customer.avatar_path) {
          const urls = await customerPhotoUrls([customer.avatar_path]);
          setAvatarUrl(urls[customer.avatar_path] ?? null);
        }
      }
      if (saved) {
        setAddress({ address: saved.home_address, lat: saved.home_lat, lng: saved.home_lng });
      }
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
      setError(e instanceof Error ? e.message : 'Could not update your photo.');
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

  async function saveAddress() {
    if (!userId || !newAddress) return;
    setBusy(true);
    setError(null);

    const { error: saveError } = await supabase.from('customer_private').upsert({
      customer_id: userId,
      home_address: newAddress.address,
      home_lat: newAddress.lat,
      home_lng: newAddress.lng,
      updated_at: new Date().toISOString(),
    });

    setBusy(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    setAddress(newAddress);
    setEditingAddress(false);
    setNewAddress(null);
  }

  if (loading) {
    return (
      <View style={ui.centered}>
        <ActivityIndicator size="large" color={colors.accentDark} />
      </View>
    );
  }

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Pressable onPress={handlePhotoPress} disabled={busy}>
          <Avatar name={name || '?'} url={avatarUrl} size={104} />
          <View style={styles.cameraBadge}>
            {busy ? (
              <ActivityIndicator size="small" color={colors.onAccent} />
            ) : (
              <Ionicons name="camera" size={18} color={colors.onAccent} />
            )}
          </View>
        </Pressable>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.email}>{email}</Text>
      </View>

      <View style={styles.privacyBox}>
        <Ionicons name="lock-closed-outline" size={16} color={colors.accentDark} />
        <Text style={styles.privacyText}>
          Your photo is private. Only professionals you've booked or messaged can see it.
        </Text>
      </View>

      {error && <Text style={ui.error}>{error}</Text>}

      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="home-outline" size={20} color={colors.accentDark} />
          <Text style={styles.cardTitle}>Home address</Text>
        </View>
        <Text style={styles.cardHelp}>Used for home visits. Only shared with a professional once you book a visit with them.</Text>

        {!editingAddress ? (
          <>
            <Text style={styles.addressText}>{address ? address.address : 'No address saved yet.'}</Text>
            <Pressable style={styles.linkButton} onPress={() => setEditingAddress(true)}>
              <Text style={styles.linkText}>{address ? 'Change address' : 'Add address'}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <AddressInput value={newAddress} onChange={setNewAddress} />
            <View style={styles.buttons}>
              <Pressable
                style={styles.cancelButton}
                onPress={() => {
                  setEditingAddress(false);
                  setNewAddress(null);
                }}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.saveButton, (!newAddress || busy) && ui.buttonDisabled]}
                onPress={saveAddress}
                disabled={!newAddress || busy}
              >
                <Text style={styles.saveText}>Save</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', marginBottom: spacing.xl },
  cameraBadge: { position: 'absolute', right: 0, bottom: 0, width: 34, height: 34, borderRadius: 17, backgroundColor: colors.accentDark, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.background },
  name: { fontFamily: fonts.bold, fontSize: 22, color: colors.text, marginTop: spacing.md },
  email: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted, marginTop: 2 },
  privacyBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.accentSoft, borderRadius: radius.sm, padding: spacing.md, marginBottom: spacing.lg },
  privacyText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.accentDark },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.lg },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.text },
  cardHelp: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.md },
  addressText: { fontFamily: fonts.regular, fontSize: 15, color: colors.text },
  linkButton: { alignSelf: 'flex-start', marginTop: spacing.md },
  linkText: { fontFamily: fonts.medium, fontSize: 15, color: colors.accentDark },
  buttons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  cancelButton: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingVertical: 12, alignItems: 'center' },
  cancelText: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  saveButton: { flex: 1, backgroundColor: colors.accentDark, borderRadius: radius.sm, paddingVertical: 12, alignItems: 'center' },
  saveText: { fontFamily: fonts.medium, fontSize: 15, color: colors.onAccent },
});