export interface JodiMetrics {
  jodi: string;
  totalStr: string;
  diffStr: string;
  total: number | null;
  diff: number | null;
}

export const JODI_FAMILIES: Record<string, string[]> = {
  "01": ["01", "10", "06", "60", "51", "15", "56", "65"],
  "02": ["02", "20", "07", "70", "52", "25", "57", "75"],
  "03": ["03", "30", "08", "80", "53", "35", "58", "85"],
  "04": ["04", "40", "09", "90", "54", "45", "59", "95"],
  "05": ["05", "50", "00", "55"],
  "12": ["12", "21", "17", "71", "62", "26", "67", "76"],
  "13": ["13", "31", "18", "81", "63", "36", "68", "86"],
  "14": ["14", "41", "19", "91", "64", "46", "69", "96"],
  "16": ["16", "61", "11", "66"],
  "23": ["23", "32", "28", "82", "73", "37", "78", "87"],
  "24": ["24", "42", "29", "92", "74", "47", "79", "97"],
  "27": ["27", "72", "22", "77"],
  "34": ["34", "43", "39", "93", "84", "48", "89", "98"],
  "38": ["38", "83", "33", "88"],
  "49": ["49", "94", "44", "99"]
};

export const calculateMatkaDiff = (open: number, close: number): number => {
  let diff = open - close;
  if (diff < 0) diff += 10;
  return diff;
};

export const calculateMatkaTotal = (open: number, close: number): number => {
  return (open + close) % 10;
};

export const checkSameFamily = (jodi1: string, jodi2: string): boolean => {
  if (!jodi1 || !jodi2 || jodi1 === '**' || jodi2 === '**') return false;
  for (const family of Object.values(JODI_FAMILIES)) {
    if (family.includes(jodi1) && family.includes(jodi2)) return true;
  }
  return false;
};

export const getJodiMetrics = (jodiStr: string): JodiMetrics => {
  if (!jodiStr || jodiStr === '**' || jodiStr.length < 2) {
    return { jodi: jodiStr || '**', totalStr: '', diffStr: '', total: null, diff: null };
  }
  const open = parseInt(jodiStr[0], 10);
  const close = parseInt(jodiStr[1], 10);

  if (isNaN(open) || isNaN(close)) {
    return { jodi: jodiStr, totalStr: '', diffStr: '', total: null, diff: null };
  }

  const total = calculateMatkaTotal(open, close);
  const diff = calculateMatkaDiff(open, close);

  return { jodi: jodiStr, totalStr: `T-${total}`, diffStr: `D-${diff}`, total, diff };
};