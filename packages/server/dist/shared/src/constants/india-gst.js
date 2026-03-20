"use strict";
// ============================================================================
// INDIA GST CONSTANTS
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.INDIAN_STATES = exports.TDS_RATES_INDIA = exports.GST_CESS_RATES = exports.GST_RATES = void 0;
exports.computeGST = computeGST;
exports.isInterStateGST = isInterStateGST;
exports.extractStateFromGSTIN = extractStateFromGSTIN;
exports.GST_RATES = [0, 5, 12, 18, 28];
exports.GST_CESS_RATES = {
    28: [1, 3, 5, 12, 15, 22, 36, 65], // cess options for 28% slab
};
function computeGST(amount, rate, isInterState) {
    const taxAmount = Math.round(amount * rate / 100);
    if (isInterState) {
        return { igst: taxAmount, cgst: 0, sgst: 0, total: taxAmount };
    }
    const half = Math.round(taxAmount / 2);
    return { igst: 0, cgst: half, sgst: taxAmount - half, total: taxAmount };
}
exports.TDS_RATES_INDIA = {
    professional_fees: { section: "194J", rate: 10, threshold: 30000 },
    contract: { section: "194C", rate: 1, threshold: 30000 },
    rent: { section: "194I", rate: 10, threshold: 240000 },
    commission: { section: "194H", rate: 5, threshold: 15000 },
};
exports.INDIAN_STATES = {
    "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
    "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan",
    "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh",
    "13": "Nagaland", "14": "Manipur", "15": "Mizoram", "16": "Tripura",
    "17": "Meghalaya", "18": "Assam", "19": "West Bengal", "20": "Jharkhand",
    "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
    "27": "Maharashtra", "29": "Karnataka", "30": "Goa", "32": "Kerala",
    "33": "Tamil Nadu", "36": "Telangana", "37": "Andhra Pradesh",
};
function isInterStateGST(sellerStateCode, buyerStateCode) {
    return sellerStateCode !== buyerStateCode;
}
function extractStateFromGSTIN(gstin) {
    return gstin.substring(0, 2);
}
//# sourceMappingURL=india-gst.js.map