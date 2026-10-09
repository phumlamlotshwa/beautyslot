import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { fonts, spacing } from '../lib/theme';

export type ViewerPhoto = { id: number; url: string; caption: string | null };

type Props = {
  photos: ViewerPhoto[];
  startIndex: number | null;
  onClose: () => void;
};

export function PhotoViewer({ photos, startIndex, onClose }: Props) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (startIndex !== null) setIndex(startIndex);
  }, [startIndex]);

  const current = photos[index];

  return (
    <Modal visible={startIndex !== null} animationType="fade" onRequestClose={onClose}>
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <Text style={styles.counter}>
            {photos.length > 1 ? `${index + 1} / ${photos.length}` : ''}
          </Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close photo">
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </Pressable>
        </View>

        {startIndex !== null && (
          <FlatList
            data={photos}
            keyExtractor={(p) => String(p.id)}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={startIndex}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
            renderItem={({ item }) => (
              <View style={{ width, flex: 1, justifyContent: 'center' }}>
                <Image source={{ uri: item.url }} style={{ width, height: '100%' }} contentFit="contain" transition={150} />
              </View>
            )}
          />
        )}

        <View style={styles.captionArea}>
          {current?.caption ? <Text style={styles.caption}>{current.caption}</Text> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingTop: 60, paddingBottom: spacing.md },
  counter: { fontFamily: fonts.medium, fontSize: 15, color: '#FFFFFF' },
  captionArea: { minHeight: 90, paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: 40 },
  caption: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 22, color: '#FFFFFF' },
});