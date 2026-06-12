const CODE_LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_DIGITS = "23456789";

const PATTERN = [
  CODE_LETTERS,
  CODE_LETTERS,
  CODE_DIGITS,
  CODE_DIGITS,
  CODE_LETTERS,
  CODE_DIGITS,
];

export const CODE_LENGTH = PATTERN.length;

export function isValidCrewCode(code: string): boolean {
  if (code.length !== CODE_LENGTH) return false;
  return PATTERN.every((charset, i) => charset.includes(code[i]));
}

export function generateCrewCode(): string {
  return PATTERN.map(
    (charset) => charset[Math.floor(Math.random() * charset.length)],
  ).join("");
}

const ALLOWED = new RegExp(`[^${CODE_LETTERS}${CODE_DIGITS}]`, "g");

export function sanitizeCodeInput(raw: string): string {
  return raw.toUpperCase().replace(ALLOWED, "").slice(0, CODE_LENGTH);
}

export function hasConfusableChars(raw: string): boolean {
  return /[01ILO]/.test(raw.toUpperCase());
}
