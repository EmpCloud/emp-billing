export declare const GST_RATES: readonly [0, 5, 12, 18, 28];
export declare const GST_CESS_RATES: Record<number, number[]>;
export declare function computeGST(amount: number, rate: number, isInterState: boolean): {
    igst: number;
    cgst: number;
    sgst: number;
    total: number;
};
export declare const TDS_RATES_INDIA: Record<string, {
    section: string;
    rate: number;
    threshold: number;
}>;
export declare const INDIAN_STATES: Record<string, string>;
export declare function isInterStateGST(sellerStateCode: string, buyerStateCode: string): boolean;
export declare function extractStateFromGSTIN(gstin: string): string;
