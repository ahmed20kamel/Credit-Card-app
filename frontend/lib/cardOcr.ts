/**
 * Client-side credit card OCR using Tesseract.js
 *
 * SECURITY: The card image NEVER leaves the user's browser.
 * All OCR processing happens locally in a Web Worker.
 *
 * Includes advanced image preprocessing for embossed/metallic card text.
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

// ── Image Preprocessing Helpers ─────────────────────────────────

/**
 * Load an image from File or URL into an HTMLImageElement
 */
function loadImage(source: File | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));

    if (source instanceof File) {
      const reader = new FileReader();
      reader.onload = () => {
        img.src = reader.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(source);
    } else {
      img.src = source;
    }
  });
}

/**
 * Get pixel data from image, optionally scaling up for better OCR
 */
function getImageData(img: HTMLImageElement, scale: number = 1): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; imageData: ImageData } {
  const canvas = document.createElement('canvas');
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);
  return { canvas, ctx, imageData };
}

/**
 * Convert to grayscale
 */
function grayscale(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = data[i + 1] = data[i + 2] = gray;
  }
}

/**
 * Adjust contrast (factor > 1 increases contrast)
 */
function adjustContrast(data: Uint8ClampedArray, factor: number): void {
  const intercept = 128 * (1 - factor);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, Math.max(0, data[i] * factor + intercept));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] * factor + intercept));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] * factor + intercept));
  }
}

/**
 * Adjust brightness
 */
function adjustBrightness(data: Uint8ClampedArray, amount: number): void {
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, Math.max(0, data[i] + amount));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + amount));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + amount));
  }
}

/**
 * Invert colors
 */
function invertColors(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i];
    data[i + 1] = 255 - data[i + 1];
    data[i + 2] = 255 - data[i + 2];
  }
}

/**
 * Apply threshold (binarize)
 */
function threshold(data: Uint8ClampedArray, thresh: number): void {
  for (let i = 0; i < data.length; i += 4) {
    const v = data[i] > thresh ? 255 : 0;
    data[i] = data[i + 1] = data[i + 2] = v;
  }
}

/**
 * Adaptive threshold using local mean
 */
function adaptiveThreshold(imageData: ImageData, blockSize: number, C: number): void {
  const { data, width, height } = imageData;
  const gray = new Uint8Array(width * height);

  // Extract grayscale values
  for (let i = 0; i < gray.length; i++) {
    gray[i] = data[i * 4];
  }

  const half = Math.floor(blockSize / 2);

  // Compute integral image for fast mean calculation
  const integral = new Float64Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) {
      rowSum += gray[y * width + x];
      integral[(y + 1) * (width + 1) + (x + 1)] =
        rowSum + integral[y * (width + 1) + (x + 1)];
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const x1 = Math.max(0, x - half);
      const y1 = Math.max(0, y - half);
      const x2 = Math.min(width - 1, x + half);
      const y2 = Math.min(height - 1, y + half);

      const count = (x2 - x1 + 1) * (y2 - y1 + 1);
      const sum =
        integral[(y2 + 1) * (width + 1) + (x2 + 1)] -
        integral[y1 * (width + 1) + (x2 + 1)] -
        integral[(y2 + 1) * (width + 1) + x1] +
        integral[y1 * (width + 1) + x1];

      const mean = sum / count;
      const idx = (y * width + x) * 4;
      const v = gray[y * width + x] > mean - C ? 255 : 0;
      data[idx] = data[idx + 1] = data[idx + 2] = v;
    }
  }
}

/**
 * Apply a 3x3 convolution kernel
 */
function convolve3x3(imageData: ImageData, kernel: number[]): ImageData {
  const { data, width, height } = imageData;
  const output = new Uint8ClampedArray(data.length);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4 + c;
            sum += data[idx] * kernel[(ky + 1) * 3 + (kx + 1)];
          }
        }
        output[(y * width + x) * 4 + c] = Math.min(255, Math.max(0, sum));
      }
      output[(y * width + x) * 4 + 3] = 255; // alpha
    }
  }

  const result = new ImageData(output, width, height);
  return result;
}

/**
 * Sharpen image
 */
function sharpen(imageData: ImageData): ImageData {
  const kernel = [
    0, -1, 0,
    -1, 5, -1,
    0, -1, 0,
  ];
  return convolve3x3(imageData, kernel);
}

/**
 * Emboss filter - highlights raised/embossed text by detecting directional shadows
 */
function emboss(imageData: ImageData): ImageData {
  const kernel = [
    -2, -1, 0,
    -1, 1, 1,
    0, 1, 2,
  ];
  return convolve3x3(imageData, kernel);
}

/**
 * Edge detection (Sobel-like)
 */
function edgeDetect(imageData: ImageData): ImageData {
  const { data, width, height } = imageData;
  const output = new Uint8ClampedArray(data.length);

  const gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const gy = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sumX = 0, sumY = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = ((y + ky) * width + (x + kx)) * 4;
          const val = data[idx];
          sumX += val * gx[(ky + 1) * 3 + (kx + 1)];
          sumY += val * gy[(ky + 1) * 3 + (kx + 1)];
        }
      }
      const magnitude = Math.min(255, Math.sqrt(sumX * sumX + sumY * sumY));
      const idx = (y * width + x) * 4;
      output[idx] = output[idx + 1] = output[idx + 2] = magnitude;
      output[idx + 3] = 255;
    }
  }

  return new ImageData(output, width, height);
}

// ── Preprocessing Strategies ────────────────────────────────────

type PreprocessFn = (img: HTMLImageElement) => HTMLCanvasElement;

/**
 * Strategy 1: High contrast grayscale with sharpening
 */
const preprocessHighContrast: PreprocessFn = (img) => {
  const { canvas, ctx, imageData } = getImageData(img, 2);
  grayscale(imageData.data);
  adjustContrast(imageData.data, 3.0);
  adjustBrightness(imageData.data, 30);
  const sharpened = sharpen(imageData);
  ctx.putImageData(sharpened, 0, 0);
  return canvas;
};

/**
 * Strategy 2: Emboss filter to reveal raised text, then threshold
 */
const preprocessEmboss: PreprocessFn = (img) => {
  const { canvas, ctx, imageData } = getImageData(img, 2);
  grayscale(imageData.data);
  const embossed = emboss(imageData);
  adjustContrast(embossed.data, 2.5);
  adjustBrightness(embossed.data, 128);
  threshold(embossed.data, 140);
  ctx.putImageData(embossed, 0, 0);
  return canvas;
};

/**
 * Strategy 3: Inverted high contrast (for light text on dark background)
 */
const preprocessInverted: PreprocessFn = (img) => {
  const { canvas, ctx, imageData } = getImageData(img, 2);
  grayscale(imageData.data);
  invertColors(imageData.data);
  adjustContrast(imageData.data, 3.0);
  const sharpened = sharpen(imageData);
  ctx.putImageData(sharpened, 0, 0);
  return canvas;
};

/**
 * Strategy 4: Adaptive threshold (handles uneven lighting/metallic surfaces)
 */
const preprocessAdaptive: PreprocessFn = (img) => {
  const { canvas, ctx, imageData } = getImageData(img, 2);
  grayscale(imageData.data);
  adjustContrast(imageData.data, 1.5);
  adaptiveThreshold(imageData, 31, 10);
  ctx.putImageData(imageData, 0, 0);
  return canvas;
};

/**
 * Strategy 5: Edge detection to find embossed text edges
 */
const preprocessEdge: PreprocessFn = (img) => {
  const { canvas, ctx, imageData } = getImageData(img, 2);
  grayscale(imageData.data);
  adjustContrast(imageData.data, 2.0);
  const edges = edgeDetect(imageData);
  invertColors(edges.data);
  threshold(edges.data, 200);
  ctx.putImageData(edges, 0, 0);
  return canvas;
};

/**
 * Strategy 6: Extreme contrast with global threshold
 */
const preprocessExtreme: PreprocessFn = (img) => {
  const { canvas, ctx, imageData } = getImageData(img, 2);
  grayscale(imageData.data);
  adjustContrast(imageData.data, 5.0);
  threshold(imageData.data, 128);
  ctx.putImageData(imageData, 0, 0);
  return canvas;
};

/**
 * Strategy 7: Emboss + inverted (for dark cards with embossed text)
 */
const preprocessEmbossInverted: PreprocessFn = (img) => {
  const { canvas, ctx, imageData } = getImageData(img, 2);
  grayscale(imageData.data);
  const embossed = emboss(imageData);
  invertColors(embossed.data);
  adjustContrast(embossed.data, 3.0);
  threshold(embossed.data, 100);
  ctx.putImageData(embossed, 0, 0);
  return canvas;
};

const STRATEGIES: { name: string; fn: PreprocessFn }[] = [
  { name: 'high-contrast', fn: preprocessHighContrast },
  { name: 'emboss', fn: preprocessEmboss },
  { name: 'inverted', fn: preprocessInverted },
  { name: 'adaptive', fn: preprocessAdaptive },
  { name: 'edge-detect', fn: preprocessEdge },
  { name: 'extreme', fn: preprocessExtreme },
  { name: 'emboss-inverted', fn: preprocessEmbossInverted },
];

// ── Text Extraction ─────────────────────────────────────────────

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
    })
    .replace(/[sS](?=\d)/g, '5')
    .replace(/(?<=\d)[sS]/g, '5')
    .replace(/[bB](?=\d{3})/g, '8')
    .replace(/(?<=\d)[bB]/g, '8');

  // 1. Extract card number - look for 13-19 digit sequences
  const cardPatterns = [
    /(\d{4}[\s\-\.]{0,3}\d{4}[\s\-\.]{0,3}\d{4}[\s\-\.]{0,3}\d{4})/,
    /(\d{4}[\s\-\.]{0,3}\d{6}[\s\-\.]{0,3}\d{5})/,  // AMEX format
    /(\d{4}[\s\-\.]{0,3}\d{4}[\s\-\.]{0,3}\d{4}[\s\-\.]{0,3}\d{3})/,
    /(\d{13,19})/,
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

  // If no Luhn-valid number found, try any 16-digit sequence
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

  // Even more relaxed: look for sequences of 4+ digits and try to concatenate nearby ones
  if (!result.card_number) {
    const groups = normalized.match(/\d{4,}/g);
    if (groups && groups.length >= 2) {
      const combined = groups.join('');
      if (combined.length >= 13 && combined.length <= 19 && luhnCheck(combined)) {
        result.card_number = combined;
        result.card_network = detectNetwork(combined);
      } else if (combined.length >= 16) {
        // Try first 16 digits
        const first16 = combined.slice(0, 16);
        if (luhnCheck(first16)) {
          result.card_number = first16;
          result.card_network = detectNetwork(first16);
        }
      }
    }
  }

  // 2. Extract expiry date (MM/YY or MM/YYYY)
  const expiryPatterns = [
    /(?:VALID|THRU|EXP|EXPIRES?|GOOD)[\s\-:]*(\d{2})\s*[\/\-\.]\s*(\d{2,4})/i,
    /(\d{2})\s*[\/\-]\s*(\d{2,4})(?!\d)/,
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

  // 3. Extract CVV
  const cvvPatterns = [
    /(?:CVV|CVC|CVN|CCV|CSC|SECURITY\s*CODE)[\s\-:]*(\d{3,4})/i,
    /(\d{3,4})[\s]*(?:CVV|CVC|CVN)/i,
  ];

  for (const pattern of cvvPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.cvv = match[1];
      break;
    }
  }

  if (!result.cvv && result.card_number) {
    const threeDigitGroups = text.match(/(?<!\d)(\d{3})(?!\d)/g);
    if (threeDigitGroups) {
      for (const group of threeDigitGroups) {
        const num = parseInt(group, 10);
        if (num >= 100 && num <= 999 && group !== result.expiry_month?.padStart(3, '0')) {
          if (!result.card_number.includes(group)) {
            result.cvv = group;
            break;
          }
        }
      }
    }
  }

  // 4. Extract cardholder name
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    if (/\d{4}/.test(line)) continue;
    if (/^(VALID|THRU|EXP|CVV|CVC|DEBIT|CREDIT|VISA|MASTER|AMEX|PLATINUM|GOLD|SIGNATURE|CLASSIC|AUTHORISED|NOT VALID|CUSTOMER|MEMBER)/i.test(line)) continue;

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
 * Score a result: more fields = better
 */
function scoreResult(result: CardOcrResult): number {
  let score = 0;
  if (result.card_number) score += 10;  // Card number is most important
  if (result.cardholder_name) score += 3;
  if (result.expiry_month && result.expiry_year) score += 3;
  if (result.cvv) score += 2;
  if (result.card_network) score += 1;
  if (result.bank_name) score += 1;
  return score;
}

/**
 * Merge two results, preferring the one with more data per field
 */
function mergeResults(a: CardOcrResult, b: CardOcrResult): CardOcrResult {
  return {
    card_number: a.card_number || b.card_number,
    cardholder_name: a.cardholder_name || b.cardholder_name,
    expiry_month: a.expiry_month || b.expiry_month,
    expiry_year: a.expiry_year || b.expiry_year,
    cvv: a.cvv || b.cvv,
    card_network: a.card_network || b.card_network,
    bank_name: a.bank_name || b.bank_name,
  };
}

/**
 * Perform OCR on a card image and extract details.
 * Runs multiple preprocessing strategies in parallel for best results.
 * All processing happens client-side - image never leaves the browser.
 */
export async function scanCardImage(
  imageSource: File | string,
  onProgress?: (progress: number) => void
): Promise<CardOcrResult> {
  // Load the image
  const img = await loadImage(imageSource);

  // Generate preprocessed canvases
  const preprocessed: { name: string; canvas: HTMLCanvasElement }[] = [];
  for (const strategy of STRATEGIES) {
    try {
      const canvas = strategy.fn(img);
      preprocessed.push({ name: strategy.name, canvas });
    } catch {
      // Skip failed preprocessing
    }
  }

  if (preprocessed.length === 0) {
    return {};
  }

  let bestResult: CardOcrResult = {};
  let bestScore = 0;
  let mergedResult: CardOcrResult = {};

  const totalPasses = preprocessed.length;
  let completedPasses = 0;

  // Run OCR on each preprocessed image
  for (const { name, canvas } of preprocessed) {
    const worker = await Tesseract.createWorker('eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text' && onProgress) {
          const passProgress = m.progress;
          const overall = ((completedPasses + passProgress) / totalPasses) * 100;
          onProgress(Math.round(overall));
        }
      },
    });

    try {
      // Configure Tesseract for best digit recognition
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz /.-',
        tessedit_pageseg_mode: Tesseract.PSM.AUTO,
      });

      const { data: { text } } = await worker.recognize(canvas);
      await worker.terminate();

      completedPasses++;

      if (!text || text.trim().length < 3) continue;

      console.log(`[CardOCR] Strategy "${name}" text:`, text.substring(0, 200));

      const result = extractCardDetails(text);
      const score = scoreResult(result);

      // Track best single result
      if (score > bestScore) {
        bestScore = score;
        bestResult = result;
      }

      // Merge all results (fill in missing fields from other strategies)
      mergedResult = mergeResults(mergedResult, result);

      // If we found a card number, we can stop early for speed
      // (but continue merging if we haven't found all fields)
      if (mergedResult.card_number && mergedResult.cardholder_name && mergedResult.expiry_month) {
        if (onProgress) onProgress(100);
        break;
      }
    } catch {
      await worker.terminate();
      completedPasses++;
    }
  }

  if (onProgress) onProgress(100);

  // Return merged result (has more fields) if it has a card number,
  // otherwise return best single result
  const finalResult = mergedResult.card_number ? mergedResult : bestResult;
  console.log('[CardOCR] Final result:', finalResult);
  return finalResult;
}
