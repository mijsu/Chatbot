/**
 * Capacitor API Routing — Web-only stub
 * 
 * In the web version, all API calls go to the same-origin Next.js server.
 * No fetch patching needed.
 */

import { isCapacitorNative } from './capacitor-notifications';

export function setCapacitorServerUrl(_url: string | null): void {
  // No-op in web
}

export function getCapacitorServerUrl(): string | null {
  return null;
}

export function resolveApiUrl(path: string): string {
  return path;
}

export function patchFetchForCapacitor(): void {
  // No-op in web
}

export function initializeCapacitorApi(): void {
  // No-op in web
}

export function checkCapacitorApiStatus(): { configured: boolean; serverUrl: string | null; message: string } {
  return { configured: true, serverUrl: null, message: 'Web mode — API routes available' };
}
