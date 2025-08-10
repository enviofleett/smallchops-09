
export function generateSecureToken(length = 32): string {
  // Returns a hex string of the requested length
  // Uses Web Crypto for cryptographically secure randomness
  const byteLength = Math.ceil(length / 2);
  const bytes = new Uint8Array(byteLength);
  // In browsers, window.crypto is available
  crypto.getRandomValues(bytes);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex.slice(0, length);
}
