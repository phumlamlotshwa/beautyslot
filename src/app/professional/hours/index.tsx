import { Ionicons } from '@expo/vector-icons';
import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../../../components/avatar';
import { HoursRow, summarizeHours } from '../../../lib/hours';
import { professionalPhotoUrl } from '../../../lib/photos';
import { supabase } from '../../../lib/supabase';
import { colors, fonts, radius, spacing } from '../../../lib/theme';
import { ui } from '../../../lib/ui';

type Member = {
  id: number;
  name: string;
  avatar_path: string | null;
  working_hours: HoursRow[];
};

export default function TeamHours() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      async function load() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        const { data, error: loadError } = await supabase
          .from('staff')
          .select('id, name, avatar_path, working_hours(day_of_week, start_time, end_time)')
          .eq('professional_id', user.id)
          .eq('is_active', true)
          .order('created_at', { ascending: true });

        if (loadError) {
          setError(loadError.message);
          setLoading(false);
          return;
        }

        const team = (data ?? []) as Member[];

        if (team.length === 1) {
          router.replace({ pathname: '/professional/hours/[staffId]', params: { staffId: String(team[0].id) } });
          return;
        }

        setMembers(team);
        setLoading(false);
      }

      load();
    }, [])
  );

  if (loading) {
    return (
      <View style={ui.centered}>
        <ActivityIndicator size="large" color={colors.accentDark} />
      </View>
    );
  }

  return (
    <View style={ui.screen}>
      <FlatList
        data={members}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={ui.content}
        ListHeaderComponent={
          <>
            <Text style={ui.muted}>Your team's week at a glance. Tap someone to change their hours.</Text>
            {error && <Text style={ui.error}>{error}</Text>}
            <View style={{ height: spacing.lg }} />
          </>
        }
        renderItem={({ item }) => {
          const lines = summarizeHours(item.working_hours);
          return (
            <Link href={{ pathname: '/professional/hours/[staffId]', params: { staffId: String(item.id) } }} asChild>
              <Pressable style={styles.card}>
                <Avatar name={item.name} url={professionalPhotoUrl(item.avatar_path)} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  {lines.length > 0 ? (
                    lines.map((line) => (
                      <Text key={line} style={styles.hours}>
                        {line}
                      </Text>
                    ))
                  ) : (
                    <Text style={styles.noHours}>No hours set. Customers can't book them yet.</Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
              </Pressable>
            </Link>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.md },
  name: { fontFamily: fonts.bold, fontSize: 16, color: colors.text, marginBottom: 2 },
  hours: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted, marginTop: 2 },
  noHours: { fontFamily: fonts.medium, fontSize: 13, color: colors.warning, marginTop: 2 },
});