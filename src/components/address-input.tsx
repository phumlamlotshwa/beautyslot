import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { getPlace, Place, searchAddresses, Suggestion } from '../lib/maps';
import { fonts, radius, spacing } from '../lib/theme';
import { makeStyles, useTheme } from '../lib/theme-context';
import { useUi } from '../lib/ui';

type Props = {
  value: Place | null;
  onChange: (place: Place | null) => void;
  placeholder?: string;
};

export function AddressInput({ value, onChange, placeholder = 'Start typing your address' }: Props) {
  const ui = useUi();
  const styles = useStyles();
  const { colors } = useTheme();
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
          setError(e instanceof Error ? e.message : "Address search isn't working right now. Check your connection and try again.");
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
      setError(e instanceof Error ? e.message : "That address didn't load. Pick it from the list again.");
    } finally {
      setChoosing(false);
    }
  }

  return (
    <View>
      <View style={styles.inputRow}>
        <Ionicons name="search" size={18} color={colors.textFaint} style={styles.searchIcon} />
        <TextInput
          style={[ui.input, styles.input]}
          value={query}
          onChangeText={handleChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textFaint}
          autoCorrect={false}
        />
        {(searching || choosing) && <ActivityIndicator style={styles.spinner} color={colors.text} />}
      </View>

      {value && (
        <View style={styles.confirmedRow}>
          <Ionicons name="checkmark-circle" size={16} color={colors.text} />
          <Text style={styles.confirmed}>Address found</Text>
        </View>
      )}
      {error && <Text style={ui.error}>{error}</Text>}

      {suggestions.length > 0 && (
        <View style={styles.list}>
          {suggestions.map((s) => (
            <Pressable key={s.placeId} style={styles.option} onPress={() => handleSelect(s)}>
              <Ionicons name="location-outline" size={18} color={colors.textMuted} />
              <Text style={styles.optionText}>{s.text}</Text>
            </Pressable>
          ))}
          <Text style={styles.attribution}>Powered by Google</Text>
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  searchIcon: { position: 'absolute', left: 12, zIndex: 1 },
  input: { flex: 1, paddingLeft: 38, paddingRight: 40 },
  spinner: { position: 'absolute', right: 12 },
  confirmedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm },
  confirmed: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  list: { backgroundColor: colors.surface, borderRadius: radius.sm, marginTop: spacing.xs, overflow: 'hidden' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionText: { flex: 1, fontFamily: fonts.regular, fontSize: 15, lineHeight: 20, color: colors.text },
  attribution: { fontFamily: fonts.regular, fontSize: 11, color: colors.textFaint, textAlign: 'right', padding: 6 },
}));