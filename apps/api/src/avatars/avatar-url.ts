import { AVATAR_PRESETS } from './avatar-presets';

export function resolveAvatarUrl(reference: string | null | undefined) {
  if (!reference) return null;
  const base = (process.env.MEDIA_PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3001}/api/v1`).replace(/\/$/, '');
  if (reference.startsWith('upload:') && /^[0-9a-f-]{36}$/.test(reference.slice(7))) {
    return `${base}/avatars/${reference.slice(7)}`;
  }
  if (reference.startsWith('preset:') && AVATAR_PRESETS.includes(reference.slice(7) as any)) {
    return `${base}/avatars/presets/${reference.slice(7)}`;
  }
  return null;
}
