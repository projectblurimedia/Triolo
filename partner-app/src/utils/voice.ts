/** 0:07, 1:42 — a voice message's length. */
export function formatVoiceLength(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** Longest voice message, in seconds (the server's limit). */
export const MAX_VOICE_SECONDS = 180;

/** A recorded voice message: the file on this phone (or its link once uploaded) and its length. */
export interface RecordedVoice {
  uri: string;
  seconds: number;
}
