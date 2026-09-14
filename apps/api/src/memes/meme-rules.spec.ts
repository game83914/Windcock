import { isGifSignature } from './meme-rules';

describe('meme rules', () => {
  it.each(['GIF87a', 'GIF89a'])('accepts the %s signature', (signature) => {
    expect(isGifSignature(Buffer.from(signature))).toBe(true);
  });

  it.each(['PNG89a', 'GIF90a', 'GIF'])('rejects the %s signature', (signature) => {
    expect(isGifSignature(Buffer.from(signature))).toBe(false);
  });
});
