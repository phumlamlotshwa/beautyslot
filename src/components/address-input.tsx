import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { getPlace, Place, searchAddresses, Suggestion } from '../lib/maps';

type Props = {
  value: Place | null;
  onChange: (place: Place | null) => void;
  placeholder?: string;
};

export function AddressInput({ value, onChange, placeholder = 'Start typing your address' }: Props) {
  const [query, setQuery] = useState(value?.address ?? '');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestQuery = useRef('');

  useEffect(() => {
    if (value) setQuery(value.address);
  }, [value?.address]);

  useEffect(() => {
    const text = query.trim();

    if ((value && text === value.address) || text.length < 3) {
      setSuggestions([]);
      return;
    }

    latestQuery.current = text;

    const timer = setTimeout(async () => {
      setSearching(true);
      setError(null);

      try {
        const results = await searchAddresses(text);
        if (latestQuery.current === text) setSuggestions(results);
      } catch (e) {
        if (latestQuery.current === text) {
          setError(e instanceof Error ? e.message : 'Address search failed.');
        }
      } finally {
        if (latestQuery.current === text) setSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [query, value]);

  function handleChangeText(text: string) {
    setQuery(text);
    if (value) onChange(null);
  }

  async function handleSelect(suggestion: Suggestion) {
    setChoosing(true);
    setError(null);
    setSuggestions([]);

    try {
      const place = await getPlace(suggestion.placeId);
      setQuery(place.address);
      onChange(place);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load that address.');
    } finally {
      setChoosing(false);
    }
  }

  return (
    <View>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={handleChangeText}
          placeholder={placeholder}
          placeholderTextColor="#999999"
          autoCorrect={false}
        />
        {(searching || choosing) && <ActivityIndicator style={styles.spinner} color="#000000" />}
      </View>

      {value && <Text style={styles.confirmed}>✓ Address confirmed</Text>}
      {error && <Text style={styles.error}>{error}</Text>}

      {suggestions.length > 0 && (
        <View style={styles.list}>
          {suggestions.map((s) => (
            <Pressable key={s.placeId} style={styles.option} onPress={() => handleSelect(s)}>
              <Text style={styles.optionText}>{s.text}</Text>
            </Pressable>
          ))}
          <Text style={styles.attribution}>Powered by Google</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, borderWidth: 1, borderColor: '#cccccc', borderRadius: 8, padding: 12, fontSize: 16, color: '#000000' },
  spinner: { position: 'absolute', right: 12 },
  confirmed: { color: '#1b7a3d', fontSize: 14, marginTop: 6 },
  error: { color: '#c62828', fontSize: 14, marginTop: 6 },
  list: { borderWidth: 1, borderColor: '#eeeeee', borderRadius: 8, marginTop: 4, overflow: 'hidden' },
  option: { paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  optionText: { fontSize: 15, color: '#000000' },
  attribution: { fontSize: 11, color: '#999999', textAlign: 'right', padding: 6 },
});