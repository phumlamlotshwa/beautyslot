import { Ionicons } from '@expo/vector-icons';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { getUnreadCount } from '../lib/chat';
import { supabase } from '../lib/supabase';
import { fonts, radius, spacing } from '../lib/theme';
import { makeStyles, useTheme } from '../lib/theme-context';
import { CountBadge } from './count-badge';

type Props = {
  style?: StyleProp<ViewStyle>;
  variant?: 'row' | 'tile';
};

export function MessagesButton({ style, variant = 'row' }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
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

  const isTile = variant === 'tile';

  return (
    <Link href="/messages" asChild>
      <Pressable style={StyleSheet.flatten([styles.button, isTile && styles.tile, style])}>
        <Ionicons name="chatbubble-ellipses-outline" size={isTile ? 24 : 20} color={colors.text} />
        <Text style={styles.text}>Messages</Text>
        {isTile ? (
          unread > 0 && (
            <View style={styles.cornerBadge}>
              <CountBadge count={unread} />
            </View>
          )
        ) : (
          <CountBadge count={unread} />
        )}
      </Pressable>
    </Link>
  );
}

const useStyles = makeStyles((colors) => ({
  button: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 14,
  },
  tile: { flexDirection: 'column', gap: 6, paddingVertical: 18 },
  text: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.text },
  cornerBadge: { position: 'absolute', top: 10, right: 10 },
}));