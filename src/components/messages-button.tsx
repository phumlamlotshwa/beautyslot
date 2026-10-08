import { Ionicons } from '@expo/vector-icons';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { getUnreadCount } from '../lib/chat';
import { supabase } from '../lib/supabase';
import { colors, fonts, radius, spacing } from '../lib/theme';

type Props = {
  style?: StyleProp<ViewStyle>;
};

export function MessagesButton({ style }: Props) {
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    setUnread(await getUnreadCount());
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  useEffect(() => {
    const channel = supabase
      .channel(`unread-messages-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        refresh();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  return (
    <Link href="/messages" asChild>
      <Pressable style={StyleSheet.flatten([styles.button, style])}>
        <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.accentDark} />
        <Text style={styles.text}>Messages</Text>
        {unread > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
          </View>
        )}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
  },
  text: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  badge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.accentDark, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { fontFamily: fonts.bold, fontSize: 12, color: colors.onAccent },
});