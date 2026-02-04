/**
 * Generate a unique UID: 6 letters + 4 numbers
 * Format: ABCDEF1234
 */
export function generateUid(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';

  // Generate 6 random letters
  let letterPart = '';
  for (let i = 0; i < 6; i++) {
    letterPart += letters[Math.floor(Math.random() * letters.length)];
  }

  // Generate 4 random numbers
  let numberPart = '';
  for (let i = 0; i < 4; i++) {
    numberPart += numbers[Math.floor(Math.random() * numbers.length)];
  }

  return letterPart + numberPart;
}

