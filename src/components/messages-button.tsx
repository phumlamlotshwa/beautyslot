import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getUnreadCount } from '../lib/chat';
import { supabase } from '../lib/supabase';

export function MessagesButton() {
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
      <Pressable style={styles.button}>
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
  button: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#000000', borderRadius: 8, padding: 14, marginBottom: 12 },
  text: { color: '#000000', fontSize: 16, fontWeight: '600' },
  badge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
});