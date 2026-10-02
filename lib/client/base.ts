'use client';
import { usePathname } from 'next/navigation';

/** Path prefix the site is served under ('' normally, '/Robotics' for the GitHub Pages build). */
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
/** True for the GitHub Pages build, where a service worker runs the API inside the browser. */
export const LOCAL = process.env.NEXT_PUBLIC_LOCAL_MODE === '1';

/** Set after "Sign out" in the GitHub Pages build, so the next visit shows the sign-in page instead of signing in again. */
export const SIGNED_OUT_KEY = 'hub-signed-out';
/** The GitHub Pages build's coach account (seeded into each browser's own copy of the Hub). */
export const LOCAL_COACH = { username: 'coach', password: 'cougars-hub' };

/** Prefix a root-relative URL with the base path (Next's <Link> and router do this themselves). */
export const withBase = (url: string) => (url.startsWith('/') && !url.startsWith('//') ? `${BASE}${url}` : url);

/**
 * A segment of the current URL, e.g. useSegment(1) on /builds/abc → "abc". The GitHub Pages export serves every id
 * from one placeholder page, so dynamic pages read their id from the address bar instead of route params.
 */
export function useSegment(index: number) {
  return usePathname().split('/').filter(Boolean)[index] ?? '';
}
