import {
  getCountryCallingCode,
  CountryCode,
} from "libphonenumber-js";

/**
 * Returns the real official international
 * country calling code.
 */
export function getCallingCode(countryCode?: string): string | null {
  if (!countryCode) return null;

  try {
    const callingCode = getCountryCallingCode(
      countryCode.toUpperCase() as CountryCode
    );

    return `+${callingCode}`;
  } catch {
    return null;
  }
}

/**
 * Returns emoji flag from country code.
 * Example:
 * BD → 🇧🇩
 * US → 🇺🇸
 */
export function getFlagEmoji(countryCode: string) {
  return countryCode
    .toUpperCase()
    .replace(/./g, (char) =>
      String.fromCodePoint(127397 + char.charCodeAt(0))
    );
}
