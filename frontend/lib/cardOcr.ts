/**
 * Client-side credit card OCR using Tesseract.js
 *
 * SECURITY: The card image NEVER leaves the user's browser.
 * All OCR processing happens locally in a Web Worker.
 */

import Tesseract from 'tesseract.js';

export interface CardOcrResult {
  card_number?: string;
  cardholder_name?: string;
  expiry_month?: string;
  expiry_year?: string;
  cvv?: string;
  card_network?: string;
  bank_name?: string;
}

// Known UAE bank names for matching
const KNOWN_BANKS = [
  'FAB', 'First Abu Dhabi Bank',
  'ADCB', 'Abu Dhabi Commercial Bank',
  'ENBD', 'Emirates NBD',
  'DIB', 'Dubai Islamic Bank',
  'Mashreq', 'MashreqBank',
  'RAKBANK', 'RAK Bank',
  'CBD', 'Commercial Bank of Dubai',
  'NBF', 'National Bank of Fujairah',
  'UAB', 'United Arab Bank',
  'Al Hilal', 'Abu Dhabi Islamic Bank', 'ADIB',
  'Ajman Bank', 'Sharjah Islamic Bank', 'SIB',
  'Invest Bank', 'National Bank of Umm Al Qaiwain',
  'Etihad', 'HSBC', 'Citibank', 'Standard Chartered',
  'Barclays', 'Deutsche Bank',
];

/**
 * Detect card network from card number prefix
 */
function detectNetwork(cardNumber: string): string | undefined {
  const num = cardNumber.replace(/\D/g, '');
  if (!num) return undefined;
  if (/^4/.test(num)) return 'visa';
  if (/^(5[1-5]|2[2-7])/.test(num)) return 'mastercard';
  if (/^3[47]/.test(num)) return 'amex';
  if (/^6/.test(num)) return 'discover';
  return undefined;
}

/**
 * Luhn algorithm to validate card numbers
 */
function luhnCheck(num: string): boolean {
  const digits = num.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let isEven = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10);
    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}

/**
 * Extract card details from OCR text using regex patterns
 */
function extractCardDetails(text: string): CardOcrResult {
  const result: CardOcrResult = {};

  // Normalize text: fix common OCR mistakes
  let normalized = text
    .replace(/[oO]/g, (match, offset, str) => {
      // Only replace O with 0 if it's in a number context
      const before = str[offset - 1] || '';
      const after = str[offset + 1] || '';
      if (/\d/.test(before) || /\d/.test(after)) return '0';
      return match;
    })
    .replace(/[lI|]/g, (match, offset, str) => {
      const before = str[offset - 1] || '';
      const after = str[offset + 1] || '';
      if (/\d/.test(before) || /\d/.test(after)) return '1';
      return match;
    });

  // 1. Extract card number - look for 13-19 digit sequences
  // Pattern: 4 groups of 4 digits with optional separators
  const cardPatterns = [
    /(\d{4}[\s\-\.]{0,3}\d{4}[\s\-\.]{0,3}\d{4}[\s\-\.]{0,3}\d{4})/,
    /(\d{4}[\s\-\.]{0,3}\d{4}[\s\-\.]{0,3}\d{4}[\s\-\.]{0,3}\d{3})/,  // AMEX 15 digits
    /(\d{13,19})/,  // Continuous digits
  ];

  for (const pattern of cardPatterns) {
    const match = normalized.match(pattern);
    if (match) {
      const digits = match[1].replace(/\D/g, '');
      if (digits.length >= 13 && digits.length <= 19) {
        if (luhnCheck(digits)) {
          result.card_number = digits;
          result.card_network = detectNetwork(digits);
        }
      }
    }
    if (result.card_number) break;
  }

  // If no Luhn-valid number found, try to find any 16-digit sequence
  if (!result.card_number) {
    const anyDigits = normalized.match(/\d{4}[\s\-\.]{0,3}\d{4}[\s\-\.]{0,3}\d{4}[\s\-\.]{0,3}\d{4}/);
    if (anyDigits) {
      const digits = anyDigits[0].replace(/\D/g, '');
      if (digits.length === 16) {
        result.card_number = digits;
        result.card_network = detectNetwork(digits);
      }
    }
  }

  // 2. Extract expiry date (MM/YY or MM/YYYY)
  const expiryPatterns = [
    /(?:VALID|THRU|EXP|EXPIRES?|GOOD)[\s\-:]*(\d{2})\s*[\/\-\.]\s*(\d{2,4})/i,
    /(\d{2})\s*[\/\-]\s*(\d{2,4})(?!\d)/,  // Generic MM/YY but not part of longer number
  ];

  for (const pattern of expiryPatterns) {
    const match = normalized.match(pattern);
    if (match) {
      const month = parseInt(match[1], 10);
      if (month >= 1 && month <= 12) {
        result.expiry_month = match[1];
        let year = match[2];
        if (year.length === 4) year = year.slice(2);
        result.expiry_year = year;
        break;
      }
    }
  }

  // 3. Extract CVV (3-4 digits, usually on the back near "CVV" text)
  const cvvPatterns = [
    /(?:CVV|CVC|CVN|CCV|CSC|SECURITY\s*CODE)[\s\-:]*(\d{3,4})/i,
    /(\d{3,4})[\s]*(?:CVV|CVC|CVN)/i,
  ];

  for (const pattern of cvvPatterns) {
    const match = text.match(pattern);  // Use original text for CVV
    if (match) {
      result.cvv = match[1];
      break;
    }
  }

  // If no labeled CVV found, look for standalone 3-digit numbers on back of card
  // (only if we found some other card data, suggesting this is a real card image)
  if (!result.cvv && result.card_number) {
    const threeDigitGroups = text.match(/(?<!\d)(\d{3})(?!\d)/g);
    if (threeDigitGroups) {
      // Filter out months (01-12) and obvious non-CVV numbers
      for (const group of threeDigitGroups) {
        const num = parseInt(group, 10);
        if (num >= 100 && num <= 999 && group !== result.expiry_month?.padStart(3, '0')) {
          // Check it's not part of the card number
          if (!result.card_number.includes(group)) {
            result.cvv = group;
            break;
          }
        }
      }
    }
  }

  // 4. Extract cardholder name
  // Look for ALL CAPS text that looks like a name (2+ words, letters only)
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    // Skip lines with numbers (card number, expiry, etc.)
    if (/\d{4}/.test(line)) continue;
    // Skip known labels
    if (/^(VALID|THRU|EXP|CVV|CVC|DEBIT|CREDIT|VISA|MASTER|AMEX|PLATINUM|GOLD|SIGNATURE|CLASSIC|AUTHORISED|NOT VALID|CUSTOMER|MEMBER)/i.test(line)) continue;

    // Look for name-like patterns: 2-4 words of letters
    const nameMatch = line.match(/^([A-Z][A-Z\s\.\-']{3,40})$/);
    if (nameMatch) {
      const name = nameMatch[1].trim();
      const words = name.split(/\s+/).filter(w => w.length >= 2);
      if (words.length >= 2 && words.length <= 5) {
        result.cardholder_name = name;
        break;
      }
    }
  }

  // 5. Extract bank name
  const fullText = text.toUpperCase();
  for (const bank of KNOWN_BANKS) {
    if (fullText.includes(bank.toUpperCase())) {
      result.bank_name = bank;
      break;
    }
  }

  return result;
}

/**
 * Perform OCR on a card image and extract details
 * All processing happens client-side - image never leaves the browser
 */
export async function scanCardImage(
  imageSource: File | string,
  onProgress?: (progress: number) => void
): Promise<CardOcrResult> {
  // Run Tesseract OCR
  const worker = await Tesseract.createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(Math.round(m.progress * 100));
      }
    },
  });

  try {
    const { data: { text } } = await worker.recognize(imageSource);
    await worker.terminate();

    if (!text || text.trim().length < 5) {
      return {};
    }

    return extractCardDetails(text);
  } catch (error) {
    await worker.terminate();
    throw error;
  }
}
