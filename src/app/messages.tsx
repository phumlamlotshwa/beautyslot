import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';

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
      <View style={[styles.screen, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#000000" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={conversations}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.content}
        ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : null}
        ListEmptyComponent={<Text style={styles.empty}>No messages yet.</Text>}
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
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{name.charAt(0)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.rowTop}>
                    <Text style={[styles.name, unread > 0 && styles.bold]} numberOfLines={1}>
                      {name}
                    </Text>
                    <Text style={styles.when}>{formatWhen(last?.created_at ?? item.last_message_at)}</Text>
                  </View>
                  <View style={styles.rowBottom}>
                    <Text style={[styles.preview, unread > 0 && styles.unreadPreview]} numberOfLines={1}>
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
  screen: { flex: 1, backgroundColor: '#ffffff' },
  content: { paddingVertical: 8, flexGrow: 1 },
  error: { color: '#c62828', padding: 16 },
  empty: { fontSize: 16, color: '#666666', textAlign: 'center', marginTop: 48 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { color: '#ffffff', fontSize: 20, fontWeight: '700' },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 4 },
  name: { flex: 1, fontSize: 16, color: '#000000' },
  bold: { fontWeight: '700' },
  when: { fontSize: 12, color: '#888888' },
  preview: { flex: 1, fontSize: 14, color: '#666666' },
  unreadPreview: { color: '#000000', fontWeight: '600' },
  badge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
});