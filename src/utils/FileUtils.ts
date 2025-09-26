import slugify from "slugify";

/**
 * Sanitizes a string by removing special characters and replacing spaces with underscores.
 * @param {string} name The string to sanitize.
 * @returns {string} The sanitized string.
 */
export function sanitizeName(name: string): string {
  return slugify(name, { remove: /"<>#%\{\}\|\\\^~\[\]`;\?:@=&/g });
}