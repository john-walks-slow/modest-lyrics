/**
 * Sanitizes a string by removing special characters and replacing spaces with underscores.
 * @param {string} name The string to sanitize.
 * @returns {string} The sanitized string.
 */
export function sanitizeName(name: string): string {
  // 1. Remove special characters, allowing only letters, numbers, and spaces.
  const withoutSpecialChars = name.replace(/[^a-zA-Z0-9 ]/g, '');
  // 2. Replace one or more spaces with a single underscore.
  const withUnderscores = withoutSpecialChars.replace(/\s+/g, '_');
  return withUnderscores;
}