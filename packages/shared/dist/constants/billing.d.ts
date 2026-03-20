export declare const PAYMENT_TERMS: readonly [{
    readonly label: "Due on receipt";
    readonly days: 0;
}, {
    readonly label: "Net 7";
    readonly days: 7;
}, {
    readonly label: "Net 15";
    readonly days: 15;
}, {
    readonly label: "Net 30";
    readonly days: 30;
}, {
    readonly label: "Net 45";
    readonly days: 45;
}, {
    readonly label: "Net 60";
    readonly days: 60;
}, {
    readonly label: "Net 90";
    readonly days: 90;
}];
export declare const CURRENCIES: Record<string, {
    code: string;
    symbol: string;
    name: string;
    decimals: number;
}>;
export declare function formatMoney(amountInSmallestUnit: number, currencyCode: string): string;
export declare function toSmallestUnit(amount: number, currencyCode: string): number;
export declare function fromSmallestUnit(amountInSmallestUnit: number, currencyCode: string): number;
