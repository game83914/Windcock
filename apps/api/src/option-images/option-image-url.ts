/**
 * Resolve a stored option-image reference to a public URL.
 * Storage keeps the relative `/api/v1/option-images/<key>` form; responses
 * must be absolute so frontends on a different origin can display them.
 */
export function resolveOptionImageUrl(reference: string | null | undefined): string | null {
  if (!reference) return null;
  if (/^https?:\/\//i.test(reference)) return reference;
  const base = (process.env.MEDIA_PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3001}/api/v1`).replace(/\/$/, '');
  if (reference.startsWith('/api/v1/option-images/')) {
    return `${base}${reference.slice('/api/v1'.length)}`;
  }
  return reference;
}
