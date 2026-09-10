/**
 * Turns free-form recognized speech — Telugu, English, or (the common real case) both
 * mixed in the same sentence, e.g. "kandipappu kg nnara" (kandipappu, one and a half kg) or
 * "senagapappu kg minapappu 3/2kg" — into a structured list of {name, quantity, unit}
 * entries, one per detected item run.
 *
 * Two things make Telugu grocery speech harder than plain English numbers-and-units text:
 *
 * 1. Quantity words aren't always digits. A speaker says "kandipappu kg nnara" — the
 *    quantity word ("nnara", short for "ఒకటిన్నర"/okatinnara, "one and a half") comes
 *    *after* the unit, not before it, and isn't a digit at all. `TELUGU_NUMBER_WORDS`
 *    below maps common Telugu quantity words — in both Telugu script (what a `te-IN`
 *    recognizer actually returns) and their common Latin-transliterated/misheard-by-STT
 *    forms (what shows up in practice more often than you'd hope) — to a plain digit/
 *    fraction string, and the main loop looks for a quantity word both *before and after*
 *    the unit token, not just before it as a simpler English-only parser would.
 * 2. Units get spoken in Telugu too ("కిలో"/kilo, "గ్రాము"/gram, ...) — `TELUGU_UNIT_ALIASES`
 *    covers the common ones, merged into the same unit table English units use so both
 *    work interchangeably in one sentence.
 * 3. The unit and its quantity word often come out as one glued token, not two separate
 *    words with a pause between them — "1.5kg" in natural spoken Telugu *is* "kgnnara"
 *    ("kg" + "nnara"), not "kg nnara". `splitGluedUnitQuantityWord()` below handles that by
 *    checking whether a token is a known unit word with a known quantity word stuck
 *    directly onto either end of it.
 *
 * Still deliberately does NOT try to be clever about *digit* fractions already present in
 * the transcript — a recognized "3/2" is kept as the literal string "3/2", never
 * recalculated to 1.5 — only recognized *words* (Telugu or English) get resolved to a
 * canonical digit/fraction form, since a digit the recognizer already produced is more
 * trustworthy than any reinterpretation of it.
 */

const UNIT_ALIASES: Record<string, string> = {
  // English
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
  // Telugu script
  కిలో: 'KG',
  కేజీ: 'KG',
  కిలోలు: 'KG',
  గ్రాము: 'G',
  గ్రాములు: 'G',
  లీటరు: 'L',
  లీటర్లు: 'L',
  డజను: 'DOZEN',
  ప్యాకెట్: 'PACKET',
  ప్యాకెట్లు: 'PACKET',
  పీస్: 'PIECE',
  పీసులు: 'PIECE',
  బాక్స్: 'BOX',
  బ్యాగ్: 'BAG',
  కట్ట: 'BUNCH',
};

/**
 * Telugu quantity words → a plain digit/fraction string, covering both the script a
 * `te-IN` recognizer normally returns and the common Latin transliterations a mixed or
 * `en-IN` recognizer tends to produce for the same spoken word (STT is inconsistent about
 * which one it gives, so both are covered). Whole numbers 1–10, plus the "N and a half"
 * compounds (the everyday way to say a half-kg quantity out loud) for 1–5, since grocery
 * quantities rarely go higher than that.
 */
const TELUGU_NUMBER_WORDS: Record<string, string> = {
  ఒకటి: '1',
  రెండు: '2',
  మూడు: '3',
  నాలుగు: '4',
  అయిదు: '5',
  ఐదు: '5',
  ఆరు: '6',
  ఏడు: '7',
  ఎనిమిది: '8',
  తొమ్మిది: '9',
  పది: '10',
  అర: '1/2',
  పావు: '1/4',
  ముప్పావు: '3/4',
  ఒకటిన్నర: '1 1/2',
  రెండున్నర: '2 1/2',
  మూడున్నర: '3 1/2',
  నాలుగున్నర: '4 1/2',
  అయిదున్నర: '5 1/2',
  ఐదున్నర: '5 1/2',
  // Common Latin-script renderings of the same words above.
  okati: '1',
  rendu: '2',
  moodu: '3',
  mudu: '3',
  naalugu: '4',
  nalugu: '4',
  aidu: '5',
  aaru: '6',
  aru: '6',
  edu: '7',
  enimidi: '8',
  tommidi: '9',
  padi: '10',
  ara: '1/2',
  pavu: '1/4',
  paavu: '1/4',
  muppavu: '3/4',
  muppaavu: '3/4',
  okatinnara: '1 1/2',
  ontinnara: '1 1/2',
  onnara: '1 1/2',
  nnara: '1 1/2',
  rendunnara: '2 1/2',
  moodunnara: '3 1/2',
  mudunnara: '3 1/2',
  naalugunnara: '4 1/2',
  nalugunnara: '4 1/2',
  aidunnara: '5 1/2',
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
  ...TELUGU_NUMBER_WORDS,
};

const CONNECTOR_WORDS = new Set(['and', 'also', 'then', 'plus', 'a', 'an']);

// A token that's already a plain quantity — either a simple number/fraction ("1", "1/2",
// "3.5", "31/2") or a resolved "N N/N" mixed-fraction compound ("1 1/2") produced by the
// NUMBER_WORDS lookup above (e.g. from "nnara").
const NUMBER_PREFIX = /^\d+(?:[./]\d+)*(?:\s+\d+\/\d+)?$/;

const UNIT_PATTERN = Object.keys(UNIT_ALIASES)
  .sort((a, b) => b.length - a.length)
  .join('|');
// A whole token that's a unit word, optionally glued directly to a leading number/fraction
// (e.g. "kg", "3kg", "3.5kg", "3/2kg").
const COMBINED_TOKEN = new RegExp(`^(\\d+(?:[./]\\d+)*)?(${UNIT_PATTERN})$`, 'iu');

const UNIT_KEYS_BY_LENGTH = Object.keys(UNIT_ALIASES).sort((a, b) => b.length - a.length);

/**
 * A unit word glued directly to a *quantity word* (not a digit — that's COMBINED_TOKEN's
 * job) on either side, with no space — e.g. "kgnnara" ("kg" + "nnara", 1.5kg spoken fast as
 * one continuous word, which is the normal way this comes out in Telugu: "1.5kg" IS
 * "kgnnara", not two separate words with a pause between them). Tries every known unit key
 * as both a prefix and a suffix of the token and checks whether what's left over is a whole,
 * exact quantity word — not a fuzzy/partial match, so this can't accidentally misfire on an
 * unrelated item name that merely happens to start or end with a unit-like substring.
 */
function splitGluedUnitQuantityWord(token: string): { unit: string; quantity: string } | null {
  for (const unitKey of UNIT_KEYS_BY_LENGTH) {
    if (token.length <= unitKey.length) continue;
    if (token.startsWith(unitKey)) {
      const suffix = token.slice(unitKey.length);
      if (NUMBER_WORDS[suffix]) {
        return { unit: UNIT_ALIASES[unitKey], quantity: NUMBER_WORDS[suffix] };
      }
    }
    if (token.endsWith(unitKey)) {
      const prefix = token.slice(0, token.length - unitKey.length);
      if (NUMBER_WORDS[prefix]) {
        return { unit: UNIT_ALIASES[unitKey], quantity: NUMBER_WORDS[prefix] };
      }
    }
  }
  return null;
}

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

/** Pops up to two trailing quantity-shaped tokens off the end (e.g. ["rice", "3", "1/2"] → quantity "3 1/2", rest ["rice"]). */
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
  let i = 0;

  while (i < normalized.length) {
    const token = normalized[i];
    const match = token.match(COMBINED_TOKEN);
    if (!match) {
      const glued = splitGluedUnitQuantityWord(token);
      if (glued) {
        const name = titleCase(nameTokens.join(' '));
        if (name) {
          items.push({ name, quantity: glued.quantity, unit: glued.unit });
        }
        nameTokens = [];
        i++;
        continue;
      }
      nameTokens.push(token);
      i++;
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
    // Quantity word spoken *after* the unit instead of before it — e.g. "kandipappu kg
    // nnara" ("kandipappu, one-and-a-half kg"), a natural Telugu word order. Only consumed
    // when no quantity was already found before the unit, so "rice 2 kg onions" doesn't
    // accidentally swallow "onions" as if it were a number.
    if (!quantity && i + 1 < normalized.length && NUMBER_PREFIX.test(normalized[i + 1])) {
      quantity = normalized[i + 1];
      i++;
    }

    const name = titleCase(rest.join(' '));
    if (name) {
      items.push({ name, quantity: quantity ?? '1', unit });
    }
    nameTokens = [];
    i++;
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
