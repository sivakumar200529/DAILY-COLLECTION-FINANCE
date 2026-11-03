// Turns messy spreadsheets and spoken sentences into customers and collectors, by rules (no outside
// service). Nothing here saves anything: the office checks every row before it is added.

export type PersonKind = 'customer' | 'collector';
export type PersonField = 'name' | 'mobile' | 'alternate' | 'shop' | 'area' | 'address' | 'landmark' | 'relative' | 'email';
export type PersonValues = Partial<Record<PersonField, string>>;
export type Cell = string | number | boolean | Date | null | undefined;

export const PERSON_FIELDS: Record<PersonKind, PersonField[]> = {
  customer: ['name', 'mobile', 'shop', 'area', 'address', 'landmark', 'relative', 'alternate', 'email'],
  collector: ['name', 'mobile', 'area', 'address', 'email'],
};

/** Column titles, in English and Tamil, written without spaces or punctuation. */
const ALIASES: Record<PersonField, string[]> = {
  name: [
    'name', 'names', 'fullname', 'customer', 'customername', 'custname', 'cusname', 'partyname', 'party', 'borrower', 'borrowername', 'client',
    'clientname', 'membername', 'collector', 'collectorname', 'agent', 'agentname', 'staff', 'staffname', 'employee', 'employeename',
    'பெயர்', 'வாடிக்கையாளர்', 'வாடிக்கையாளர்பெயர்', 'வசூலிப்பாளர்', 'வசூலிப்பாளர்பெயர்', 'முழுபெயர்',
  ],
  mobile: [
    'mobile', 'mobileno', 'mobilenumber', 'mob', 'mobno', 'phone', 'phoneno', 'phonenumber', 'ph', 'phno', 'cell', 'cellno', 'cellnumber', 'contact',
    'contactno', 'contactnumber', 'whatsapp', 'whatsappno', 'whatsappnumber',
    'மொபைல்', 'மொபைல்எண்', 'மொபைல்நம்பர்', 'கைபேசி', 'கைபேசிஎண்', 'தொலைபேசி', 'தொலைபேசிஎண்', 'போன்', 'போன்நம்பர்', 'செல்',
  ],
  alternate: ['alternate', 'alternateno', 'alternatenumber', 'altno', 'altphone', 'altmobile', 'othernumber', 'otherphone', 'phone2', 'mobile2', 'மாற்றுஎண்'],
  shop: [
    'shop', 'shopname', 'store', 'storename', 'business', 'businessname', 'firm', 'firmname', 'company', 'companyname', 'tradename',
    'கடை', 'கடைபெயர்', 'கடையின்பெயர்', 'நிறுவனம்', 'தொழில்',
  ],
  area: [
    'area', 'areaname', 'location', 'place', 'line', 'linename', 'route', 'routename', 'zone', 'village', 'town', 'city', 'collectionarea', 'assignedarea',
    'பகுதி', 'ஏரியா', 'ஊர்', 'இடம்', 'லைன்',
  ],
  address: ['address', 'addr', 'shopaddress', 'homeaddress', 'residence', 'street', 'doorno', 'முகவரி', 'அட்ரஸ்', 'தெரு'],
  landmark: ['landmark', 'nearby', 'near', 'அடையாளம்', 'அருகில்'],
  relative: [
    'father', 'fathername', 'husband', 'husbandname', 'fatherhusband', 'fatherorhusband', 'fatherhusbandname', 'fatherorhusbandname', 'so', 'wo', 'do', 'guardian',
    'தந்தை', 'தந்தைபெயர்', 'கணவர்', 'கணவர்பெயர்', 'அப்பா',
  ],
  email: ['email', 'emailid', 'mail', 'mailid', 'மின்னஞ்சல்'],
};

/** Columns that are clearly about something else, such as "Customer ID" or "Loan amount". */
const IGNORED_COLUMN = /(id|code|sno|slno|serial|serialno|date|amount|amt|loan|balance|paid|due|interest|total|days?|status|remarks?|photo|தொகை|தேதி|கடன்|வரிசை)$/;
const TOTAL_ROW = /^(grand\s*|sub\s*)?total\b|^மொத்தம்/i;
const SHOP_WORDS = /\b(store|stores|shop|traders?|agenc(y|ies)|enterprises?|textiles?|medicals?|hardwares?|bakery|hotel|mart|supermarket|sweets|electricals?)\b|கடை|ஸ்டோர்/i;
const MOBILE_IN_TEXT = /(?:\+?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}(?!\d)/;

const HAS_LETTERS = /[a-z஀-௿]/i;

const normalise = (text: string) => text.toLowerCase().replace(/[^a-z0-9஀-௿]/g, '');

export function cellText(cell: Cell): string {
  if (cell === null || cell === undefined) return '';
  if (cell instanceof Date) return '';
  if (typeof cell === 'number') return Number.isInteger(cell) ? String(cell) : String(cell);
  return String(cell).replace(/\s+/g, ' ').trim();
}

/** The field a column title means, and whether the title matched exactly. */
function fieldForTitle(title: string, kind: PersonKind): { field: PersonField; exact: boolean } | null {
  const n = normalise(title);
  if (!n) return null;
  const allowed = PERSON_FIELDS[kind];
  for (const field of allowed) if (ALIASES[field].includes(n)) return { field, exact: true };
  if (IGNORED_COLUMN.test(n)) return null;
  let best: { field: PersonField; length: number } | null = null;
  for (const field of allowed) {
    for (const alias of ALIASES[field]) {
      if (alias.length >= 4 && n.includes(alias) && (!best || alias.length > best.length)) best = { field, length: alias.length };
    }
  }
  return best ? { field: best.field, exact: false } : null;
}

export interface DetectedTable {
  /** The row holding the column titles, or null when the sheet has none. */
  headerIndex: number | null;
  /** What each column holds; null = ignored. */
  columns: (PersonField | null)[];
  titles: string[];
}

function headerScore(row: Cell[], kind: PersonKind): number {
  const seen = new Set<PersonField>();
  let score = 0;
  for (const cell of row) {
    if (typeof cell !== 'string') continue;
    const match = fieldForTitle(cell, kind);
    if (match && !seen.has(match.field)) {
      seen.add(match.field);
      score += match.exact ? 2 : 1;
    }
  }
  return seen.size >= 2 ? score : 0;
}

/** Numbers found in a cell, as 10-digit mobiles: "+91 98765-43210 / 09876543211" gives two. */
export function parseMobiles(text: string): string[] {
  const found: string[] = [];
  for (const part of text.split(/[/,;&|]|\bor\b/i)) {
    let digits = part.replace(/\D/g, '');
    if (digits.length === 20) {
      found.push(digits.slice(0, 10), digits.slice(10));
      continue;
    }
    if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
    if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
    if (digits.length === 14 && digits.startsWith('0091')) digits = digits.slice(4);
    if (/^[6-9]\d{9}$/.test(digits)) found.push(digits);
  }
  return found;
}

/** Works out a column from what it holds, for sheets with no titles or columns with unknown titles. */
function inferColumns(rows: Cell[][], start: number, columns: (PersonField | null)[], kind: PersonKind, width: number, titled: boolean[]) {
  const allowed = PERSON_FIELDS[kind];
  const has = (f: PersonField) => columns.includes(f);
  const assign = (col: number, f: PersonField) => { if (allowed.includes(f) && !has(f)) columns[col] = f; };
  const sample = rows.slice(start, start + 300);
  const profiles = Array.from({ length: width }, (_, col) => {
    const values = sample.map(r => cellText(r[col])).filter(Boolean);
    const count = values.length || 1;
    const share = (test: (v: string) => boolean) => values.filter(test).length / count;
    return {
      col,
      values,
      mobile: share(v => parseMobiles(v).length > 0 && !HAS_LETTERS.test(v)),
      nameWithMobile: share(v => MOBILE_IN_TEXT.test(v) && HAS_LETTERS.test(v)),
      email: share(v => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)),
      numeric: share(v => /^[\d.,₹\s-]+$/.test(v)),
      word: share(v => !/\d/.test(v) && v.split(' ').length <= 5),
      shop: share(v => SHOP_WORDS.test(v)),
      address: share(v => (/\d/.test(v) && /[^\d\s.,-]/.test(v)) || v.includes(',') || v.split(' ').length > 5),
      repeated: 1 - new Set(values.map(v => v.toLowerCase())).size / count,
    };
  });
  const open = () => profiles.filter(p => columns[p.col] === null && !titled[p.col] && p.values.length > 0);

  for (const p of open()) {
    if (p.mobile >= 0.6) has('mobile') ? assign(p.col, 'alternate') : assign(p.col, 'mobile');
    else if (p.email >= 0.6) assign(p.col, 'email');
  }
  for (const p of open()) if (p.nameWithMobile >= 0.6) assign(p.col, 'name');
  for (const p of open()) if (p.shop >= 0.3) assign(p.col, 'shop');
  for (const p of open()) if (p.numeric < 0.5 && p.address >= 0.5) assign(p.col, 'address');
  for (const p of open()) if (p.numeric < 0.5 && p.word >= 0.6 && p.repeated < 0.5) { assign(p.col, 'name'); if (has('name')) break; }
  for (const p of open()) if (p.numeric < 0.5 && p.word >= 0.6 && p.repeated >= 0.3) { assign(p.col, 'area'); if (has('area')) break; }
  // A list with few rows can leave the name unset; the first text column is the best guess.
  if (!has('name')) {
    const first = open().find(p => p.numeric < 0.5);
    if (first) assign(first.col, 'name');
  }
}

/** Finds the table in a sheet: skips title rows, finds the column titles, or infers them from the values. */
export function detectTable(rows: Cell[][], kind: PersonKind): DetectedTable {
  const width = rows.reduce((w, r) => Math.max(w, r.length), 0);
  let headerIndex: number | null = null;
  let bestScore = 0;
  rows.slice(0, 25).forEach((row, index) => {
    const score = headerScore(row, kind);
    if (score > bestScore) {
      bestScore = score;
      headerIndex = index;
    }
  });

  const columns: (PersonField | null)[] = Array(width).fill(null);
  const titled: boolean[] = Array(width).fill(false);
  const titles: string[] = Array(width).fill('');
  if (headerIndex !== null) {
    rows[headerIndex].forEach((cell, col) => {
      titles[col] = cellText(cell);
      if (titles[col]) titled[col] = true;
      const match = fieldForTitle(titles[col], kind);
      if (!match) return;
      if (!columns.includes(match.field)) columns[col] = match.field;
      else if (match.field === 'mobile' && kind === 'customer' && !columns.includes('alternate')) columns[col] = 'alternate';
    });
  }
  const start = headerIndex === null ? 0 : headerIndex + 1;
  inferColumns(rows, start, columns, kind, width, headerIndex === null ? titled : titled.map((t, col) => t && fieldForTitle(titles[col], kind) === null && IGNORED_COLUMN.test(normalise(titles[col]))));
  return { headerIndex, columns, titles };
}

export interface ImportRow {
  /** The row's number in the sheet, as Excel shows it. */
  sheetRow: number;
  values: PersonValues;
}

/** The people in a sheet: skips blanks, totals and repeated titles; a lone heading row names the area below it. */
export function extractRows(rows: Cell[][], table: DetectedTable, kind: PersonKind): ImportRow[] {
  const { columns, headerIndex } = table;
  const start = headerIndex === null ? 0 : headerIndex + 1;
  const mappedCount = columns.filter(Boolean).length;
  const hasArea = columns.includes('area');
  const result: ImportRow[] = [];
  let section = '';

  for (let index = start; index < rows.length; index++) {
    const row = rows[index];
    const filled = row.map(cellText).filter(Boolean);
    if (filled.length === 0) continue;
    if (TOTAL_ROW.test(filled[0])) continue;
    if (headerScore(row, kind) > 0) continue;

    if (filled.length === 1 && mappedCount >= 2 && !parseMobiles(filled[0]).length) {
      const next = rows.slice(index + 1).find(r => r.map(cellText).some(Boolean));
      if (next && next.map(cellText).filter(Boolean).length > 1) {
        section = filled[0];
        continue;
      }
    }

    const values: PersonValues = {};
    columns.forEach((field, col) => {
      if (!field) return;
      const text = cellText(row[col]);
      if (text) values[field] = values[field] ? `${values[field]} ${text}` : text;
    });

    if (values.mobile) {
      const numbers = parseMobiles(values.mobile);
      if (numbers[0]) values.mobile = numbers[0];
      if (numbers[1] && !values.alternate && kind === 'customer') values.alternate = numbers[1];
    } else {
      // "Ravi - 98765 43210" in one cell
      for (const field of ['name', 'shop', 'address'] as PersonField[]) {
        const match = values[field]?.match(MOBILE_IN_TEXT);
        if (match) {
          values.mobile = parseMobiles(match[0])[0];
          values[field] = values[field]!.replace(match[0], '').replace(/^[\s,:()-]+|[\s,:()-]+$/g, '');
          break;
        }
      }
    }
    if (values.alternate) values.alternate = parseMobiles(values.alternate)[0] ?? values.alternate;
    if (section && !hasArea && !values.area && PERSON_FIELDS[kind].includes('area')) values.area = section;
    if (!values.name && !values.mobile && !values.shop) continue;
    result.push({ sheetRow: index + 1, values });
  }
  return result;
}

export type PersonIssue = 'need-name' | 'need-mobile' | 'bad-mobile' | 'already-added' | 'repeated-in-list';

/** Why a row cannot be added yet; `seen` carries the mobiles of the rows before it. */
export function personIssue(values: PersonValues, existingMobiles: Set<string>, seen: Set<string>): PersonIssue | null {
  if (!values.name?.trim()) return 'need-name';
  const raw = values.mobile?.trim();
  if (!raw) return 'need-mobile';
  const mobile = parseMobiles(raw)[0];
  if (!mobile) return 'bad-mobile';
  if (existingMobiles.has(mobile)) return 'already-added';
  if (seen.has(mobile)) return 'repeated-in-list';
  seen.add(mobile);
  return null;
}

/** A CSV file as rows of cells (handles quotes and commas or semicolons). */
export function parseCsv(text: string): Cell[][] {
  const clean = text.replace(/^﻿/, '');
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? '';
  const separator = firstLine.split(';').length > firstLine.split(',').length ? ';' : firstLine.includes('\t') ? '\t' : ',';
  const rows: Cell[][] = [];
  let row: Cell[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === separator) { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  return rows;
}

const DIGIT_WORDS: Record<string, string> = {
  zero: '0', oh: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9',
  'பூஜ்யம்': '0', 'பூஜ்ஜியம்': '0', 'சுழியம்': '0', 'ஜீரோ': '0', 'ஒன்று': '1', 'ஒண்ணு': '1', 'ஒன்னு': '1', 'இரண்டு': '2', 'ரெண்டு': '2', 'மூன்று': '3', 'மூணு': '3',
  'நான்கு': '4', 'நாலு': '4', 'ஐந்து': '5', 'அஞ்சு': '5', 'ஆறு': '6', 'ஏழு': '7', 'எட்டு': '8', 'ஒன்பது': '9',
};
const REPEAT_WORDS: Record<string, number> = { double: 2, triple: 3, 'டபுள்': 2, 'இரட்டை': 2, 'டிரிபிள்': 3 };

/** Spoken numbers as digits: "nine eight double seven" or "ஒன்பது எட்டு" become 98.. */
export function spokenDigits(text: string): string {
  const tokens = text.split(/[\s,.-]+/).filter(Boolean);
  let digits = '';
  let repeat = 1;
  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (REPEAT_WORDS[lower]) { repeat = REPEAT_WORDS[lower]; continue; }
    const value = DIGIT_WORDS[lower] ?? (/^\d+$/.test(token) ? token : null);
    if (value === null) continue;
    digits += value.length === 1 ? value.repeat(repeat) : value;
    repeat = 1;
  }
  return digits;
}

const SPOKEN_KEYWORDS: [PersonField, string[]][] = [
  ['shop', ['shop name', 'shop', 'business name', 'business', 'கடையின் பெயர்', 'கடை பெயர்', 'கடை', 'நிறுவனம்']],
  ['relative', ['father name', "father's name", 'husband name', "husband's name", 'father', 'husband', 'தந்தை பெயர்', 'கணவர் பெயர்', 'அப்பா பெயர்', 'தந்தை', 'கணவர்', 'அப்பா']],
  ['alternate', ['alternate number', 'other number', 'மாற்று எண்']],
  ['mobile', ['mobile number', 'phone number', 'contact number', 'cell number', 'mobile', 'phone', 'cell', 'number', 'மொபைல் நம்பர்', 'மொபைல் எண்', 'கைபேசி எண்', 'தொலைபேசி எண்', 'போன் நம்பர்', 'மொபைல்', 'கைபேசி', 'நம்பர்', 'போன்', 'எண்']],
  ['area', ['area', 'location', 'place', 'line', 'பகுதி', 'ஏரியா', 'ஊர்', 'இடம்']],
  ['address', ['address', 'முகவரி', 'அட்ரஸ்']],
  ['landmark', ['landmark', 'அடையாளம்']],
  ['email', ['email', 'மின்னஞ்சல்']],
  ['name', ['customer name', 'collector name', 'full name', 'name', 'வாடிக்கையாளர் பெயர்', 'வசூலிப்பாளர் பெயர்', 'பெயர்']],
];

const cleanSpoken = (text: string) =>
  text.replace(/^[\s,.:]*(is|என்பது|ஆகும்)?[\s,.:]+/i, ' ').replace(/[\s,.:]*(is|என்பது|ஆகும்)?[\s,.:]*$/i, '').trim();

/**
 * Fills the fields from one spoken sentence, in English or Tamil: "name Ravi mobile 98765 43210 shop
 * Ravi Stores area Bazaar". Words before the first field word are the name.
 */
export function parseSpokenPerson(text: string, kind: PersonKind): PersonValues {
  const words = SPOKEN_KEYWORDS
    .filter(([field]) => PERSON_FIELDS[kind].includes(field))
    .flatMap(([field, list]) => list.map(word => ({ field, word })))
    .sort((a, b) => b.word.length - a.word.length);
  const pattern = new RegExp(`(^|[\\s,.])(${words.map(w => w.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?=$|[\\s,.:])`, 'gi');

  const hits: { field: PersonField; start: number; end: number }[] = [];
  for (const match of text.matchAll(pattern)) {
    const word = match[2].toLowerCase();
    const field = words.find(w => w.word.toLowerCase() === word)!.field;
    const start = match.index! + match[1].length;
    hits.push({ field, start, end: start + match[2].length });
  }

  const values: PersonValues = {};
  const lead = cleanSpoken(text.slice(0, hits[0]?.start ?? text.length));
  hits.forEach((hit, i) => {
    const value = cleanSpoken(text.slice(hit.end, hits[i + 1]?.start ?? text.length));
    if (value && !values[hit.field]) values[hit.field] = value;
  });
  if (lead && !values.name) values.name = lead;

  for (const field of ['mobile', 'alternate'] as PersonField[]) {
    if (values[field]) values[field] = spokenDigits(values[field]!) || values[field];
  }
  if (!values.mobile) {
    // A number said without a field word: take it out of whichever field caught it.
    for (const field of Object.keys(values) as PersonField[]) {
      const match = values[field]?.match(MOBILE_IN_TEXT);
      if (match) {
        values.mobile = parseMobiles(match[0])[0];
        values[field] = values[field]!.replace(match[0], '').trim();
        break;
      }
    }
  }
  if (values.mobile) values.mobile = parseMobiles(values.mobile)[0] ?? values.mobile;
  return values;
}
