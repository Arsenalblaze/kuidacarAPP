import { supabase } from './api';
import { DEEP_LINK_SCHEME, PASSWORD_RECOVERY_SESSION_KEY } from './authRedirects';

export interface AuthDeepLinkResult {
  path: '/login' | '/reset-password';
  type: 'confirmation' | 'recovery';
  confirmed?: boolean;
  error?: string;
}

const processedUrls = new Map<string, Promise<AuthDeepLinkResult | null>>();

function getCallbackKey(rawUrl: string): string {
  const url = new URL(rawUrl);
  const params = new URLSearchParams([...url.searchParams, ...new URLSearchParams(url.hash.replace(/^#/, ''))]);
  const code = params.get('code');
  if (code) return `pkce:${code}`;

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) return `tokens:${accessToken}:${refreshToken}`;

  return rawUrl;
}

function getCallbackPath(url: URL): AuthDeepLinkResult['path'] | null {
  const isCustomScheme = url.protocol === `${DEEP_LINK_SCHEME}:`;
  if (!isCustomScheme && (typeof window === 'undefined' || url.origin !== window.location.origin)) {
    return null;
  }

  const path = isCustomScheme
    ? `/${[url.hostname, url.pathname].filter(Boolean).join('/')}`.replace(/\/+/g, '/')
    : url.pathname;
  if (path === '/login') return path;
  if (path === '/reset-password') return path;
  return null;
}

export function processAuthDeepLink(rawUrl: string): Promise<AuthDeepLinkResult | null> {
  const callbackKey = getCallbackKey(rawUrl);
  const existing = processedUrls.get(callbackKey);
  if (existing) return existing;

  const processing = processAuthDeepLinkOnce(rawUrl);
  processedUrls.set(callbackKey, processing);
  return processing;
}

async function processAuthDeepLinkOnce(rawUrl: string): Promise<AuthDeepLinkResult | null> {
  const url = new URL(rawUrl);
  const path = getCallbackPath(url);
  if (!path) return null;

  const isCustomScheme = url.protocol === `${DEEP_LINK_SCHEME}:`;
  const query = new URLSearchParams(url.search);
  const fragment = new URLSearchParams(url.hash.replace(/^#/, ''));
  const params = new URLSearchParams([...query, ...fragment]);
  const hasAuthCallback = ['code', 'error', 'error_code', 'access_token', 'refresh_token']
    .some((key) => params.has(key));

  if (!isCustomScheme && !hasAuthCallback) return null;

  const type = path === '/reset-password' ? 'recovery' : 'confirmation';
  const authError = params.get('error_description') || params.get('error');
  if (authError) {
    if (type === 'recovery') sessionStorage.removeItem(PASSWORD_RECOVERY_SESSION_KEY);
    return { path, type, error: authError };
  }

  const code = params.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      if (type === 'recovery') sessionStorage.removeItem(PASSWORD_RECOVERY_SESSION_KEY);
      return { path, type, error: error.message };
    }

    if (type === 'recovery') {
      sessionStorage.setItem(PASSWORD_RECOVERY_SESSION_KEY, 'true');
    }
    return { path, type, confirmed: type === 'confirmation' };
  }

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) {
    if (type === 'recovery' && params.get('type') !== 'recovery') {
      sessionStorage.removeItem(PASSWORD_RECOVERY_SESSION_KEY);
      return { path, type, error: 'Este link não é válido para recuperação de senha.' };
    }

    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) {
      if (type === 'recovery') sessionStorage.removeItem(PASSWORD_RECOVERY_SESSION_KEY);
      return { path, type, error: error.message };
    }

    if (type === 'recovery') {
      sessionStorage.setItem(PASSWORD_RECOVERY_SESSION_KEY, 'true');
    }
    return { path, type, confirmed: type === 'confirmation' };
  }

  return { path, type };
}
