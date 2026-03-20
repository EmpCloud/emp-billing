"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloudOCRProvider = exports.TesseractOCRProvider = void 0;
exports.parseReceiptText = parseReceiptText;
exports.processReceipt = processReceipt;
exports.getOCRProvider = getOCRProvider;
const logger_1 = require("../../utils/logger");
// ── Tesseract OCR Provider (Local) ───────────────────────────────────────────
class TesseractOCRProvider {
    name = "tesseract";
    async extractText(imageBuffer, mimeType) {
        try {
            // Dynamic import to avoid hard dependency — tesseract.js is optional
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const Tesseract = await Promise.resolve().then(() => __importStar(require(/* @vite-ignore */ "tesseract.js")));
            const validMimeTypes = [
                "image/png",
                "image/jpeg",
                "image/jpg",
                "image/webp",
                "image/bmp",
                "image/tiff",
            ];
            if (!validMimeTypes.includes(mimeType)) {
                logger_1.logger.warn(`Unsupported mime type for Tesseract OCR: ${mimeType}`);
                return { rawText: "", confidence: 0 };
            }
            const worker = await Tesseract.createWorker("eng");
            const { data } = await worker.recognize(imageBuffer);
            await worker.terminate();
            const rawText = data.text;
            const confidence = data.confidence / 100; // normalize to 0–1
            const parsed = parseReceiptText(rawText);
            return {
                rawText,
                merchantName: parsed.merchantName ?? undefined,
                date: parsed.date ?? undefined,
                total: parsed.total ?? undefined,
                currency: parsed.currency ?? undefined,
                lineItems: parsed.lineItems.length > 0 ? parsed.lineItems : undefined,
                confidence,
            };
        }
        catch (err) {
            logger_1.logger.error("Tesseract OCR extraction failed", { err });
            return { rawText: "", confidence: 0 };
        }
    }
}
exports.TesseractOCRProvider = TesseractOCRProvider;
// ── Cloud OCR Provider (Placeholder) ─────────────────────────────────────────
// Extend with Google Cloud Vision, AWS Textract, or Azure Form Recognizer.
class CloudOCRProvider {
    name = "cloud";
    provider;
    constructor(provider = "google-vision") {
        this.provider = provider;
    }
    async extractText(imageBuffer, mimeType) {
        // -----------------------------------------------------------------------
        // PLACEHOLDER — integrate your preferred cloud OCR provider here.
        //
        // Google Vision example (pseudo-code):
        //   const vision = require('@google-cloud/vision');
        //   const client = new vision.ImageAnnotatorClient();
        //   const [result] = await client.textDetection({ image: { content: imageBuffer } });
        //   const rawText = result.textAnnotations?.[0]?.description ?? "";
        //
        // AWS Textract example (pseudo-code):
        //   const { TextractClient, AnalyzeExpenseCommand } = require('@aws-sdk/client-textract');
        //   const client = new TextractClient({ region: 'us-east-1' });
        //   const command = new AnalyzeExpenseCommand({ Document: { Bytes: imageBuffer } });
        //   const response = await client.send(command);
        // -----------------------------------------------------------------------
        logger_1.logger.warn(`CloudOCRProvider (${this.provider}) is a placeholder. ` +
            "Install the relevant SDK and implement extractText().");
        return {
            rawText: "",
            confidence: 0,
        };
    }
}
exports.CloudOCRProvider = CloudOCRProvider;
// ── Receipt Text Parser ──────────────────────────────────────────────────────
// Regex-based extraction of structured data from raw OCR text.
function parseReceiptText(rawText) {
    const lines = rawText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
    const merchantName = extractMerchantName(lines);
    const date = extractDate(rawText);
    const { total, currency } = extractTotal(rawText);
    const lineItems = extractLineItems(lines);
    // Confidence heuristic: count how many fields we successfully extracted
    let fieldsFound = 0;
    if (merchantName)
        fieldsFound++;
    if (date)
        fieldsFound++;
    if (total !== null)
        fieldsFound++;
    if (lineItems.length > 0)
        fieldsFound++;
    const confidence = fieldsFound / 4;
    return {
        merchantName,
        date,
        total,
        currency,
        lineItems,
        rawText,
        confidence,
    };
}
// ── Extraction Helpers ───────────────────────────────────────────────────────
function extractMerchantName(lines) {
    // The merchant name is typically on the first non-empty line(s) of a receipt.
    // Skip lines that look like dates, totals, or very short noise.
    for (const line of lines.slice(0, 5)) {
        // Skip lines that are purely numeric, date-like, or very short
        if (/^\d+$/.test(line))
            continue;
        if (/^\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}$/.test(line))
            continue;
        if (line.length < 3)
            continue;
        // Skip lines that look like a total/subtotal header
        if (/^(total|subtotal|sub\s*total|amount|balance|change|cash|card)/i.test(line))
            continue;
        return line;
    }
    return null;
}
function extractDate(text) {
    // Common date patterns on receipts
    const patterns = [
        // DD/MM/YYYY or DD-MM-YYYY
        {
            regex: /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,
            format: (m) => `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`,
        },
        // YYYY-MM-DD (ISO)
        {
            regex: /(\d{4})-(\d{2})-(\d{2})/,
            format: (m) => `${m[1]}-${m[2]}-${m[3]}`,
        },
        // MM/DD/YYYY
        {
            regex: /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
            format: (m) => `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`,
        },
        // Month DD, YYYY  (e.g. "Jan 15, 2026")
        {
            regex: /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{1,2}),?\s+(\d{4})/i,
            format: (m) => {
                const months = {
                    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
                    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
                };
                const mon = months[m[1].slice(0, 3).toLowerCase()] ?? "01";
                return `${m[3]}-${mon}-${m[2].padStart(2, "0")}`;
            },
        },
        // DD Month YYYY  (e.g. "15 January 2026")
        {
            regex: /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{4})/i,
            format: (m) => {
                const months = {
                    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
                    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
                };
                const mon = months[m[2].slice(0, 3).toLowerCase()] ?? "01";
                return `${m[3]}-${mon}-${m[1].padStart(2, "0")}`;
            },
        },
    ];
    for (const { regex, format } of patterns) {
        const match = text.match(regex);
        if (match) {
            return format(match);
        }
    }
    return null;
}
function extractTotal(text) {
    // Currency symbols → ISO codes
    const currencyMap = {
        "$": "USD",
        "\u20B9": "INR",
        "Rs": "INR",
        "Rs.": "INR",
        "INR": "INR",
        "\u00A3": "GBP",
        "\u20AC": "EUR",
        "\u00A5": "JPY",
        "A$": "AUD",
        "C$": "CAD",
    };
    // Look for total-like lines, prioritizing "Grand Total" > "Total" > "Amount Due"
    const totalPatterns = [
        /(?:grand\s*total|total\s*amount|amount\s*due|total\s*due|balance\s*due)[:\s]*([^\d]*)(\d[\d,]*\.?\d*)/i,
        /(?:total)[:\s]*([^\d]*)(\d[\d,]*\.?\d*)/i,
        /(?:subtotal|sub\s*total)[:\s]*([^\d]*)(\d[\d,]*\.?\d*)/i,
    ];
    for (const pattern of totalPatterns) {
        const match = text.match(pattern);
        if (match) {
            const rawCurrency = match[1]?.trim() || null;
            const rawAmount = match[2].replace(/,/g, "");
            const amount = parseFloat(rawAmount);
            if (isNaN(amount))
                continue;
            let currency = null;
            if (rawCurrency) {
                currency = currencyMap[rawCurrency] ?? (rawCurrency.toUpperCase() || null);
            }
            // Also scan the broader text for a currency symbol if not found near total
            if (!currency) {
                for (const [symbol, code] of Object.entries(currencyMap)) {
                    if (text.includes(symbol)) {
                        currency = code;
                        break;
                    }
                }
            }
            // Convert to smallest unit (paise/cents) as per codebase convention
            const total = Math.round(amount * 100);
            return { total, currency };
        }
    }
    return { total: null, currency: null };
}
function extractLineItems(lines) {
    const items = [];
    // Common line-item pattern: "Description ... $12.34" or "Description  12.34"
    // Skip lines that are clearly headers or totals.
    const skipPatterns = /^(total|subtotal|sub\s*total|tax|gst|vat|discount|change|cash|card|visa|mastercard|upi|amount\s*due|balance|grand\s*total|thank\s*you)/i;
    for (const line of lines) {
        if (skipPatterns.test(line))
            continue;
        // Match: "Some description  12.34" or "Some description $12.34"
        const match = line.match(/^(.+?)\s{2,}[^\d]*(\d[\d,]*\.?\d*)$/);
        if (match) {
            const description = match[1].trim();
            const rawAmount = match[2].replace(/,/g, "");
            const amount = parseFloat(rawAmount);
            if (description.length >= 2 && !isNaN(amount) && amount > 0) {
                // Store in smallest unit
                items.push({ description, amount: Math.round(amount * 100) });
            }
        }
    }
    return items;
}
// ── Main Entry Point ─────────────────────────────────────────────────────────
async function processReceipt(fileBuffer, mimeType) {
    const provider = getOCRProvider();
    logger_1.logger.info(`Processing receipt with OCR provider: ${provider.name}`);
    const ocrResult = await provider.extractText(fileBuffer, mimeType);
    // If the provider already parsed fields (e.g. cloud OCR with structured output),
    // merge them with our regex parser for better coverage.
    const parsed = parseReceiptText(ocrResult.rawText);
    return {
        merchantName: ocrResult.merchantName ?? parsed.merchantName,
        date: ocrResult.date ?? parsed.date,
        total: ocrResult.total ?? parsed.total,
        currency: ocrResult.currency ?? parsed.currency,
        lineItems: ocrResult.lineItems && ocrResult.lineItems.length > 0
            ? ocrResult.lineItems
            : parsed.lineItems,
        rawText: ocrResult.rawText,
        confidence: Math.max(ocrResult.confidence, parsed.confidence),
    };
}
// ── Factory ──────────────────────────────────────────────────────────────────
function getOCRProvider() {
    const providerName = process.env.OCR_PROVIDER || "tesseract";
    switch (providerName) {
        case "google-vision":
            return new CloudOCRProvider("google-vision");
        case "aws-textract":
            return new CloudOCRProvider("aws-textract");
        case "azure-form":
            return new CloudOCRProvider("azure-form");
        case "tesseract":
        default:
            return new TesseractOCRProvider();
    }
}
//# sourceMappingURL=ocr.service.js.map