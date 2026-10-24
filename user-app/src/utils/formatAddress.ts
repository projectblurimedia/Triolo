interface AddressParts {
  locationName?: string | null;
  city?: string | null;
}

// A Google Plus Code ("7JCM+2X", "7JCM+2X Kannapuram") — never shown to anyone.
const PLUS_CODE = /\b[23456789CFGHJMPQRVWX]{2,8}\+[23456789CFGHJMPQRVWX]{0,3}\b/gi;

/**
 * Only the place name (village / town) from a stored address text: Plus Codes, pincodes and
 * bare numbers are dropped, and of "Kannapuram, Eluru, Andhra Pradesh" just the first part is
 * kept. Older posts stored the whole geocoder line, so every place shown goes through this.
 */
export function placeName(text: string | null | undefined): string {
  const parts = (text ?? '')
    .replace(PLUS_CODE, '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part && !/^[0-9\s-]+$/.test(part));
  return parts[0] ?? '';
}

/**
 * What people see of a worker's or shop's location: only the place name (village / town).
 * The full address (area, district, state, pincode) is stored but never shown.
 */
export function formatAddress(parts: AddressParts): string {
  return placeName(parts.locationName) || placeName(parts.city);
}
