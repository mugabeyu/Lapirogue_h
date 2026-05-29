export const INTERNATIONAL_PHONE_DISPLAY_PATTERN = /^\(\+230\)(?: \d{4}){2}$/;

function keepDigits(value: string) {
  return value.replace(/\D/g, '');
}

export function formatInternationalPhoneDisplay(value: string) {
  const digits = keepDigits(value);
  if (!digits) return '';

  const localDigits = digits.startsWith('230') && digits.length > 8 ? digits.slice(3) : digits.slice(-8);
  const normalized = localDigits.slice(0, 8).padEnd(8, '');
  const firstChunk = normalized.slice(0, 4);
  const secondChunk = normalized.slice(4, 8);

  return secondChunk ? `(+230) ${firstChunk} ${secondChunk}` : `(+230) ${firstChunk}`;
}

export function normalizeInternationalPhoneValue(value: string) {
  return formatInternationalPhoneDisplay(value);
}

export function isInternationalPhoneDisplayValid(value: string) {
  const digits = keepDigits(value);
  return INTERNATIONAL_PHONE_DISPLAY_PATTERN.test(value.trim()) && digits.length === 8;
}
