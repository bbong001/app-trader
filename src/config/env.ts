// Centralized environment config module
// This wraps access to process.env / import.meta.env so other code
// can import from '@config.env' instead of using env APIs directly.
// It also ensures that server-side env vars are loaded from `config.env`.

import dotenv from 'dotenv';

// Load env from config.env on the server (Node) side only
if (typeof process !== 'undefined') {
  dotenv.config({ path: 'config.env' });
}

// For server-side (Node)
export const NODE_ENV =
  typeof process !== 'undefined' && process.env && process.env.NODE_ENV
    ? process.env.NODE_ENV
    : 'development';

export const DATABASE_URL =
  (typeof process !== 'undefined' &&
    process.env &&
    process.env.DATABASE_URL) ||
  (typeof import.meta !== 'undefined' &&
    (import.meta as any).env &&
    (import.meta as any).env.DATABASE_URL) ||
  '';

export const PUBLIC_SOCKET_URL =
  (typeof import.meta !== 'undefined' &&
    (import.meta as any).env &&
    (import.meta as any).env.PUBLIC_SOCKET_URL) ||
  (typeof process !== 'undefined' &&
    process.env &&
    process.env.PUBLIC_SOCKET_URL) ||
  '';

export const SOCKET_SERVER_URL =
  (typeof process !== 'undefined' &&
    process.env &&
    process.env.SOCKET_SERVER_URL) ||
  '';

