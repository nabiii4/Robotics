import bcrypt from 'bcryptjs';

// BCRYPT_COST caps the work factor (the in-browser GitHub Pages version uses a lower one)
export const hashPassword = (pw: string, cost = 12) => bcrypt.hash(pw, Math.min(cost, Number(process.env.BCRYPT_COST) || cost));
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

export function passwordProblems(pw: string): string | null {
  if (pw.length < 10) return 'Use at least 10 characters.';
  if (/^(.)\1+$/.test(pw)) return 'That password is too easy to guess.';
  return null;
}

export { strength } from '../strength';
