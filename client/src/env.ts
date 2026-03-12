/**
 * Single source for frontend env. When env vars are not set, defaults to production.
 */
const DEFAULT_API_URL = "https://brainbox-api.zenclass.in";

export const env = {
  /** API base URL (no trailing slash). Defaults to production when not set. */
  VITE_API_URL:
    import.meta.env.VITE_API_URL?.trim() || DEFAULT_API_URL,
} as const;

/** API base URL for requests and socket. Use this instead of reading import.meta.env directly. */
export const apiBaseUrl = env.VITE_API_URL;
