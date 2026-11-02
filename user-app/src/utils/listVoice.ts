import { Directory, File, Paths } from 'expo-file-system';
import { ordersService } from '@/services/ordersService';
import { SavedList, useListStore } from '@/state/listStore';

/*
 * A voice message of a list, kept with the saved list on this phone. The recorder writes to its
 * cache, which Android may clear, so the recording is copied into the app's own documents.
 */

function voiceDir(): Directory {
  return new Directory(Paths.document, 'list-voice');
}

/** A copy of the recording the app keeps; the original uri if copying isn't possible. */
export function keepListVoice(uri: string): string {
  try {
    const dir = voiceDir();
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    const target = new File(dir, `voice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.m4a`);
    new File(uri).copy(target);
    return target.uri;
  } catch {
    return uri;
  }
}

/** Removes kept recordings no saved list (and no list being edited) uses any more. */
export function pruneListVoices(): void {
  try {
    const { lists, draft } = useListStore.getState();
    const used = new Set([...lists.map((list) => list.voice?.uri), draft.voice?.uri].filter(Boolean));
    const dir = voiceDir();
    if (!dir.exists) return;
    for (const entry of dir.list()) {
      if (entry instanceof File && !used.has(entry.uri)) entry.delete();
    }
  } catch {
    // Leaving a stray recording behind is harmless.
  }
}

/**
 * Uploads the list's voice message (unless it was sent before) and returns its link and length
 * for the order. `remember()` stores the link once the order has really been sent.
 */
export async function uploadListVoice(
  list: SavedList,
): Promise<{ url: string | null; seconds: number | null; remember: () => void }> {
  const voice = list.voice;
  if (!voice) return { url: null, seconds: null, remember: () => undefined };
  if (voice.url) return { url: voice.url, seconds: voice.seconds, remember: () => undefined };
  const uploaded = await ordersService.uploadListVoice(voice);
  return {
    url: uploaded.url,
    seconds: uploaded.seconds ?? voice.seconds,
    remember: () => useListStore.getState().setVoiceUrl(list.id, uploaded.url),
  };
}

/** 0:07, 1:42 — a voice message's length. */
export function formatVoiceLength(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
