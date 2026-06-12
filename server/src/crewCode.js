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

export function isValidCrewCode(code) {
  if (typeof code !== "string" || code.length !== CODE_LENGTH) return false;
  return PATTERN.every((charset, i) => charset.includes(code[i]));
}

export function generateCrewCode() {
  return PATTERN.map(
    (charset) => charset[Math.floor(Math.random() * charset.length)],
  ).join("");
}
