/**
 * Makes a big ad video much smaller in the browser before it's uploaded, so a slow upload
 * line isn't the bottleneck: an 88 MB phone video takes ~2 minutes to send at 6 Mbit/s,
 * the shrunk copy ~15 seconds. The apps only ever play a 720p copy, so nothing visible is lost.
 *
 * How: the video plays (silently) into a canvas at most 1280 px on its long side, and the
 * canvas plus the video's sound are recorded with MediaRecorder at a phone-friendly bitrate.
 * That runs in real time, so it takes as long as the video (ads are at most 30 seconds).
 *
 * Falls back to the original file whenever the browser can't do this, something goes wrong,
 * or the result isn't actually smaller.
 */

/** Files at or under this size go up as they are (shrinking wouldn't save much time). */
export const SHRINK_ABOVE_BYTES = 15 * 1024 * 1024;
const MAX_LONG_SIDE = 1280;
const VIDEO_BITS_PER_SECOND = 2_800_000;
const AUDIO_BITS_PER_SECOND = 128_000;
const FPS = 30;

function pickMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  // WebM first: its recorder pauses and resumes cleanly (needed while the video stops to load;
  // Chrome's MP4 recorder doesn't). Cloudinary turns it into MP4 for the phones anyway.
  const candidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

/** Whether this browser can shrink videos before upload. */
export function canShrinkVideo(): boolean {
  const canvas = document.createElement('canvas') as HTMLCanvasElement & { captureStream?: unknown };
  return !!pickMimeType() && typeof canvas.captureStream === 'function' && typeof AudioContext !== 'undefined';
}

export async function shrinkVideo(file: File, onProgress?: (share: number) => void): Promise<File> {
  const mimeType = pickMimeType();
  if (!mimeType || !canShrinkVideo()) return file;

  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.src = url;
  video.playsInline = true;
  video.preload = 'auto';
  let audioContext: AudioContext | null = null;

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('unreadable'));
    });

    const scale = Math.min(1, MAX_LONG_SIDE / Math.max(video.videoWidth, video.videoHeight));
    // Even sizes keep video encoders happy.
    const width = Math.max(2, Math.round((video.videoWidth * scale) / 2) * 2);
    const height = Math.max(2, Math.round((video.videoHeight * scale) / 2) * 2);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return file;

    const stream = (canvas as HTMLCanvasElement & { captureStream: (fps: number) => MediaStream }).captureStream(FPS);
    // The sound goes through Web Audio into the recording only — nothing plays out loud.
    audioContext = new AudioContext();
    const source = audioContext.createMediaElementSource(video);
    const destination = audioContext.createMediaStreamDestination();
    source.connect(destination);
    destination.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
    // An audio context can start paused until the page has been interacted with.
    await audioContext.resume().catch(() => undefined);

    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: VIDEO_BITS_PER_SECOND,
      audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
    });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });

    // Draw each frame as it plays.
    let drawing = true;
    // Paced by the video's own frames where the browser supports it (screen repaints can be
    // slowed down or skipped), else by repaints.
    const withFrames = video as HTMLVideoElement & { requestVideoFrameCallback?: (callback: () => void) => number };
    const next = (callback: () => void) =>
      withFrames.requestVideoFrameCallback ? withFrames.requestVideoFrameCallback(callback) : requestAnimationFrame(callback);
    const draw = () => {
      if (!drawing) return;
      context.drawImage(video, 0, 0, width, height);
      onProgress?.(video.duration ? Math.min(1, video.currentTime / video.duration) : 0);
      next(draw);
    };

    const ended = new Promise<void>((resolve) => {
      video.onended = () => resolve();
    });
    // Record only while the video actually plays: the recording pauses whenever it stops to
    // load. Otherwise those stops are recorded as frozen frames and the copy comes out longer
    // than the original (a 28-second ad could then pass the 30-second limit).
    video.addEventListener('waiting', () => {
      if (recorder.state === 'recording') recorder.pause();
    });
    video.addEventListener('playing', () => {
      if (recorder.state === 'paused') recorder.resume();
    });
    await video.play();
    context.drawImage(video, 0, 0, width, height);
    recorder.start(1000);
    draw();
    await ended;
    drawing = false;
    recorder.stop();
    await stopped;
    onProgress?.(1);

    const blob = new Blob(chunks, { type: mimeType.split(';')[0] });
    if (blob.size === 0 || blob.size >= file.size) return file;
    const extension = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
    const name = file.name.replace(/\.[^.]+$/, '') + `-small.${extension}`;
    return new File([blob], name, { type: blob.type });
  } catch {
    return file;
  } finally {
    video.pause();
    URL.revokeObjectURL(url);
    audioContext?.close().catch(() => undefined);
  }
}
