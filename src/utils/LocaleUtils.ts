export function normalizeLocaleCode(locale: string): string {
  const localeParts = locale.split(/_|-/);
  if (localeParts.length !== 2) {
    console.error("Illegal Locale Code");
    return "en_US";
  }
  localeParts[0] = localeParts[0].toLowerCase();
  localeParts[1] = localeParts[1].toUpperCase();
  return localeParts.join('_');
}

export function getLocationCodeFromLocaleCode(locale: string): string {
  const normalized = normalizeLocaleCode(locale);
  const parts = normalized.split('_');
  return parts[1];
}

export function getLanguageCodeFromLocaleCode(locale: string): string {
  const normalized = normalizeLocaleCode(locale);
  const parts = normalized.split('_');
  return parts[0];
}