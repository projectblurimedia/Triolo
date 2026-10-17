interface AddressParts {
  locationName?: string | null;
  city?: string | null;
}

/**
 * What people see of a worker's or shop's location: only the place name (village / town).
 * The full address (area, district, state, pincode) is stored but never shown.
 */
export function formatAddress(parts: AddressParts): string {
  return parts.locationName || parts.city || '';
}
