import { Directory, File, Paths } from 'expo-file-system';
import { ordersService } from '@/services/ordersService';
import { formatVoiceLength } from './listVoice';
import { PrepareListPhoto, SavedList, useListStore } from '@/state/listStore';

/*
 * Photos of a written (paper) list, kept with a saved list on this phone. A picked photo lives in
 * the image picker's cache, which Android may clear, so it's copied into the app's own documents.
 */

function photosDir(): Directory {
  return new Directory(Paths.document, 'list-photos');
}

/** A copy of the picked photo the app keeps; the original uri if copying isn't possible. */
export function keepListPhoto(uri: string, name: string): string {
  try {
    const dir = photosDir();
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    const extension = (name.split('.').pop() ?? '').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg';
    const target = new File(dir, `list-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`);
    new File(uri).copy(target);
    return target.uri;
  } catch {
    return uri;
  }
}

/** Removes kept photos no saved list (and no list being edited) uses any more. */
export function pruneListPhotos(): void {
  try {
    const { lists, draft } = useListStore.getState();
    const used = new Set([...lists.flatMap((list) => list.photos ?? []), ...(draft.photos ?? [])].map((photo) => photo.uri));
    const dir = photosDir();
    if (!dir.exists) return;
    for (const entry of dir.list()) {
      if (entry instanceof File && !used.has(entry.uri)) entry.delete();
    }
  } catch {
    // Leaving a stray photo behind is harmless.
  }
}

/**
 * Uploads the list's photos that haven't been sent before, one request each, and returns every
 * photo's link for the order. `remember()` stores the new links on the list once the order has
 * really been sent, so sending the same list again doesn't upload them again (a link from an
 * order that failed could be cleaned up later, so it isn't kept).
 */
export async function uploadListPhotos(list: SavedList): Promise<{ urls: string[]; remember: () => void }> {
  const uploaded: Record<string, string> = {};
  const urls: string[] = [];
  for (const photo of list.photos ?? []) {
    if (photo.url) {
      urls.push(photo.url);
      continue;
    }
    const { url } = await ordersService.uploadListPhoto(photo);
    uploaded[photo.id] = url;
    urls.push(url);
  }
  return {
    urls,
    remember: () => {
      if (Object.keys(uploaded).length > 0) useListStore.getState().setPhotoUrls(list.id, uploaded);
    },
  };
}

/** "3 items", "2 photos", "Voice 0:12" or a mix — what a list (or an order) holds. */
export function listCountText(
  t: (key: string, options?: Record<string, unknown>) => string,
  items: number,
  photos: number,
  voiceSeconds: number | null = null,
): string {
  const voice = voiceSeconds != null;
  const parts = [
    items > 0 || (photos === 0 && !voice) ? t('prepareList.itemsCount', { count: items }) : '',
    photos > 0 ? t('prepareList.photosCount', { count: photos }) : '',
    voice ? t('voice.countLine', { length: formatVoiceLength(voiceSeconds) }) : '',
  ];
  return parts.filter(Boolean).join(' · ');
}

export type { PrepareListPhoto };
