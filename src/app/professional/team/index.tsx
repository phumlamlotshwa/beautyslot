import { Ionicons } from '@expo/vector-icons';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../../../components/avatar';
import { professionalPhotoUrl } from '../../../lib/photos';
import { supabase } from '../../../lib/supabase';
import { fonts, radius, spacing } from '../../../lib/theme';
import { makeStyles, useTheme } from '../../../lib/theme-context';
import { useUi } from '../../../lib/ui';

type Member = {
  id: number;
  name: string;
  avatar_path: string | null;
  is_active: boolean;
  category: string | null;
  staff_services: { service_id: number }[];
};

export default function Team() {
  const ui = useUi();
  const styles = useStyles();
  const { colors } = useTheme();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      async function load() {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        const { data, error: loadError } = await supabase
          .from('staff')
          .select('id, name, avatar_path, is_active, category, staff_services(service_id)')
          .eq('professional_id', user.id)
          .order('created_at', { ascending: true });

        if (loadError) {
          setError("We couldn't load your team. Check your connection and try again.");
        } else {
          setMembers((data ?? []) as Member[]);
        }
        setLoading(false);
      }

      load();
    }, []),
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
            <Link href={{ pathname: '/professional/team/[staffId]', params: { staffId: 'new' } }} asChild>
              <Pressable style={styles.addButton}>
                <Ionicons name="person-add-outline" size={18} color={colors.onAccent} />
                <Text style={styles.addText}>Add someone</Text>
              </Pressable>
            </Link>
            {error && <Text style={ui.error}>{error}</Text>}
          </>
        }
        renderItem={({ item }) => {
          const count = item.staff_services.length;
          const servicesText = count === 0 ? 'No services yet' : `${count} service${count === 1 ? '' : 's'}`;
          return (
            <Link href={{ pathname: '/professional/team/[staffId]', params: { staffId: String(item.id) } }} asChild>
              <Pressable style={StyleSheet.flatten([styles.card, !item.is_active && styles.cardInactive])}>
                <Avatar name={item.name} url={professionalPhotoUrl(item.avatar_path)} size={48} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  {item.is_active ? (
                    <Text style={styles.details}>
                      {item.category ? `${item.category} · ${servicesText}` : servicesText}
                    </Text>
                  ) : (
                    <Text style={styles.inactive}>Not taking bookings</Text>
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

const useStyles = makeStyles((colors) => ({
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accentDark,
    borderRadius: 10,
    padding: 14,
    marginBottom: spacing.lg,
  },
  addText: { fontFamily: fonts.semiBold, fontSize: 16, color: colors.onAccent },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardInactive: { opacity: 0.6 },
  name: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  details: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted, marginTop: 2 },
  inactive: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted, marginTop: 2 },
}));