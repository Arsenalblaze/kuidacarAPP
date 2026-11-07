import { Capacitor } from '@capacitor/core';

export const DEEP_LINK_SCHEME = 'kuidacarassistenterodoviario';
export const PASSWORD_RECOVERY_SESSION_KEY = 'kuidacar:password-recovery';

export function getPasswordRecoveryRedirect(): string {
  return Capacitor.isNativePlatform()
    ? `${DEEP_LINK_SCHEME}://reset-password`
    : `${window.location.origin}/reset-password`;
}

export function getEmailConfirmationRedirect(): string | undefined {
  if (Capacitor.isNativePlatform()) {
    return `${DEEP_LINK_SCHEME}://login?verified=true`;
  }

  if (typeof window === 'undefined') return undefined;
  return `${window.location.origin}/login?verified=true`;
}
