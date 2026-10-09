import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { Avatar } from '../../../components/avatar';
import { Toggle } from '../../../components/toggle';
import { formatDuration } from '../../../lib/format';
import { deletePhoto, PhotoSource, pickPhoto, professionalPhotoUrl, uploadPhoto } from '../../../lib/photos';
import { supabase } from '../../../lib/supabase';
import { fonts, radius, spacing } from '../../../lib/theme';
import { makeStyles, useTheme } from '../../../lib/theme-context';
import { useUi } from '../../../lib/ui';

type Service = { id: number; name: string; duration_minutes: number };

const suggestedCategories = ['Hairstylist', 'Braider', 'Barber', 'Nail tech', 'Makeup artist', 'Lash tech'];

export default function TeamMember() {
  const ui = useUi();
  const styles = useStyles();
  const { colors } = useTheme();
  const { staffId } = useLocalSearchParams<{ staffId: string }>();
  const isNew = staffId === 'new';

  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [newPhotoUri, setNewPhotoUri] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [category, setCategory] = useState<string | null>(null);
  const [ownCategory, setOwnCategory] = useState('');
  const [typingOwn, setTypingOwn] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [assigned, setAssigned] = useState<Set<number>>(new Set());
  const [initialAssigned, setInitialAssigned] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

      const { data: serviceData } = await supabase
        .from('services')
        .select('id, name, duration_minutes')
        .eq('professional_id', user.id)
        .order('created_at', { ascending: true });

      const allServices = serviceData ?? [];
      setServices(allServices);

      if (isNew) {
        setAssigned(new Set(allServices.map((s) => s.id)));
      } else {
        const { data: member, error: loadError } = await supabase
          .from('staff')
          .select('name, avatar_path, is_active, category, staff_services(service_id)')
          .eq('id', staffId)
          .single();

        if (loadError || !member) {
          setError("We couldn't find this person on your team.");
        } else {
          setName(member.name);
          setAvatarPath(member.avatar_path);
          setIsActive(member.is_active);
          if (member.category && suggestedCategories.includes(member.category)) {
            setCategory(member.category);
          } else if (member.category) {
            setTypingOwn(true);
            setOwnCategory(member.category);
          }
          const ids = new Set((member.staff_services ?? []).map((s: { service_id: number }) => s.service_id));
          setAssigned(ids);
          setInitialAssigned(new Set(ids));
        }
      }

      setLoading(false);
    }

    load();
  }, [staffId, isNew]);

  function toggleService(id: number) {
    setAssigned((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function pickCategory(value: string) {
    setTypingOwn(false);
    setCategory(value);
  }

  function pickOwnCategory() {
    setTypingOwn(true);
    setCategory(null);
  }

  async function choosePhoto(source: PhotoSource) {
    setError(null);
    try {
      const uri = await pickPhoto(source, true);
      if (uri) setNewPhotoUri(uri);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open your photos.");
    }
  }

  function handlePhotoPress() {
    Alert.alert('Photo', undefined, [
      { text: 'Take a photo', onPress: () => choosePhoto('camera') },
      { text: 'Choose from library', onPress: () => choosePhoto('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function otherActiveMembers() {
    let query = supabase
      .from('staff')
      .select('id', { count: 'exact', head: true })
      .eq('professional_id', userId!)
      .eq('is_active', true);
    if (!isNew) query = query.neq('id', Number(staffId));
    const { count } = await query;
    return count ?? 0;
  }

  async function handleSave() {
    if (!userId) return;
    setError(null);

    const finalCategory = typingOwn ? ownCategory.trim() : category;

    if (!name.trim()) {
      setError('Add their name.');
      return;
    }
    if (!finalCategory) {
      setError(typingOwn ? 'Type in what they do.' : 'Pick what they do.');
      return;
    }
    if (isActive && assigned.size === 0) {
      setError('Pick at least one service, or turn off Taking bookings.');
      return;
    }

    setSaving(true);

    try {
      if (!isActive && (await otherActiveMembers()) === 0) {
        throw new Error('Someone on your team has to be taking bookings.');
      }

      let photoPath = avatarPath;
      if (newPhotoUri) {
        photoPath = await uploadPhoto('professional-photos', `${userId}/staff`, newPhotoUri, 600);
      }

      let memberId = isNew ? null : Number(staffId);

      if (isNew) {
        const { data, error: insertError } = await supabase
          .from('staff')
          .insert({
            professional_id: userId,
            name: name.trim(),
            category: finalCategory,
            avatar_path: photoPath,
            is_active: isActive,
          })
          .select('id')
          .single();

        if (insertError || !data) {
          if (newPhotoUri && photoPath) await deletePhoto('professional-photos', photoPath);
          throw new Error("Couldn't add them. Check your connection and try again.");
        }
        memberId = data.id;
      } else {
        const { error: updateError } = await supabase
          .from('staff')
          .update({ name: name.trim(), category: finalCategory, avatar_path: photoPath, is_active: isActive })
          .eq('id', memberId!);

        if (updateError) {
          if (newPhotoUri && photoPath) await deletePhoto('professional-photos', photoPath);
          throw new Error("Couldn't save. Check your connection and try again.");
        }

        if (newPhotoUri && avatarPath) await deletePhoto('professional-photos', avatarPath);
      }

      const toAdd = [...assigned].filter((id) => !initialAssigned.has(id));
      const toRemove = [...initialAssigned].filter((id) => !assigned.has(id));

      if (toAdd.length > 0) {
        const { error: addError } = await supabase
          .from('staff_services')
          .insert(toAdd.map((serviceId) => ({ staff_id: memberId!, service_id: serviceId })));
        if (addError) throw new Error("Couldn't save their services. Try again.");
      }

      if (toRemove.length > 0) {
        const { error: removeError } = await supabase
          .from('staff_services')
          .delete()
          .eq('staff_id', memberId!)
          .in('service_id', toRemove);
        if (removeError) throw new Error("Couldn't save their services. Try again.");
      }

      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleRemove() {
    Alert.alert(`Remove ${name}?`, undefined, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setError(null);
          setSaving(true);

          if (isActive && (await otherActiveMembers()) === 0) {
            setError('Someone on your team has to be taking bookings.');
            setSaving(false);
            return;
          }

          const { error: deleteError } = await supabase.from('staff').delete().eq('id', Number(staffId));
          setSaving(false);

          if (deleteError) {
            setError(
              deleteError.code === '23503'
                ? `${name} has bookings, so you can't remove them. Turn off Taking bookings instead.`
                : "Couldn't remove them. Check your connection and try again.",
            );
            return;
          }

          if (avatarPath) await deletePhoto('professional-photos', avatarPath);
          router.back();
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

  const photoUrl = newPhotoUri ?? professionalPhotoUrl(avatarPath);

  return (
    <KeyboardAvoidingView style={ui.screen} behavior="padding" keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
      <Stack.Screen options={{ title: isNew ? 'Add someone' : 'Team member' }} />
      <ScrollView style={ui.screen} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable onPress={handlePhotoPress} disabled={saving}>
            <Avatar name={name || '?'} url={photoUrl} size={96} />
            <View style={styles.cameraBadge}>
              <Ionicons name="camera" size={16} color={colors.onAccent} />
            </View>
          </Pressable>
        </View>

        <Text style={ui.label}>Name</Text>
        <TextInput
          style={ui.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Thandi"
          placeholderTextColor={colors.textFaint}
          maxLength={60}
        />

        <Text style={ui.label}>What they do</Text>
        <View style={styles.chips}>
          {suggestedCategories.map((c) => {
            const on = !typingOwn && category === c;
            return (
              <Pressable key={c} style={[ui.chip, on && ui.chipSelected]} onPress={() => pickCategory(c)}>
                <Text style={[ui.chipText, on && ui.chipTextSelected]}>{c}</Text>
              </Pressable>
            );
          })}
          <Pressable style={[ui.chip, typingOwn && ui.chipSelected]} onPress={pickOwnCategory}>
            <Text style={[ui.chipText, typingOwn && ui.chipTextSelected]}>Other</Text>
          </Pressable>
        </View>
        {typingOwn && (
          <TextInput
            style={[ui.input, styles.ownInput]}
            value={ownCategory}
            onChangeText={setOwnCategory}
            placeholder="e.g. Wig installer"
            placeholderTextColor={colors.textFaint}
            maxLength={40}
            autoCapitalize="sentences"
            autoFocus
          />
        )}

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>Taking bookings</Text>
            <Text style={ui.help}>Turn off while they're away.</Text>
          </View>
          <Toggle value={isActive} onValueChange={setIsActive} />
        </View>

        <Text style={ui.sectionTitle}>Services they do</Text>
        {services.length === 0 ? (
          <Text style={ui.muted}>You haven't added any services yet.</Text>
        ) : (
          services.map((s) => {
            const on = assigned.has(s.id);
            return (
              <Pressable key={s.id} style={styles.serviceRow} onPress={() => toggleService(s.id)}>
                <Ionicons
                  name={on ? 'checkmark-circle' : 'ellipse-outline'}
                  size={22}
                  color={on ? colors.text : colors.textFaint}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.serviceName, on && styles.serviceNameOn]}>{s.name}</Text>
                  <Text style={styles.serviceDetails}>{formatDuration(s.duration_minutes)}</Text>
                </View>
              </Pressable>
            );
          })
        )}

        {error && <Text style={ui.error}>{error}</Text>}

        <Pressable style={[ui.button, saving && ui.buttonDisabled]} onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <Text style={ui.buttonText}>{isNew ? 'Add to team' : 'Save changes'}</Text>
          )}
        </Pressable>

        {!isNew && (
          <Pressable style={styles.removeButton} onPress={handleRemove} disabled={saving}>
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
            <Text style={styles.removeText}>Remove from team</Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((colors) => ({
  header: { alignItems: 'center', marginBottom: spacing.md },
  cameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accentDark,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.background,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  ownInput: { marginTop: spacing.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xl },
  switchLabel: { fontFamily: fonts.semiBold, fontSize: 16, color: colors.text },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  serviceName: { fontFamily: fonts.regular, fontSize: 15, color: colors.textMuted },
  serviceNameOn: { fontFamily: fonts.semiBold, color: colors.text },
  serviceDetails: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted, marginTop: 2 },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  removeText: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.danger },
}));