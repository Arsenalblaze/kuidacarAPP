import { Capacitor } from '@capacitor/core';
import OneSignal from '@onesignal/capacitor-plugin';

let initialization: Promise<void> | null = null;
let identitySynchronization: Promise<void> = Promise.resolve();
let currentExternalId: string | null | undefined;

export function isAndroidNativeApp(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export function isOneSignalConfigured(): boolean {
  return Boolean(import.meta.env.VITE_ONESIGNAL_APP_ID?.trim());
}

export async function initializeOneSignal(): Promise<void> {
  if (!isAndroidNativeApp()) return;

  const appId = import.meta.env.VITE_ONESIGNAL_APP_ID?.trim();
  if (!appId) {
    throw new Error('Configure VITE_ONESIGNAL_APP_ID para ativar push Android via OneSignal.');
  }

  if (!initialization) {
    initialization = OneSignal.initialize(appId).catch((error) => {
      initialization = null;
      throw error;
    });
  }
  await initialization;
}

export function syncOneSignalIdentity(externalId: string | null): Promise<void> {
  if (!isAndroidNativeApp()) return Promise.resolve();

  const synchronization = identitySynchronization.then(async () => {
    await initializeOneSignal();
    if (currentExternalId === externalId) return;

    if (externalId) {
      await OneSignal.login(externalId);
    } else {
      await OneSignal.logout();
    }
    currentExternalId = externalId;
  });
  identitySynchronization = synchronization.catch(() => undefined);
  return synchronization;
}

export async function logoutOneSignalIdentity(): Promise<void> {
  if (!isAndroidNativeApp() || !isOneSignalConfigured()) return;
  await syncOneSignalIdentity(null);
}

export { OneSignal };
