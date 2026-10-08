import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

export type PhotoSource = 'library' | 'camera';
type Bucket = 'professional-photos' | 'customer-photos';

export async function pickPhoto(source: PhotoSource, square: boolean): Promise<string | null> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new Error(
      source === 'camera'
        ? 'BeautySlot needs camera access. You can allow it in your phone settings.'
        : 'BeautySlot needs access to your photos. You can allow it in your phone settings.'
    );
  }

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: square,
    aspect: square ? [1, 1] : undefined,
    quality: 1,
  };

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

  if (result.canceled || !result.assets?.length) return null;
  return result.assets[0].uri;
}

async function shrink(uri: string, maxWidth: number): Promise<string> {
  const context = ImageManipulator.ImageManipulator.manipulate(uri);
  context.resize({ width: maxWidth });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: 0.8, format: ImageManipulator.SaveFormat.JPEG });
  return saved.uri;
}

export async function uploadPhoto(bucket: Bucket, folder: string, uri: string, maxWidth: number): Promise<string> {
  const small = await shrink(uri, maxWidth);
  const body = await (await fetch(small)).arrayBuffer();
  const path = `${folder}/${Date.now()}.jpg`;

  const { error } = await supabase.storage.from(bucket).upload(path, body, {
    contentType: 'image/jpeg',
    upsert: false,
  });

  if (error) throw new Error(error.message);
  return path;
}

export async function deletePhoto(bucket: Bucket, path: string) {
  await supabase.storage.from(bucket).remove([path]);
}

export function professionalPhotoUrl(path: string | null): string | null {
  if (!path) return null;
  return supabase.storage.from('professional-photos').getPublicUrl(path).data.publicUrl;
}

export async function customerPhotoUrls(paths: (string | null | undefined)[]): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  if (unique.length === 0) return {};

  const { data } = await supabase.storage.from('customer-photos').createSignedUrls(unique, 60 * 60);

  const urls: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) urls[item.path] = item.signedUrl;
  }
  return urls;
}