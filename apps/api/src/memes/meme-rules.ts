export function isGifSignature(bytes: Uint8Array) {
  const signature = Buffer.from(bytes.subarray(0, 6)).toString('ascii');
  return signature === 'GIF87a' || signature === 'GIF89a';
}
