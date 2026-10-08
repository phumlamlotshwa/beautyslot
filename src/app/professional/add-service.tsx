import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { OfferedAt, offeredAtOptions } from '../../lib/format';
import { supabase } from '../../lib/supabase';

const categories = ['Hair', 'Braids', 'Barbering', 'Nails', 'Makeup'];

export default function AddService() {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [offeredAt, setOfferedAt] = useState<OfferedAt>('at_professional');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError('You need to be logged in to add a service.');
      setLoading(false);
      return;
    }

    const { error: saveError } = await supabase.from('services').insert({
      professional_id: user.id,
      name: name.trim(),
      category,
      offered_at: offeredAt,
      price: priceNumber,
      duration_minutes: durationNumber,
    });

    setLoading(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    router.back();
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Service name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Gel manicure" placeholderTextColor="#999999" />

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

        <Text style={styles.label}>Where do you offer it?</Text>
        <View style={styles.wrap}>
          {offeredAtOptions.map((o) => (
            <Pressable
              key={o.value}
              style={[styles.choice, offeredAt === o.value && styles.choiceSelected]}
              onPress={() => setOfferedAt(o.value)}
            >
              <Text style={[styles.choiceText, offeredAt === o.value && styles.choiceTextSelected]}>{o.label}</Text>
            </Pressable>
          ))}
        </View>
        {offeredAt !== 'at_professional' && (
          <Text style={styles.help}>
            Make sure your address and call-out fee are set under Home visits.
          </Text>
        )}

        <Text style={styles.label}>Price (R)</Text>
        <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="e.g. 250" placeholderTextColor="#999999" />

        <Text style={styles.label}>Duration (minutes)</Text>
        <TextInput style={styles.input} value={duration} onChangeText={setDuration} keyboardType="number-pad" placeholder="e.g. 60" placeholderTextColor="#999999" />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={handleSave} disabled={loading}>
          {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Save service</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 24, paddingBottom: 48 },
  label: { fontSize: 14, color: '#333333', marginTop: 16, marginBottom: 6 },
  help: { fontSize: 13, color: '#666666', marginTop: 8 },
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
});