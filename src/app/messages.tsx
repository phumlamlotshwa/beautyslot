import { Ionicons } from '@expo/vector-icons';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { colors, fonts, radius, spacing } from '../lib/theme';
import { ui } from '../lib/ui';

type Person = { first_name: string; last_name: string } | null;

type LastMessage = {
  body: string;
  created_at: string;
  sender_id: string;
};

type Conversation = {
  id: number;
  customer_id: string;
  last_message_at: string;
  customers: Person;
  professionals: Person;
  messages: LastMessage[];
};

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatWhen(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  return `${d.getDate()} ${monthNames[d.getMonth()]}`;
}

export default function Messages() {
  const [myId, setMyId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      async function loadConversations() {
        setError(null);

        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          setLoading(false);
          return;
        }

        setMyId(user.id);

        const { data, error: loadError } = await supabase
          .from('conversations')
          .select(
            'id, customer_id, last_message_at, customers(first_name, last_name), professionals(first_name, last_name), messages(body, created_at, sender_id)'
          )
          .order('last_message_at', { ascending: false })
          .order('created_at', { referencedTable: 'messages', ascending: false })
          .limit(1, { referencedTable: 'messages' });

        if (loadError) {
          setError(loadError.message);
          setLoading(false);
          return;
        }

        const { data: unread } = await supabase
          .from('messages')
          .select('conversation_id')
          .is('read_at', null)
          .neq('sender_id', user.id);

        const counts: Record<number, number> = {};
        for (const row of unread ?? []) {
          counts[row.conversation_id] = (counts[row.conversation_id] ?? 0) + 1;
        }

        setConversations((data ?? []) as unknown as Conversation[]);
        setUnreadCounts(counts);
        setLoading(false);
      }

      loadConversations();
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
        data={conversations}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={error ? <Text style={[ui.error, { paddingHorizontal: spacing.lg }]}>{error}</Text> : null}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="chatbubbles-outline" size={40} color={colors.textFaint} />
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptyText}>Your conversations will show up here.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const iAmCustomer = item.customer_id === myId;
          const other = iAmCustomer ? item.professionals : item.customers;
          const name = other ? `${other.first_name} ${other.last_name}` : 'Unknown';
          const last = item.messages[0];
          const unread = unreadCounts[item.id] ?? 0;

          let preview = 'No messages yet';
          if (last) preview = last.sender_id === myId ? `You: ${last.body}` : last.body;

          return (
            <Link href={{ pathname: '/chat/[conversationId]', params: { conversationId: String(item.id) } }} asChild>
              <Pressable style={styles.row}>
                <View style={ui.avatar}>
                  <Text style={ui.avatarText}>{name.charAt(0)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.rowTop}>
                    <Text style={[styles.name, unread > 0 && styles.nameUnread]} numberOfLines={1}>
                      {name}
                    </Text>
                    <Text style={[styles.when, unread > 0 && styles.whenUnread]}>
                      {formatWhen(last?.created_at ?? item.last_message_at)}
                    </Text>
                  </View>
                  <View style={styles.rowBottom}>
                    <Text style={[styles.preview, unread > 0 && styles.previewUnread]} numberOfLines={1}>
                      {preview}
                    </Text>
                    {unread > 0 && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{unread}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </Pressable>
            </Link>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: spacing.sm, flexGrow: 1 },
  emptyBox: { alignItems: 'center', marginTop: 80, paddingHorizontal: spacing.xl },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.text, marginTop: spacing.md },
  emptyText: { fontFamily: fonts.regular, fontSize: 15, color: colors.textMuted, marginTop: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, marginTop: 4 },
  name: { flex: 1, fontFamily: fonts.medium, fontSize: 16, color: colors.text },
  nameUnread: { fontFamily: fonts.bold },
  when: { fontFamily: fonts.regular, fontSize: 12, color: colors.textFaint },
  whenUnread: { fontFamily: fonts.medium, color: colors.accentDark },
  preview: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted },
  previewUnread: { fontFamily: fonts.medium, color: colors.text },
  badge: { minWidth: 22, height: 22, borderRadius: radius.pill, backgroundColor: colors.accentDark, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { fontFamily: fonts.bold, fontSize: 12, color: colors.onAccent },
});