import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../../components/avatar';
import { NameDialog } from '../../components/name-dialog';
import { PhotoEditor } from '../../components/photo-editor';
import { professionLabels } from '../../lib/format';
import { deletePhoto, PhotoSource, pickPhoto, professionalPhotoUrl, uploadPhoto } from '../../lib/photos';
import { supabase } from '../../lib/supabase';
import { colors, fonts, radius, spacing } from '../../lib/theme';
import { ui } from '../../lib/ui';

const PER_CATALOGUE = 12;
const MAX_CATALOGUES = 5;

type Catalogue = { id: number; name: string };
type WorkPhoto = { id: number; path: string; caption: string | null; catalogue_id: number | null };
type Selected = number | 'other';

function chooseSource(title: string, onPick: (source: PhotoSource) => void) {
  Alert.alert(title, undefined, [
    { text: 'Take a photo', onPress: () => onPick('camera') },
    { text: 'Choose from library', onPress: () => onPick('library') },
    { text: 'Cancel', style: 'cancel' },
  ]);
}

export default function ProfessionalProfile() {
  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [profession, setProfession] = useState('');
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [catalogues, setCatalogues] = useState<Catalogue[]>([]);
  const [work, setWork] = useState<WorkPhoto[]>([]);
  const [selected, setSelected] = useState<Selected>('other');
  const [dialog, setDialog] = useState<{ mode: 'create' } | { mode: 'rename'; catalogue: Catalogue } | null>(null);
  const [editing, setEditing] = useState<WorkPhoto | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'avatar' | 'work' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setUserId(user.id);

      const [{ data: pro }, { data: cats }, { data: photos }] = await Promise.all([
        supabase.from('professionals').select('first_name, last_name, profession, avatar_path').eq('id', user.id).single(),
        supabase
          .from('portfolio_catalogues')
          .select('id, name')
          .eq('professional_id', user.id)
          .order('created_at', { ascending: true }),
        supabase
          .from('portfolio_photos')
          .select('id, path, caption, catalogue_id')
          .eq('professional_id', user.id)
          .order('created_at', { ascending: false }),
      ]);

      if (pro) {
        setName(`${pro.first_name} ${pro.last_name}`);
        setProfession(professionLabels[pro.profession] ?? pro.profession);
        setAvatarPath(pro.avatar_path);
      }
      setCatalogues(cats ?? []);
      setWork(photos ?? []);
      if (cats && cats.length > 0) setSelected(cats[0].id);
      setLoading(false);
    }

    load();
  }, []);

  // ----- Profile photo -----

  async function changeAvatar(source: PhotoSource) {
    if (!userId) return;
    setError(null);

    try {
      const uri = await pickPhoto(source, true);
      if (!uri) return;

      setBusy('avatar');
      const newPath = await uploadPhoto('professional-photos', userId, uri, 600);

      const { error: saveError } = await supabase.from('professionals').update({ avatar_path: newPath }).eq('id', userId);
      if (saveError) {
        await deletePhoto('professional-photos', newPath);
        throw new Error(saveError.message);
      }

      if (avatarPath) await deletePhoto('professional-photos', avatarPath);
      setAvatarPath(newPath);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update your photo.');
    } finally {
      setBusy(null);
    }
  }

  async function removeAvatar() {
    if (!userId || !avatarPath) return;
    setBusy('avatar');
    setError(null);

    const { error: saveError } = await supabase.from('professionals').update({ avatar_path: null }).eq('id', userId);

    if (saveError) {
      setError(saveError.message);
    } else {
      await deletePhoto('professional-photos', avatarPath);
      setAvatarPath(null);
    }
    setBusy(null);
  }

  function handleAvatarPress() {
    if (!avatarPath) {
      chooseSource('Add a profile photo', changeAvatar);
      return;
    }

    Alert.alert('Profile photo', undefined, [
      { text: 'Take a new photo', onPress: () => changeAvatar('camera') },
      { text: 'Choose from library', onPress: () => changeAvatar('library') },
      { text: 'Remove photo', style: 'destructive', onPress: removeAvatar },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  // ----- Catalogues -----

  async function createCatalogue(catalogueName: string) {
    if (!userId) return;

    const { data, error: saveError } = await supabase
      .from('portfolio_catalogues')
      .insert({ professional_id: userId, name: catalogueName })
      .select('id, name')
      .single();

    if (saveError || !data) {
      throw new Error(
        saveError?.code === '23505' ? 'You already have a catalogue with that name.' : saveError?.message ?? 'Could not create the catalogue.'
      );
    }

    setCatalogues((current) => [...current, data]);
    setSelected(data.id);
    setDialog(null);
  }

  async function renameCatalogue(catalogue: Catalogue, newName: string) {
    const { error: saveError } = await supabase.from('portfolio_catalogues').update({ name: newName }).eq('id', catalogue.id);

    if (saveError) {
      throw new Error(saveError.code === '23505' ? 'You already have a catalogue with that name.' : saveError.message);
    }

    setCatalogues((current) => current.map((c) => (c.id === catalogue.id ? { ...c, name: newName } : c)));
    setDialog(null);
  }

  function deleteCatalogue(catalogue: Catalogue) {
    const photos = work.filter((p) => p.catalogue_id === catalogue.id);

    Alert.alert(
      `Delete "${catalogue.name}"?`,
      photos.length > 0
        ? `Its ${photos.length} photo${photos.length === 1 ? '' : 's'} will be deleted too.`
        : 'This catalogue is empty.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setError(null);

            if (photos.length > 0) {
              await supabase.storage.from('professional-photos').remove(photos.map((p) => p.path));
            }

            const { error: deleteError } = await supabase.from('portfolio_catalogues').delete().eq('id', catalogue.id);
            if (deleteError) {
              setError(deleteError.message);
              return;
            }

            setCatalogues((current) => current.filter((c) => c.id !== catalogue.id));
            setWork((current) => current.filter((p) => p.catalogue_id !== catalogue.id));
            setSelected('other');
          },
        },
      ]
    );
  }

  function handleCatalogueOptions(catalogue: Catalogue) {
    Alert.alert(catalogue.name, undefined, [
      { text: 'Rename', onPress: () => setDialog({ mode: 'rename', catalogue }) },
      { text: 'Delete catalogue', style: 'destructive', onPress: () => deleteCatalogue(catalogue) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  // ----- Work photos -----

  async function addWorkPhoto(source: PhotoSource) {
    if (!userId) return;
    setError(null);

    try {
      const uri = await pickPhoto(source, false);
      if (!uri) return;

      setBusy('work');
      const path = await uploadPhoto('professional-photos', `${userId}/work`, uri, 1200);

      const { data, error: saveError } = await supabase
        .from('portfolio_photos')
        .insert({ professional_id: userId, path, catalogue_id: selected === 'other' ? null : selected })
        .select('id, path, caption, catalogue_id')
        .single();

      if (saveError || !data) {
        await deletePhoto('professional-photos', path);
        throw new Error(saveError?.message ?? 'Could not add the photo.');
      }

      setWork((current) => [data, ...current]);
      setEditing(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add the photo.');
    } finally {
      setBusy(null);
    }
  }

  async function savePhoto(caption: string | null, catalogueId: number | null) {
    if (!editing) return;

    const { error: saveError } = await supabase
      .from('portfolio_photos')
      .update({ caption, catalogue_id: catalogueId })
      .eq('id', editing.id);

    if (saveError) throw new Error(saveError.message);

    setWork((current) => current.map((p) => (p.id === editing.id ? { ...p, caption, catalogue_id: catalogueId } : p)));
    setEditing(null);
  }

  function removeWorkPhoto(photo: WorkPhoto) {
    Alert.alert('Remove this photo?', 'Customers will no longer see it on your profile.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const { error: deleteError } = await supabase.from('portfolio_photos').delete().eq('id', photo.id);
          if (deleteError) {
            setError(deleteError.message);
            return;
          }
          await deletePhoto('professional-photos', photo.path);
          setWork((current) => current.filter((p) => p.id !== photo.id));
          setEditing(null);
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

  const otherCount = work.filter((p) => p.catalogue_id === null).length;
  const showOther = catalogues.length === 0 || otherCount > 0;
  const tabs: { key: Selected; label: string; count: number; catalogue?: Catalogue }[] = [
    ...catalogues.map((c) => ({
      key: c.id as Selected,
      label: c.name,
      count: work.filter((p) => p.catalogue_id === c.id).length,
      catalogue: c,
    })),
    ...(showOther ? [{ key: 'other' as Selected, label: 'Other', count: otherCount }] : []),
  ];

  const activeKey: Selected = tabs.some((t) => t.key === selected) ? selected : tabs[0]?.key ?? 'other';
  const activeTab = tabs.find((t) => t.key === activeKey);
  const shown = work.filter((p) => (activeKey === 'other' ? p.catalogue_id === null : p.catalogue_id === activeKey));
  const canAdd = shown.length < PER_CATALOGUE && work.length < PER_CATALOGUE * MAX_CATALOGUES;

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
      <View style={styles.header}>
        <Pressable onPress={handleAvatarPress} disabled={busy !== null}>
          <Avatar name={name || '?'} url={professionalPhotoUrl(avatarPath)} size={112} />
          <View style={styles.cameraBadge}>
            {busy === 'avatar' ? (
              <ActivityIndicator size="small" color={colors.onAccent} />
            ) : (
              <Ionicons name="camera" size={18} color={colors.onAccent} />
            )}
          </View>
        </Pressable>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.profession}>{profession}</Text>
        <Text style={styles.hint}>{avatarPath ? 'Tap your photo to change it' : 'Add a clear photo of your face'}</Text>
      </View>

      <Text style={styles.sectionTitle}>My work</Text>
      <Text style={ui.muted}>Group your photos into catalogues. Tap a photo to add a description.</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {tabs.map((t) => (
          <Pressable
            key={String(t.key)}
            style={[ui.chip, activeKey === t.key && ui.chipSelected]}
            onPress={() => setSelected(t.key)}
            onLongPress={() => t.catalogue && handleCatalogueOptions(t.catalogue)}
          >
            <Text style={[ui.chipText, activeKey === t.key && ui.chipTextSelected]}>
              {t.label} ({t.count})
            </Text>
          </Pressable>
        ))}
        {catalogues.length < MAX_CATALOGUES && (
          <Pressable style={styles.newChip} onPress={() => setDialog({ mode: 'create' })}>
            <Ionicons name="add" size={16} color={colors.accentDark} />
            <Text style={styles.newChipText}>New catalogue</Text>
          </Pressable>
        )}
      </ScrollView>

      {activeTab?.catalogue && (
        <Pressable style={styles.optionsLink} onPress={() => handleCatalogueOptions(activeTab.catalogue!)}>
          <Ionicons name="ellipsis-horizontal" size={16} color={colors.textMuted} />
          <Text style={styles.optionsText}>Rename or delete "{activeTab.label}"</Text>
        </Pressable>
      )}

      {error && <Text style={ui.error}>{error}</Text>}

      <View style={styles.grid}>
        {canAdd && (
          <Pressable
            style={[styles.tile, styles.addTile]}
            onPress={() => chooseSource('Add a photo of your work', addWorkPhoto)}
            disabled={busy !== null}
          >
            {busy === 'work' ? (
              <ActivityIndicator color={colors.accentDark} />
            ) : (
              <>
                <Ionicons name="add" size={28} color={colors.accentDark} />
                <Text style={styles.addText}>Add photo</Text>
              </>
            )}
          </Pressable>
        )}

        {shown.map((photo) => (
          <Pressable key={photo.id} style={styles.tile} onPress={() => setEditing(photo)}>
            <Image source={{ uri: professionalPhotoUrl(photo.path) ?? undefined }} style={styles.image} contentFit="cover" transition={150} />
            {photo.caption ? (
              <View style={styles.captionBadge}>
                <Ionicons name="text" size={12} color="#FFFFFF" />
              </View>
            ) : null}
          </Pressable>
        ))}
      </View>

      {!canAdd && (
        <Text style={ui.help}>
          {shown.length >= PER_CATALOGUE ? 'This catalogue is full (12 photos).' : 'You have reached the limit of 60 photos.'}
        </Text>
      )}

      <NameDialog
        visible={dialog !== null}
        title={dialog?.mode === 'rename' ? 'Rename catalogue' : 'New catalogue'}
        initial={dialog?.mode === 'rename' ? dialog.catalogue.name : ''}
        submitLabel={dialog?.mode === 'rename' ? 'Save' : 'Create'}
        onCancel={() => setDialog(null)}
        onSubmit={(newName) =>
          dialog?.mode === 'rename' ? renameCatalogue(dialog.catalogue, newName) : createCatalogue(newName)
        }
      />

      <PhotoEditor
        visible={editing !== null}
        imageUrl={editing ? professionalPhotoUrl(editing.path) : null}
        caption={editing?.caption ?? null}
        catalogueId={editing?.catalogue_id ?? null}
        catalogues={catalogues}
        onClose={() => setEditing(null)}
        onSave={savePhoto}
        onDelete={() => editing && removeWorkPhoto(editing)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', marginBottom: spacing.xl },
  cameraBadge: { position: 'absolute', right: 0, bottom: 0, width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accentDark, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.background },
  name: { fontFamily: fonts.bold, fontSize: 22, color: colors.text, marginTop: spacing.md },
  profession: { fontFamily: fonts.medium, fontSize: 15, color: colors.accentDark, marginTop: 2 },
  hint: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted, marginTop: spacing.sm },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.text, marginBottom: spacing.xs },
  tabs: { gap: spacing.sm, paddingVertical: spacing.lg },
  newChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.accentDark, borderRadius: radius.pill, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  newChipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.accentDark },
  optionsLink: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginBottom: spacing.sm },
  optionsText: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  tile: { width: '31.5%', aspectRatio: 1, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.accentSoft },
  addTile: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.accentDark, backgroundColor: colors.surface },
  addText: { fontFamily: fonts.medium, fontSize: 12, color: colors.accentDark, marginTop: 2 },
  image: { width: '100%', height: '100%' },
  captionBadge: { position: 'absolute', left: 6, bottom: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0, 0, 0, 0.55)', alignItems: 'center', justifyContent: 'center' },
});