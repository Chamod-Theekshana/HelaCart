import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  type Auth,
  type User,
} from "firebase/auth";

const settings = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const hasFirebase = Object.values(settings).every(Boolean);
let auth: Auth | null = null;
export function clientAuth(): Auth | null {
  if (typeof window === "undefined" || !hasFirebase) return null;
  auth ??= getAuth(getApps().length ? getApp() : initializeApp(settings));
  return auth;
}
export function subscribeToAuth(listener: (user: User | null) => void) {
  const current = clientAuth();
  return current ? onAuthStateChanged(current, listener) : () => {};
}
export async function signOutClient() {
  const current = clientAuth();
  if (current) await signOut(current);
}
