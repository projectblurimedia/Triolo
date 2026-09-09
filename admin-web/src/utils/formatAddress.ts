interface AddressParts {
  area?: string | null;
  city: string;
  district: string;
  state: string;
  pincode: string;
}

/** Joins the structured Worker/Business address fields into one display line — "Area, City, District, State - Pincode", omitting Area when absent. */
export function formatAddress(parts: AddressParts): string {
  const line = [parts.area, parts.city, parts.district, parts.state].filter(Boolean).join(', ');
  return parts.pincode ? `${line} - ${parts.pincode}` : line;
}
