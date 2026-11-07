export const PLATFORM_COMMISSION_PERCENTAGE = 15;
export const PLATFORM_COMMISSION_RATE = PLATFORM_COMMISSION_PERCENTAGE / 100;
export const LEGACY_PLATFORM_COMMISSION_RATE = 0.1;
export const PLATFORM_COMMISSION_EFFECTIVE_AT = '2026-10-31T17:52:42.450+01:00';

export function calculatePlatformCommission(amount: number, serviceDate?: string | null): number {
  const normalizedAmount = Math.max(0, Number(amount) || 0);
  const timestamp = Date.parse(serviceDate || '');
  const effectiveTimestamp = Date.parse(PLATFORM_COMMISSION_EFFECTIVE_AT);
  const rate = Number.isFinite(timestamp) && timestamp < effectiveTimestamp
    ? LEGACY_PLATFORM_COMMISSION_RATE
    : PLATFORM_COMMISSION_RATE;
  return normalizedAmount * rate;
}
