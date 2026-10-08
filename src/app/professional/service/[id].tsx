import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../../../lib/supabase';

const categories = ['Hair', 'Braids', 'Barbering', 'Nails', 'Makeup'];

export default function EditService() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadService() {
      const { data, error: loadError } = await supabase
        .from('services')
        .select('name, category, price, duration_minutes')
        .eq('id', id)
        .single();

      if (loadError || !data) {
        setError(loadError?.message ?? 'Service not found.');
      } else {
        setName(data.name);
        setCategory(data.category);
        setPrice(String(data.price));
        setDuration(String(data.duration_minutes));
      }

      setLoading(false);
    }

    loadService();
  }, [id]);

  async function handleSave() {
    setError(null);

    const priceNumber = Number(price.replace(',', '.'));
    const durationNumber = Number(duration);

    if (!name.trim() || !category || !price || !duration) {
      setError('Please fill in all the fields.');
      return;
    }
    if (isNaN(priceNumber) || priceNumber < 0) {
      setError('Please enter a valid price.');
      return;
    }
    if (!Number.isInteger(durationNumber) || durationNumber <= 0) {
      setError('Please enter the duration in whole minutes, like 60.');
      return;
    }

    setSaving(true);

    const { error: saveError } = await supabase
      .from('services')
      .update({
        name: name.trim(),
        category,
        price: priceNumber,
        duration_minutes: durationNumber,
      })
      .eq('id', id);

    setSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    router.back();
  }

  function handleDelete() {
    Alert.alert('Delete service', `Are you sure you want to delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: deleteService },
    ]);
  }

  async function deleteService() {
    setError(null);
    setSaving(true);

    const { error: deleteError } = await supabase.from('services').delete().eq('id', id);

    setSaving(false);

    if (deleteError) {
      setError(
        deleteError.code === '23503'
          ? "This service has bookings, so it can't be deleted."
          : deleteError.message
      );
      return;
    }

    router.back();
  }

  if (loading) {
    return (
      <View style={[styles.screen, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#000000" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Service name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} />

        <Text style={styles.label}>Category</Text>
        <View style={styles.wrap}>
          {categories.map((c) => (
            <Pressable
              key={c}
              style={[styles.choice, category === c && styles.choiceSelected]}
              onPress={() => setCategory(c)}
            >
              <Text style={[styles.choiceText, category === c && styles.choiceTextSelected]}>{c}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Price (R)</Text>
        <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />

        <Text style={styles.label}>Duration (minutes)</Text>
        <TextInput style={styles.input} value={duration} onChangeText={setDuration} keyboardType="number-pad" />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable style={[styles.button, saving && styles.buttonDisabled]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Save changes</Text>}
        </Pressable>

        <Pressable style={styles.deleteButton} onPress={handleDelete} disabled={saving}>
          <Text style={styles.deleteButtonText}>Delete service</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 24, paddingBottom: 48 },
  label: { fontSize: 14, color: '#333333', marginTop: 16, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#cccccc', borderRadius: 8, padding: 12, fontSize: 16, color: '#000000' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { borderWidth: 1, borderColor: '#cccccc', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16 },
  choiceSelected: { backgroundColor: '#000000', borderColor: '#000000' },
  choiceText: { color: '#000000' },
  choiceTextSelected: { color: '#ffffff' },
  error: { color: '#c62828', marginTop: 16 },
  button: { backgroundColor: '#000000', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 24 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  deleteButton: { borderWidth: 1, borderColor: '#c62828', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 12 },
  deleteButtonText: { color: '#c62828', fontSize: 16, fontWeight: '600' },
});