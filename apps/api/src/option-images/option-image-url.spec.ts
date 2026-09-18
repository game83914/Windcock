import { resolveOptionImageUrl } from './option-image-url';

describe('resolveOptionImageUrl', () => {
  const originalBase = process.env.MEDIA_PUBLIC_BASE_URL;
  const originalPort = process.env.PORT;

  afterEach(() => {
    process.env.MEDIA_PUBLIC_BASE_URL = originalBase;
    process.env.PORT = originalPort;
  });

  it('returns null for empty references', () => {
    expect(resolveOptionImageUrl(null)).toBeNull();
    expect(resolveOptionImageUrl(undefined)).toBeNull();
    expect(resolveOptionImageUrl('')).toBeNull();
  });

  it('keeps absolute URLs untouched', () => {
    expect(resolveOptionImageUrl('https://cdn.example.com/x.webp')).toBe('https://cdn.example.com/x.webp');
  });

  it('resolves stored relative paths against MEDIA_PUBLIC_BASE_URL', () => {
    process.env.MEDIA_PUBLIC_BASE_URL = 'https://api.example.com/api/v1/';
    expect(resolveOptionImageUrl('/api/v1/option-images/abc')).toBe('https://api.example.com/api/v1/option-images/abc');
  });

  it('falls back to localhost when no base is configured', () => {
    delete process.env.MEDIA_PUBLIC_BASE_URL;
    process.env.PORT = '3001';
    expect(resolveOptionImageUrl('/api/v1/option-images/abc')).toBe('http://localhost:3001/api/v1/option-images/abc');
  });
});
