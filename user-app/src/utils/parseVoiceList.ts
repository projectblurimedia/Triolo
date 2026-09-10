/**
 * Turns free-form recognized speech like "senagapappu kg minapappu 3/2kg" into a
 * structured list of {name, quantity, unit} entries — one entry per detected
 * "<item name> <quantity>? <unit>" run. Deliberately does NOT try to mathematically
 * interpret quantities (e.g. a spoken "3 1/2" recognized as "3/2" is kept as the literal
 * string "3/2", never recalculated to 1.5 or reformatted to "3 1/2") — speech-to-text
 * output for mixed Telugu/English grocery terms is noisy enough that preserving exactly
 * what was heard is more trustworthy than silently reinterpreting it. Quantity defaults
 * to "1" when a unit is spoken with no number before it (e.g. "rice kg" → quantity "1").
 *
 * Algorithm: normalize (lowercase, spell out a few small number/fraction words, drop
 * filler connector words), then walk tokens left to right accumulating "name" words until
 * a token that IS (or ends with) a known unit is hit — everything since the last unit
 * becomes that item's name, and any trailing purely-numeric tokens immediately before the
 * unit become its quantity. This correctly handles both "3kg" (glued into one recognized
 * token) and "3 kg" (two separate tokens) without needing to know which one a given speech
 * recognizer will produce.
 */

const UNIT_ALIASES: Record<string, string> = {
  kg: 'KG',
  kgs: 'KG',
  kilo: 'KG',
  kilos: 'KG',
  kilogram: 'KG',
  kilograms: 'KG',
  g: 'G',
  gm: 'G',
  gms: 'G',
  gram: 'G',
  grams: 'G',
  l: 'L',
  ltr: 'L',
  ltrs: 'L',
  liter: 'L',
  liters: 'L',
  litre: 'L',
  litres: 'L',
  ml: 'ML',
  dozen: 'DOZEN',
  dz: 'DOZEN',
  packet: 'PACKET',
  packets: 'PACKET',
  pkt: 'PACKET',
  pkts: 'PACKET',
  piece: 'PIECE',
  pieces: 'PIECE',
  pcs: 'PIECE',
  pc: 'PIECE',
  box: 'BOX',
  boxes: 'BOX',
  bag: 'BAG',
  bags: 'BAG',
  bunch: 'BUNCH',
  bunches: 'BUNCH',
};

const NUMBER_WORDS: Record<string, string> = {
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  ten: '10',
  half: '1/2',
  quarter: '1/4',
};

const CONNECTOR_WORDS = new Set(['and', 'also', 'then', 'plus', 'a', 'an']);

const NUMBER_PREFIX = /^\d+(?:[./]\d+)*$/;

const UNIT_PATTERN = Object.keys(UNIT_ALIASES)
  .sort((a, b) => b.length - a.length)
  .join('|');
// A whole token that's a unit word, optionally glued directly to a leading number/fraction
// (e.g. "kg", "3kg", "3.5kg", "3/2kg").
const COMBINED_TOKEN = new RegExp(`^(\\d+(?:[./]\\d+)*)?(${UNIT_PATTERN})$`, 'i');

export interface ParsedListItem {
  name: string;
  quantity: string;
  unit: string;
}

function titleCase(text: string): string {
  return text
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/** Pops up to two trailing purely-numeric tokens off the end (e.g. ["rice", "3", "1/2"] → quantity "3 1/2", rest ["rice"]). */
function pullTrailingQuantity(tokens: string[]): { quantity: string | null; rest: string[] } {
  const rest = [...tokens];
  const pulled: string[] = [];
  while (rest.length && pulled.length < 2 && NUMBER_PREFIX.test(rest[rest.length - 1])) {
    pulled.unshift(rest.pop() as string);
  }
  return { quantity: pulled.length ? pulled.join(' ') : null, rest };
}

export function parseVoiceListText(rawText: string): ParsedListItem[] {
  const normalized = rawText
    .toLowerCase()
    .replace(/[,.]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => NUMBER_WORDS[word] ?? word)
    .filter((word) => !CONNECTOR_WORDS.has(word));

  const items: ParsedListItem[] = [];
  let nameTokens: string[] = [];

  for (const token of normalized) {
    const match = token.match(COMBINED_TOKEN);
    if (!match) {
      nameTokens.push(token);
      continue;
    }
    const unit = UNIT_ALIASES[match[2].toLowerCase()];
    let quantity: string | null = match[1] ?? null;
    let rest = nameTokens;
    if (!quantity) {
      const pulled = pullTrailingQuantity(nameTokens);
      quantity = pulled.quantity;
      rest = pulled.rest;
    }
    const name = titleCase(rest.join(' '));
    if (name) {
      items.push({ name, quantity: quantity ?? '1', unit });
    }
    nameTokens = [];
  }

  // Trailing words with no unit ever spoken (e.g. "...and onions") still become an item,
  // just with a blank unit — better than silently dropping the last thing someone said.
  if (nameTokens.length) {
    const { quantity, rest } = pullTrailingQuantity(nameTokens);
    const name = titleCase(rest.join(' '));
    if (name) {
      items.push({ name, quantity: quantity ?? '1', unit: '' });
    }
  }

  return items;
}
