import { z } from "zod";
import { InvoiceStatus, QuoteStatus, PaymentMethod, ExpenseStatus, RecurringFrequency, TaxType, DiscountType, UserRole, DisputeStatus, ScheduledReportType, ScheduledReportFrequency, PricingModel, CouponType, CouponAppliesTo, BillingInterval, SubscriptionStatus } from "../types/index";
export declare const AddressSchema: z.ZodObject<{
    line1: z.ZodString;
    line2: z.ZodOptional<z.ZodString>;
    city: z.ZodString;
    state: z.ZodString;
    postalCode: z.ZodString;
    country: z.ZodString;
}, "strip", z.ZodTypeAny, {
    line1: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    line2?: string | undefined;
}, {
    line1: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    line2?: string | undefined;
}>;
export declare const PaginationSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    sortBy: z.ZodOptional<z.ZodString>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    sortOrder: "asc" | "desc";
    sortBy?: string | undefined;
}, {
    page?: number | undefined;
    limit?: number | undefined;
    sortBy?: string | undefined;
    sortOrder?: "asc" | "desc" | undefined;
}>;
export declare const RegisterSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    firstName: z.ZodString;
    lastName: z.ZodString;
    orgName: z.ZodString;
    country: z.ZodDefault<z.ZodString>;
    currency: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    country: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    orgName: string;
    currency: string;
}, {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    orgName: string;
    country?: string | undefined;
    currency?: string | undefined;
}>;
export declare const LoginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export declare const RefreshTokenSchema: z.ZodObject<{
    refreshToken: z.ZodString;
}, "strip", z.ZodTypeAny, {
    refreshToken: string;
}, {
    refreshToken: string;
}>;
export declare const ForgotPasswordSchema: z.ZodObject<{
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
}, {
    email: string;
}>;
export declare const ResetPasswordSchema: z.ZodObject<{
    token: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    password: string;
    token: string;
}, {
    password: string;
    token: string;
}>;
export declare const ChangePasswordSchema: z.ZodObject<{
    currentPassword: z.ZodString;
    newPassword: z.ZodString;
}, "strip", z.ZodTypeAny, {
    currentPassword: string;
    newPassword: string;
}, {
    currentPassword: string;
    newPassword: string;
}>;
export declare const CreateOrgSchema: z.ZodObject<{
    name: z.ZodString;
    legalName: z.ZodString;
    email: z.ZodString;
    phone: z.ZodOptional<z.ZodString>;
    website: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    address: z.ZodObject<{
        line1: z.ZodString;
        line2: z.ZodOptional<z.ZodString>;
        city: z.ZodString;
        state: z.ZodString;
        postalCode: z.ZodString;
        country: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        line1: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
        line2?: string | undefined;
    }, {
        line1: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
        line2?: string | undefined;
    }>;
    taxId: z.ZodOptional<z.ZodString>;
    pan: z.ZodOptional<z.ZodString>;
    defaultCurrency: z.ZodDefault<z.ZodString>;
    country: z.ZodString;
    fiscalYearStart: z.ZodDefault<z.ZodNumber>;
    invoicePrefix: z.ZodDefault<z.ZodString>;
    quotePrefix: z.ZodDefault<z.ZodString>;
    defaultPaymentTerms: z.ZodDefault<z.ZodNumber>;
    defaultNotes: z.ZodOptional<z.ZodString>;
    defaultTerms: z.ZodOptional<z.ZodString>;
    timezone: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    country: string;
    email: string;
    name: string;
    legalName: string;
    address: {
        line1: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
        line2?: string | undefined;
    };
    defaultCurrency: string;
    fiscalYearStart: number;
    invoicePrefix: string;
    quotePrefix: string;
    defaultPaymentTerms: number;
    timezone: string;
    phone?: string | undefined;
    website?: string | undefined;
    taxId?: string | undefined;
    pan?: string | undefined;
    defaultNotes?: string | undefined;
    defaultTerms?: string | undefined;
}, {
    country: string;
    email: string;
    name: string;
    legalName: string;
    address: {
        line1: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
        line2?: string | undefined;
    };
    phone?: string | undefined;
    website?: string | undefined;
    taxId?: string | undefined;
    pan?: string | undefined;
    defaultCurrency?: string | undefined;
    fiscalYearStart?: number | undefined;
    invoicePrefix?: string | undefined;
    quotePrefix?: string | undefined;
    defaultPaymentTerms?: number | undefined;
    defaultNotes?: string | undefined;
    defaultTerms?: string | undefined;
    timezone?: string | undefined;
}>;
export declare const UpdateOrgSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    legalName: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    website: z.ZodOptional<z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>>;
    address: z.ZodOptional<z.ZodObject<{
        line1: z.ZodString;
        line2: z.ZodOptional<z.ZodString>;
        city: z.ZodString;
        state: z.ZodString;
        postalCode: z.ZodString;
        country: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        line1: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
        line2?: string | undefined;
    }, {
        line1: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
        line2?: string | undefined;
    }>>;
    taxId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    pan: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    defaultCurrency: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    country: z.ZodOptional<z.ZodString>;
    fiscalYearStart: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    invoicePrefix: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    quotePrefix: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    defaultPaymentTerms: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    defaultNotes: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    defaultTerms: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    timezone: z.ZodOptional<z.ZodDefault<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    country?: string | undefined;
    email?: string | undefined;
    name?: string | undefined;
    legalName?: string | undefined;
    phone?: string | undefined;
    website?: string | undefined;
    address?: {
        line1: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
        line2?: string | undefined;
    } | undefined;
    taxId?: string | undefined;
    pan?: string | undefined;
    defaultCurrency?: string | undefined;
    fiscalYearStart?: number | undefined;
    invoicePrefix?: string | undefined;
    quotePrefix?: string | undefined;
    defaultPaymentTerms?: number | undefined;
    defaultNotes?: string | undefined;
    defaultTerms?: string | undefined;
    timezone?: string | undefined;
}, {
    country?: string | undefined;
    email?: string | undefined;
    name?: string | undefined;
    legalName?: string | undefined;
    phone?: string | undefined;
    website?: string | undefined;
    address?: {
        line1: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
        line2?: string | undefined;
    } | undefined;
    taxId?: string | undefined;
    pan?: string | undefined;
    defaultCurrency?: string | undefined;
    fiscalYearStart?: number | undefined;
    invoicePrefix?: string | undefined;
    quotePrefix?: string | undefined;
    defaultPaymentTerms?: number | undefined;
    defaultNotes?: string | undefined;
    defaultTerms?: string | undefined;
    timezone?: string | undefined;
}>;
export declare const ClientContactSchema: z.ZodObject<{
    name: z.ZodString;
    email: z.ZodString;
    phone: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    designation: z.ZodOptional<z.ZodString>;
    isPrimary: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    email: string;
    name: string;
    isPrimary: boolean;
    phone?: string | undefined;
    designation?: string | undefined;
}, {
    email: string;
    name: string;
    phone?: string | undefined;
    designation?: string | undefined;
    isPrimary?: boolean | undefined;
}>;
export declare const CreateClientSchema: z.ZodObject<{
    name: z.ZodEffects<z.ZodString, string, string>;
    displayName: z.ZodString;
    email: z.ZodString;
    phone: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    website: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    taxId: z.ZodOptional<z.ZodString>;
    billingAddress: z.ZodOptional<z.ZodObject<{
        line1: z.ZodString;
        line2: z.ZodOptional<z.ZodString>;
        city: z.ZodString;
        state: z.ZodString;
        postalCode: z.ZodString;
        country: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        line1: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
        line2?: string | undefined;
    }, {
        line1: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
        line2?: string | undefined;
    }>>;
    shippingAddress: z.ZodOptional<z.ZodObject<{
        line1: z.ZodString;
        line2: z.ZodOptional<z.ZodString>;
        city: z.ZodString;
        state: z.ZodString;
        postalCode: z.ZodString;
        country: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        line1: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
        line2?: string | undefined;
    }, {
        line1: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
        line2?: string | undefined;
    }>>;
    contacts: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        email: z.ZodString;
        phone: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
        designation: z.ZodOptional<z.ZodString>;
        isPrimary: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        email: string;
        name: string;
        isPrimary: boolean;
        phone?: string | undefined;
        designation?: string | undefined;
    }, {
        email: string;
        name: string;
        phone?: string | undefined;
        designation?: string | undefined;
        isPrimary?: boolean | undefined;
    }>, "many">>;
    currency: z.ZodDefault<z.ZodString>;
    paymentTerms: z.ZodDefault<z.ZodNumber>;
    notes: z.ZodOptional<z.ZodString>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    portalEnabled: z.ZodDefault<z.ZodBoolean>;
    portalEmail: z.ZodOptional<z.ZodString>;
    customFields: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    email: string;
    currency: string;
    name: string;
    displayName: string;
    contacts: {
        email: string;
        name: string;
        isPrimary: boolean;
        phone?: string | undefined;
        designation?: string | undefined;
    }[];
    paymentTerms: number;
    tags: string[];
    portalEnabled: boolean;
    phone?: string | undefined;
    website?: string | undefined;
    taxId?: string | undefined;
    billingAddress?: {
        line1: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
        line2?: string | undefined;
    } | undefined;
    shippingAddress?: {
        line1: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
        line2?: string | undefined;
    } | undefined;
    notes?: string | undefined;
    portalEmail?: string | undefined;
    customFields?: Record<string, string> | undefined;
}, {
    email: string;
    name: string;
    displayName: string;
    currency?: string | undefined;
    phone?: string | undefined;
    website?: string | undefined;
    taxId?: string | undefined;
    billingAddress?: {
        line1: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
        line2?: string | undefined;
    } | undefined;
    shippingAddress?: {
        line1: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
        line2?: string | undefined;
    } | undefined;
    contacts?: {
        email: string;
        name: string;
        phone?: string | undefined;
        designation?: string | undefined;
        isPrimary?: boolean | undefined;
    }[] | undefined;
    paymentTerms?: number | undefined;
    notes?: string | undefined;
    tags?: string[] | undefined;
    portalEnabled?: boolean | undefined;
    portalEmail?: string | undefined;
    customFields?: Record<string, string> | undefined;
}>;
export declare const UpdateClientSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    displayName: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>>;
    website: z.ZodOptional<z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>>;
    taxId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    billingAddress: z.ZodOptional<z.ZodOptional<z.ZodObject<{
        line1: z.ZodString;
        line2: z.ZodOptional<z.ZodString>;
        city: z.ZodString;
        state: z.ZodString;
        postalCode: z.ZodString;
        country: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        line1: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
        line2?: string | undefined;
    }, {
        line1: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
        line2?: string | undefined;
    }>>>;
    shippingAddress: z.ZodOptional<z.ZodOptional<z.ZodObject<{
        line1: z.ZodString;
        line2: z.ZodOptional<z.ZodString>;
        city: z.ZodString;
        state: z.ZodString;
        postalCode: z.ZodString;
        country: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        line1: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
        line2?: string | undefined;
    }, {
        line1: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
        line2?: string | undefined;
    }>>>;
    contacts: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        email: z.ZodString;
        phone: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
        designation: z.ZodOptional<z.ZodString>;
        isPrimary: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        email: string;
        name: string;
        isPrimary: boolean;
        phone?: string | undefined;
        designation?: string | undefined;
    }, {
        email: string;
        name: string;
        phone?: string | undefined;
        designation?: string | undefined;
        isPrimary?: boolean | undefined;
    }>, "many">>>;
    currency: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    paymentTerms: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    notes: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    tags: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodString, "many">>>;
    portalEnabled: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    portalEmail: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    customFields: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>>;
}, "strip", z.ZodTypeAny, {
    email?: string | undefined;
    currency?: string | undefined;
    name?: string | undefined;
    phone?: string | undefined;
    website?: string | undefined;
    taxId?: string | undefined;
    displayName?: string | undefined;
    billingAddress?: {
        line1: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
        line2?: string | undefined;
    } | undefined;
    shippingAddress?: {
        line1: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
        line2?: string | undefined;
    } | undefined;
    contacts?: {
        email: string;
        name: string;
        isPrimary: boolean;
        phone?: string | undefined;
        designation?: string | undefined;
    }[] | undefined;
    paymentTerms?: number | undefined;
    notes?: string | undefined;
    tags?: string[] | undefined;
    portalEnabled?: boolean | undefined;
    portalEmail?: string | undefined;
    customFields?: Record<string, string> | undefined;
}, {
    email?: string | undefined;
    currency?: string | undefined;
    name?: string | undefined;
    phone?: string | undefined;
    website?: string | undefined;
    taxId?: string | undefined;
    displayName?: string | undefined;
    billingAddress?: {
        line1: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
        line2?: string | undefined;
    } | undefined;
    shippingAddress?: {
        line1: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
        line2?: string | undefined;
    } | undefined;
    contacts?: {
        email: string;
        name: string;
        phone?: string | undefined;
        designation?: string | undefined;
        isPrimary?: boolean | undefined;
    }[] | undefined;
    paymentTerms?: number | undefined;
    notes?: string | undefined;
    tags?: string[] | undefined;
    portalEnabled?: boolean | undefined;
    portalEmail?: string | undefined;
    customFields?: Record<string, string> | undefined;
}>;
export declare const ClientFilterSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    sortBy: z.ZodOptional<z.ZodString>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
} & {
    search: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodString>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    sortOrder: "asc" | "desc";
    sortBy?: string | undefined;
    tags?: string | undefined;
    search?: string | undefined;
    isActive?: boolean | undefined;
}, {
    page?: number | undefined;
    limit?: number | undefined;
    sortBy?: string | undefined;
    sortOrder?: "asc" | "desc" | undefined;
    tags?: string | undefined;
    search?: string | undefined;
    isActive?: boolean | undefined;
}>;
export declare const PricingTierSchema: z.ZodObject<{
    upTo: z.ZodNullable<z.ZodNumber>;
    unitPrice: z.ZodNumber;
    flatFee: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    upTo: number | null;
    unitPrice: number;
    flatFee?: number | undefined;
}, {
    upTo: number | null;
    unitPrice: number;
    flatFee?: number | undefined;
}>;
export declare const CreateProductSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    sku: z.ZodOptional<z.ZodString>;
    type: z.ZodEnum<["goods", "service"]>;
    unit: z.ZodOptional<z.ZodString>;
    rate: z.ZodNumber;
    pricingModel: z.ZodDefault<z.ZodNativeEnum<typeof PricingModel>>;
    pricingTiers: z.ZodOptional<z.ZodArray<z.ZodObject<{
        upTo: z.ZodNullable<z.ZodNumber>;
        unitPrice: z.ZodNumber;
        flatFee: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        upTo: number | null;
        unitPrice: number;
        flatFee?: number | undefined;
    }, {
        upTo: number | null;
        unitPrice: number;
        flatFee?: number | undefined;
    }>, "many">>;
    taxRateId: z.ZodOptional<z.ZodString>;
    hsnCode: z.ZodOptional<z.ZodString>;
    trackInventory: z.ZodDefault<z.ZodBoolean>;
    stockOnHand: z.ZodOptional<z.ZodNumber>;
    reorderLevel: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    type: "goods" | "service";
    name: string;
    rate: number;
    pricingModel: PricingModel;
    trackInventory: boolean;
    description?: string | undefined;
    sku?: string | undefined;
    unit?: string | undefined;
    pricingTiers?: {
        upTo: number | null;
        unitPrice: number;
        flatFee?: number | undefined;
    }[] | undefined;
    taxRateId?: string | undefined;
    hsnCode?: string | undefined;
    stockOnHand?: number | undefined;
    reorderLevel?: number | undefined;
}, {
    type: "goods" | "service";
    name: string;
    rate: number;
    description?: string | undefined;
    sku?: string | undefined;
    unit?: string | undefined;
    pricingModel?: PricingModel | undefined;
    pricingTiers?: {
        upTo: number | null;
        unitPrice: number;
        flatFee?: number | undefined;
    }[] | undefined;
    taxRateId?: string | undefined;
    hsnCode?: string | undefined;
    trackInventory?: boolean | undefined;
    stockOnHand?: number | undefined;
    reorderLevel?: number | undefined;
}>;
export declare const UpdateProductSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    sku: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    type: z.ZodOptional<z.ZodEnum<["goods", "service"]>>;
    unit: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    rate: z.ZodOptional<z.ZodNumber>;
    pricingModel: z.ZodOptional<z.ZodDefault<z.ZodNativeEnum<typeof PricingModel>>>;
    pricingTiers: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodObject<{
        upTo: z.ZodNullable<z.ZodNumber>;
        unitPrice: z.ZodNumber;
        flatFee: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        upTo: number | null;
        unitPrice: number;
        flatFee?: number | undefined;
    }, {
        upTo: number | null;
        unitPrice: number;
        flatFee?: number | undefined;
    }>, "many">>>;
    taxRateId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    hsnCode: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    trackInventory: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    stockOnHand: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    reorderLevel: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    type?: "goods" | "service" | undefined;
    name?: string | undefined;
    description?: string | undefined;
    sku?: string | undefined;
    unit?: string | undefined;
    rate?: number | undefined;
    pricingModel?: PricingModel | undefined;
    pricingTiers?: {
        upTo: number | null;
        unitPrice: number;
        flatFee?: number | undefined;
    }[] | undefined;
    taxRateId?: string | undefined;
    hsnCode?: string | undefined;
    trackInventory?: boolean | undefined;
    stockOnHand?: number | undefined;
    reorderLevel?: number | undefined;
}, {
    type?: "goods" | "service" | undefined;
    name?: string | undefined;
    description?: string | undefined;
    sku?: string | undefined;
    unit?: string | undefined;
    rate?: number | undefined;
    pricingModel?: PricingModel | undefined;
    pricingTiers?: {
        upTo: number | null;
        unitPrice: number;
        flatFee?: number | undefined;
    }[] | undefined;
    taxRateId?: string | undefined;
    hsnCode?: string | undefined;
    trackInventory?: boolean | undefined;
    stockOnHand?: number | undefined;
    reorderLevel?: number | undefined;
}>;
export declare const CreateUsageRecordSchema: z.ZodObject<{
    productId: z.ZodString;
    clientId: z.ZodString;
    subscriptionId: z.ZodOptional<z.ZodString>;
    quantity: z.ZodNumber;
    description: z.ZodOptional<z.ZodString>;
    recordedAt: z.ZodOptional<z.ZodDate>;
    periodStart: z.ZodDate;
    periodEnd: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    productId: string;
    clientId: string;
    quantity: number;
    periodStart: Date;
    periodEnd: Date;
    description?: string | undefined;
    subscriptionId?: string | undefined;
    recordedAt?: Date | undefined;
}, {
    productId: string;
    clientId: string;
    quantity: number;
    periodStart: Date;
    periodEnd: Date;
    description?: string | undefined;
    subscriptionId?: string | undefined;
    recordedAt?: Date | undefined;
}>;
export declare const UsageFilterSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    sortBy: z.ZodOptional<z.ZodString>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
} & {
    productId: z.ZodOptional<z.ZodString>;
    clientId: z.ZodOptional<z.ZodString>;
    periodStart: z.ZodOptional<z.ZodDate>;
    periodEnd: z.ZodOptional<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    sortOrder: "asc" | "desc";
    sortBy?: string | undefined;
    productId?: string | undefined;
    clientId?: string | undefined;
    periodStart?: Date | undefined;
    periodEnd?: Date | undefined;
}, {
    page?: number | undefined;
    limit?: number | undefined;
    sortBy?: string | undefined;
    sortOrder?: "asc" | "desc" | undefined;
    productId?: string | undefined;
    clientId?: string | undefined;
    periodStart?: Date | undefined;
    periodEnd?: Date | undefined;
}>;
export declare const UsageSummarySchema: z.ZodObject<{
    productId: z.ZodString;
    clientId: z.ZodString;
    periodStart: z.ZodDate;
    periodEnd: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    productId: string;
    clientId: string;
    periodStart: Date;
    periodEnd: Date;
}, {
    productId: string;
    clientId: string;
    periodStart: Date;
    periodEnd: Date;
}>;
export declare const TaxComponentSchema: z.ZodObject<{
    name: z.ZodString;
    rate: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    name: string;
    rate: number;
}, {
    name: string;
    rate: number;
}>;
export declare const CreateTaxRateSchema: z.ZodObject<{
    name: z.ZodString;
    type: z.ZodNativeEnum<typeof TaxType>;
    rate: z.ZodNumber;
    isCompound: z.ZodDefault<z.ZodBoolean>;
    components: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        rate: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        name: string;
        rate: number;
    }, {
        name: string;
        rate: number;
    }>, "many">>;
    isDefault: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    type: TaxType;
    name: string;
    rate: number;
    isCompound: boolean;
    isDefault: boolean;
    components?: {
        name: string;
        rate: number;
    }[] | undefined;
}, {
    type: TaxType;
    name: string;
    rate: number;
    isCompound?: boolean | undefined;
    components?: {
        name: string;
        rate: number;
    }[] | undefined;
    isDefault?: boolean | undefined;
}>;
export declare const UpdateTaxRateSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodNativeEnum<typeof TaxType>>;
    rate: z.ZodOptional<z.ZodNumber>;
    isCompound: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    components: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        rate: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        name: string;
        rate: number;
    }, {
        name: string;
        rate: number;
    }>, "many">>>;
    isDefault: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    type?: TaxType | undefined;
    name?: string | undefined;
    rate?: number | undefined;
    isCompound?: boolean | undefined;
    components?: {
        name: string;
        rate: number;
    }[] | undefined;
    isDefault?: boolean | undefined;
}, {
    type?: TaxType | undefined;
    name?: string | undefined;
    rate?: number | undefined;
    isCompound?: boolean | undefined;
    components?: {
        name: string;
        rate: number;
    }[] | undefined;
    isDefault?: boolean | undefined;
}>;
export declare const InvoiceItemSchema: z.ZodObject<{
    productId: z.ZodOptional<z.ZodString>;
    name: z.ZodEffects<z.ZodString, string, string>;
    description: z.ZodOptional<z.ZodString>;
    hsnCode: z.ZodOptional<z.ZodString>;
    quantity: z.ZodNumber;
    unit: z.ZodOptional<z.ZodString>;
    rate: z.ZodNumber;
    discountType: z.ZodOptional<z.ZodNativeEnum<typeof DiscountType>>;
    discountValue: z.ZodOptional<z.ZodNumber>;
    taxRateId: z.ZodOptional<z.ZodString>;
    sortOrder: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    sortOrder: number;
    name: string;
    rate: number;
    quantity: number;
    description?: string | undefined;
    unit?: string | undefined;
    taxRateId?: string | undefined;
    hsnCode?: string | undefined;
    productId?: string | undefined;
    discountType?: DiscountType | undefined;
    discountValue?: number | undefined;
}, {
    name: string;
    rate: number;
    quantity: number;
    sortOrder?: number | undefined;
    description?: string | undefined;
    unit?: string | undefined;
    taxRateId?: string | undefined;
    hsnCode?: string | undefined;
    productId?: string | undefined;
    discountType?: DiscountType | undefined;
    discountValue?: number | undefined;
}>;
export declare const CreateInvoiceSchema: z.ZodObject<{
    clientId: z.ZodString;
    referenceNumber: z.ZodOptional<z.ZodString>;
    issueDate: z.ZodDate;
    dueDate: z.ZodDate;
    currency: z.ZodDefault<z.ZodString>;
    exchangeRate: z.ZodDefault<z.ZodNumber>;
    items: z.ZodArray<z.ZodObject<{
        productId: z.ZodOptional<z.ZodString>;
        name: z.ZodEffects<z.ZodString, string, string>;
        description: z.ZodOptional<z.ZodString>;
        hsnCode: z.ZodOptional<z.ZodString>;
        quantity: z.ZodNumber;
        unit: z.ZodOptional<z.ZodString>;
        rate: z.ZodNumber;
        discountType: z.ZodOptional<z.ZodNativeEnum<typeof DiscountType>>;
        discountValue: z.ZodOptional<z.ZodNumber>;
        taxRateId: z.ZodOptional<z.ZodString>;
        sortOrder: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        sortOrder: number;
        name: string;
        rate: number;
        quantity: number;
        description?: string | undefined;
        unit?: string | undefined;
        taxRateId?: string | undefined;
        hsnCode?: string | undefined;
        productId?: string | undefined;
        discountType?: DiscountType | undefined;
        discountValue?: number | undefined;
    }, {
        name: string;
        rate: number;
        quantity: number;
        sortOrder?: number | undefined;
        description?: string | undefined;
        unit?: string | undefined;
        taxRateId?: string | undefined;
        hsnCode?: string | undefined;
        productId?: string | undefined;
        discountType?: DiscountType | undefined;
        discountValue?: number | undefined;
    }>, "many">;
    discountType: z.ZodOptional<z.ZodNativeEnum<typeof DiscountType>>;
    discountValue: z.ZodOptional<z.ZodNumber>;
    notes: z.ZodOptional<z.ZodString>;
    terms: z.ZodOptional<z.ZodString>;
    customFields: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    autoSend: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    autoApplyCredits: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    tdsRate: z.ZodOptional<z.ZodNumber>;
    tdsSection: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    currency: string;
    clientId: string;
    issueDate: Date;
    dueDate: Date;
    exchangeRate: number;
    items: {
        sortOrder: number;
        name: string;
        rate: number;
        quantity: number;
        description?: string | undefined;
        unit?: string | undefined;
        taxRateId?: string | undefined;
        hsnCode?: string | undefined;
        productId?: string | undefined;
        discountType?: DiscountType | undefined;
        discountValue?: number | undefined;
    }[];
    autoSend: boolean;
    autoApplyCredits: boolean;
    notes?: string | undefined;
    customFields?: Record<string, string> | undefined;
    discountType?: DiscountType | undefined;
    discountValue?: number | undefined;
    referenceNumber?: string | undefined;
    terms?: string | undefined;
    tdsRate?: number | undefined;
    tdsSection?: string | undefined;
}, {
    clientId: string;
    issueDate: Date;
    dueDate: Date;
    items: {
        name: string;
        rate: number;
        quantity: number;
        sortOrder?: number | undefined;
        description?: string | undefined;
        unit?: string | undefined;
        taxRateId?: string | undefined;
        hsnCode?: string | undefined;
        productId?: string | undefined;
        discountType?: DiscountType | undefined;
        discountValue?: number | undefined;
    }[];
    currency?: string | undefined;
    notes?: string | undefined;
    customFields?: Record<string, string> | undefined;
    discountType?: DiscountType | undefined;
    discountValue?: number | undefined;
    referenceNumber?: string | undefined;
    exchangeRate?: number | undefined;
    terms?: string | undefined;
    autoSend?: boolean | undefined;
    autoApplyCredits?: boolean | undefined;
    tdsRate?: number | undefined;
    tdsSection?: string | undefined;
}>;
export declare const UpdateInvoiceSchema: z.ZodObject<{
    clientId: z.ZodOptional<z.ZodString>;
    referenceNumber: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    issueDate: z.ZodOptional<z.ZodDate>;
    dueDate: z.ZodOptional<z.ZodDate>;
    currency: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    exchangeRate: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    items: z.ZodOptional<z.ZodArray<z.ZodObject<{
        productId: z.ZodOptional<z.ZodString>;
        name: z.ZodEffects<z.ZodString, string, string>;
        description: z.ZodOptional<z.ZodString>;
        hsnCode: z.ZodOptional<z.ZodString>;
        quantity: z.ZodNumber;
        unit: z.ZodOptional<z.ZodString>;
        rate: z.ZodNumber;
        discountType: z.ZodOptional<z.ZodNativeEnum<typeof DiscountType>>;
        discountValue: z.ZodOptional<z.ZodNumber>;
        taxRateId: z.ZodOptional<z.ZodString>;
        sortOrder: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        sortOrder: number;
        name: string;
        rate: number;
        quantity: number;
        description?: string | undefined;
        unit?: string | undefined;
        taxRateId?: string | undefined;
        hsnCode?: string | undefined;
        productId?: string | undefined;
        discountType?: DiscountType | undefined;
        discountValue?: number | undefined;
    }, {
        name: string;
        rate: number;
        quantity: number;
        sortOrder?: number | undefined;
        description?: string | undefined;
        unit?: string | undefined;
        taxRateId?: string | undefined;
        hsnCode?: string | undefined;
        productId?: string | undefined;
        discountType?: DiscountType | undefined;
        discountValue?: number | undefined;
    }>, "many">>;
    discountType: z.ZodOptional<z.ZodOptional<z.ZodNativeEnum<typeof DiscountType>>>;
    discountValue: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    notes: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    terms: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    customFields: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>>;
    autoSend: z.ZodOptional<z.ZodDefault<z.ZodOptional<z.ZodBoolean>>>;
    autoApplyCredits: z.ZodOptional<z.ZodDefault<z.ZodOptional<z.ZodBoolean>>>;
    tdsRate: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    tdsSection: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    currency?: string | undefined;
    notes?: string | undefined;
    customFields?: Record<string, string> | undefined;
    clientId?: string | undefined;
    discountType?: DiscountType | undefined;
    discountValue?: number | undefined;
    referenceNumber?: string | undefined;
    issueDate?: Date | undefined;
    dueDate?: Date | undefined;
    exchangeRate?: number | undefined;
    items?: {
        sortOrder: number;
        name: string;
        rate: number;
        quantity: number;
        description?: string | undefined;
        unit?: string | undefined;
        taxRateId?: string | undefined;
        hsnCode?: string | undefined;
        productId?: string | undefined;
        discountType?: DiscountType | undefined;
        discountValue?: number | undefined;
    }[] | undefined;
    terms?: string | undefined;
    autoSend?: boolean | undefined;
    autoApplyCredits?: boolean | undefined;
    tdsRate?: number | undefined;
    tdsSection?: string | undefined;
}, {
    currency?: string | undefined;
    notes?: string | undefined;
    customFields?: Record<string, string> | undefined;
    clientId?: string | undefined;
    discountType?: DiscountType | undefined;
    discountValue?: number | undefined;
    referenceNumber?: string | undefined;
    issueDate?: Date | undefined;
    dueDate?: Date | undefined;
    exchangeRate?: number | undefined;
    items?: {
        name: string;
        rate: number;
        quantity: number;
        sortOrder?: number | undefined;
        description?: string | undefined;
        unit?: string | undefined;
        taxRateId?: string | undefined;
        hsnCode?: string | undefined;
        productId?: string | undefined;
        discountType?: DiscountType | undefined;
        discountValue?: number | undefined;
    }[] | undefined;
    terms?: string | undefined;
    autoSend?: boolean | undefined;
    autoApplyCredits?: boolean | undefined;
    tdsRate?: number | undefined;
    tdsSection?: string | undefined;
}>;
export declare const InvoiceFilterSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    sortBy: z.ZodOptional<z.ZodString>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
} & {
    status: z.ZodOptional<z.ZodNativeEnum<typeof InvoiceStatus>>;
    clientId: z.ZodOptional<z.ZodString>;
    from: z.ZodOptional<z.ZodDate>;
    to: z.ZodOptional<z.ZodDate>;
    search: z.ZodOptional<z.ZodString>;
    overdue: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    sortOrder: "asc" | "desc";
    overdue?: boolean | undefined;
    status?: InvoiceStatus | undefined;
    sortBy?: string | undefined;
    search?: string | undefined;
    clientId?: string | undefined;
    from?: Date | undefined;
    to?: Date | undefined;
}, {
    overdue?: boolean | undefined;
    status?: InvoiceStatus | undefined;
    page?: number | undefined;
    limit?: number | undefined;
    sortBy?: string | undefined;
    sortOrder?: "asc" | "desc" | undefined;
    search?: string | undefined;
    clientId?: string | undefined;
    from?: Date | undefined;
    to?: Date | undefined;
}>;
export declare const BulkInvoiceActionSchema: z.ZodObject<{
    ids: z.ZodArray<z.ZodString, "many">;
    action: z.ZodEnum<["send", "markSent", "delete", "downloadPdf"]>;
}, "strip", z.ZodTypeAny, {
    ids: string[];
    action: "send" | "markSent" | "delete" | "downloadPdf";
}, {
    ids: string[];
    action: "send" | "markSent" | "delete" | "downloadPdf";
}>;
export declare const RecordPaymentSchema: z.ZodObject<{
    amount: z.ZodNumber;
    date: z.ZodDate;
    method: z.ZodNativeEnum<typeof PaymentMethod>;
    reference: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    date: Date;
    amount: number;
    method: PaymentMethod;
    notes?: string | undefined;
    reference?: string | undefined;
}, {
    date: Date;
    amount: number;
    method: PaymentMethod;
    notes?: string | undefined;
    reference?: string | undefined;
}>;
export declare const CreateQuoteSchema: z.ZodObject<{
    clientId: z.ZodString;
    issueDate: z.ZodDate;
    expiryDate: z.ZodDate;
    currency: z.ZodDefault<z.ZodString>;
    items: z.ZodArray<z.ZodObject<{
        productId: z.ZodOptional<z.ZodString>;
        name: z.ZodEffects<z.ZodString, string, string>;
        description: z.ZodOptional<z.ZodString>;
        hsnCode: z.ZodOptional<z.ZodString>;
        quantity: z.ZodNumber;
        unit: z.ZodOptional<z.ZodString>;
        rate: z.ZodNumber;
        discountType: z.ZodOptional<z.ZodNativeEnum<typeof DiscountType>>;
        discountValue: z.ZodOptional<z.ZodNumber>;
        taxRateId: z.ZodOptional<z.ZodString>;
        sortOrder: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        sortOrder: number;
        name: string;
        rate: number;
        quantity: number;
        description?: string | undefined;
        unit?: string | undefined;
        taxRateId?: string | undefined;
        hsnCode?: string | undefined;
        productId?: string | undefined;
        discountType?: DiscountType | undefined;
        discountValue?: number | undefined;
    }, {
        name: string;
        rate: number;
        quantity: number;
        sortOrder?: number | undefined;
        description?: string | undefined;
        unit?: string | undefined;
        taxRateId?: string | undefined;
        hsnCode?: string | undefined;
        productId?: string | undefined;
        discountType?: DiscountType | undefined;
        discountValue?: number | undefined;
    }>, "many">;
    discountType: z.ZodOptional<z.ZodNativeEnum<typeof DiscountType>>;
    discountValue: z.ZodOptional<z.ZodNumber>;
    notes: z.ZodOptional<z.ZodString>;
    terms: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    currency: string;
    clientId: string;
    issueDate: Date;
    items: {
        sortOrder: number;
        name: string;
        rate: number;
        quantity: number;
        description?: string | undefined;
        unit?: string | undefined;
        taxRateId?: string | undefined;
        hsnCode?: string | undefined;
        productId?: string | undefined;
        discountType?: DiscountType | undefined;
        discountValue?: number | undefined;
    }[];
    expiryDate: Date;
    notes?: string | undefined;
    discountType?: DiscountType | undefined;
    discountValue?: number | undefined;
    terms?: string | undefined;
}, {
    clientId: string;
    issueDate: Date;
    items: {
        name: string;
        rate: number;
        quantity: number;
        sortOrder?: number | undefined;
        description?: string | undefined;
        unit?: string | undefined;
        taxRateId?: string | undefined;
        hsnCode?: string | undefined;
        productId?: string | undefined;
        discountType?: DiscountType | undefined;
        discountValue?: number | undefined;
    }[];
    expiryDate: Date;
    currency?: string | undefined;
    notes?: string | undefined;
    discountType?: DiscountType | undefined;
    discountValue?: number | undefined;
    terms?: string | undefined;
}>;
export declare const UpdateQuoteSchema: z.ZodObject<{
    clientId: z.ZodOptional<z.ZodString>;
    issueDate: z.ZodOptional<z.ZodDate>;
    expiryDate: z.ZodOptional<z.ZodDate>;
    currency: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    items: z.ZodOptional<z.ZodArray<z.ZodObject<{
        productId: z.ZodOptional<z.ZodString>;
        name: z.ZodEffects<z.ZodString, string, string>;
        description: z.ZodOptional<z.ZodString>;
        hsnCode: z.ZodOptional<z.ZodString>;
        quantity: z.ZodNumber;
        unit: z.ZodOptional<z.ZodString>;
        rate: z.ZodNumber;
        discountType: z.ZodOptional<z.ZodNativeEnum<typeof DiscountType>>;
        discountValue: z.ZodOptional<z.ZodNumber>;
        taxRateId: z.ZodOptional<z.ZodString>;
        sortOrder: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        sortOrder: number;
        name: string;
        rate: number;
        quantity: number;
        description?: string | undefined;
        unit?: string | undefined;
        taxRateId?: string | undefined;
        hsnCode?: string | undefined;
        productId?: string | undefined;
        discountType?: DiscountType | undefined;
        discountValue?: number | undefined;
    }, {
        name: string;
        rate: number;
        quantity: number;
        sortOrder?: number | undefined;
        description?: string | undefined;
        unit?: string | undefined;
        taxRateId?: string | undefined;
        hsnCode?: string | undefined;
        productId?: string | undefined;
        discountType?: DiscountType | undefined;
        discountValue?: number | undefined;
    }>, "many">>;
    discountType: z.ZodOptional<z.ZodOptional<z.ZodNativeEnum<typeof DiscountType>>>;
    discountValue: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    notes: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    terms: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    currency?: string | undefined;
    notes?: string | undefined;
    clientId?: string | undefined;
    discountType?: DiscountType | undefined;
    discountValue?: number | undefined;
    issueDate?: Date | undefined;
    items?: {
        sortOrder: number;
        name: string;
        rate: number;
        quantity: number;
        description?: string | undefined;
        unit?: string | undefined;
        taxRateId?: string | undefined;
        hsnCode?: string | undefined;
        productId?: string | undefined;
        discountType?: DiscountType | undefined;
        discountValue?: number | undefined;
    }[] | undefined;
    terms?: string | undefined;
    expiryDate?: Date | undefined;
}, {
    currency?: string | undefined;
    notes?: string | undefined;
    clientId?: string | undefined;
    discountType?: DiscountType | undefined;
    discountValue?: number | undefined;
    issueDate?: Date | undefined;
    items?: {
        name: string;
        rate: number;
        quantity: number;
        sortOrder?: number | undefined;
        description?: string | undefined;
        unit?: string | undefined;
        taxRateId?: string | undefined;
        hsnCode?: string | undefined;
        productId?: string | undefined;
        discountType?: DiscountType | undefined;
        discountValue?: number | undefined;
    }[] | undefined;
    terms?: string | undefined;
    expiryDate?: Date | undefined;
}>;
export declare const QuoteFilterSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    sortBy: z.ZodOptional<z.ZodString>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
} & {
    status: z.ZodOptional<z.ZodNativeEnum<typeof QuoteStatus>>;
    clientId: z.ZodOptional<z.ZodString>;
    from: z.ZodOptional<z.ZodDate>;
    to: z.ZodOptional<z.ZodDate>;
    search: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    sortOrder: "asc" | "desc";
    status?: QuoteStatus | undefined;
    sortBy?: string | undefined;
    search?: string | undefined;
    clientId?: string | undefined;
    from?: Date | undefined;
    to?: Date | undefined;
}, {
    status?: QuoteStatus | undefined;
    page?: number | undefined;
    limit?: number | undefined;
    sortBy?: string | undefined;
    sortOrder?: "asc" | "desc" | undefined;
    search?: string | undefined;
    clientId?: string | undefined;
    from?: Date | undefined;
    to?: Date | undefined;
}>;
export declare const CreatePaymentSchema: z.ZodObject<{
    clientId: z.ZodString;
    invoiceId: z.ZodOptional<z.ZodString>;
    date: z.ZodDate;
    amount: z.ZodNumber;
    method: z.ZodNativeEnum<typeof PaymentMethod>;
    reference: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    date: Date;
    clientId: string;
    amount: number;
    method: PaymentMethod;
    notes?: string | undefined;
    reference?: string | undefined;
    invoiceId?: string | undefined;
}, {
    date: Date;
    clientId: string;
    amount: number;
    method: PaymentMethod;
    notes?: string | undefined;
    reference?: string | undefined;
    invoiceId?: string | undefined;
}>;
export declare const PaymentFilterSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    sortBy: z.ZodOptional<z.ZodString>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
} & {
    clientId: z.ZodOptional<z.ZodString>;
    invoiceId: z.ZodOptional<z.ZodString>;
    method: z.ZodOptional<z.ZodNativeEnum<typeof PaymentMethod>>;
    from: z.ZodOptional<z.ZodDate>;
    to: z.ZodOptional<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    sortOrder: "asc" | "desc";
    sortBy?: string | undefined;
    clientId?: string | undefined;
    from?: Date | undefined;
    to?: Date | undefined;
    method?: PaymentMethod | undefined;
    invoiceId?: string | undefined;
}, {
    page?: number | undefined;
    limit?: number | undefined;
    sortBy?: string | undefined;
    sortOrder?: "asc" | "desc" | undefined;
    clientId?: string | undefined;
    from?: Date | undefined;
    to?: Date | undefined;
    method?: PaymentMethod | undefined;
    invoiceId?: string | undefined;
}>;
export declare const RefundSchema: z.ZodObject<{
    amount: z.ZodNumber;
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    amount: number;
    reason?: string | undefined;
}, {
    amount: number;
    reason?: string | undefined;
}>;
export declare const CreateCreditNoteSchema: z.ZodObject<{
    clientId: z.ZodString;
    date: z.ZodDate;
    items: z.ZodArray<z.ZodObject<{
        productId: z.ZodOptional<z.ZodString>;
        name: z.ZodEffects<z.ZodString, string, string>;
        description: z.ZodOptional<z.ZodString>;
        hsnCode: z.ZodOptional<z.ZodString>;
        quantity: z.ZodNumber;
        unit: z.ZodOptional<z.ZodString>;
        rate: z.ZodNumber;
        discountType: z.ZodOptional<z.ZodNativeEnum<typeof DiscountType>>;
        discountValue: z.ZodOptional<z.ZodNumber>;
        taxRateId: z.ZodOptional<z.ZodString>;
        sortOrder: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        sortOrder: number;
        name: string;
        rate: number;
        quantity: number;
        description?: string | undefined;
        unit?: string | undefined;
        taxRateId?: string | undefined;
        hsnCode?: string | undefined;
        productId?: string | undefined;
        discountType?: DiscountType | undefined;
        discountValue?: number | undefined;
    }, {
        name: string;
        rate: number;
        quantity: number;
        sortOrder?: number | undefined;
        description?: string | undefined;
        unit?: string | undefined;
        taxRateId?: string | undefined;
        hsnCode?: string | undefined;
        productId?: string | undefined;
        discountType?: DiscountType | undefined;
        discountValue?: number | undefined;
    }>, "many">;
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    date: Date;
    clientId: string;
    items: {
        sortOrder: number;
        name: string;
        rate: number;
        quantity: number;
        description?: string | undefined;
        unit?: string | undefined;
        taxRateId?: string | undefined;
        hsnCode?: string | undefined;
        productId?: string | undefined;
        discountType?: DiscountType | undefined;
        discountValue?: number | undefined;
    }[];
    reason?: string | undefined;
}, {
    date: Date;
    clientId: string;
    items: {
        name: string;
        rate: number;
        quantity: number;
        sortOrder?: number | undefined;
        description?: string | undefined;
        unit?: string | undefined;
        taxRateId?: string | undefined;
        hsnCode?: string | undefined;
        productId?: string | undefined;
        discountType?: DiscountType | undefined;
        discountValue?: number | undefined;
    }[];
    reason?: string | undefined;
}>;
export declare const ApplyCreditNoteSchema: z.ZodObject<{
    invoiceId: z.ZodString;
    amount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    amount: number;
    invoiceId: string;
}, {
    amount: number;
    invoiceId: string;
}>;
export declare const CreateVendorSchema: z.ZodObject<{
    name: z.ZodString;
    email: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    phone: z.ZodOptional<z.ZodString>;
    company: z.ZodOptional<z.ZodString>;
    addressLine1: z.ZodOptional<z.ZodString>;
    addressLine2: z.ZodOptional<z.ZodString>;
    city: z.ZodOptional<z.ZodString>;
    state: z.ZodOptional<z.ZodString>;
    postalCode: z.ZodOptional<z.ZodString>;
    country: z.ZodOptional<z.ZodString>;
    taxId: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    city?: string | undefined;
    state?: string | undefined;
    postalCode?: string | undefined;
    country?: string | undefined;
    email?: string | undefined;
    phone?: string | undefined;
    taxId?: string | undefined;
    notes?: string | undefined;
    company?: string | undefined;
    addressLine1?: string | undefined;
    addressLine2?: string | undefined;
}, {
    name: string;
    city?: string | undefined;
    state?: string | undefined;
    postalCode?: string | undefined;
    country?: string | undefined;
    email?: string | undefined;
    phone?: string | undefined;
    taxId?: string | undefined;
    notes?: string | undefined;
    company?: string | undefined;
    addressLine1?: string | undefined;
    addressLine2?: string | undefined;
}>;
export declare const UpdateVendorSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>>;
    phone: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    company: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    addressLine1: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    addressLine2: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    city: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    state: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    postalCode: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    country: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    taxId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    notes: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    city?: string | undefined;
    state?: string | undefined;
    postalCode?: string | undefined;
    country?: string | undefined;
    email?: string | undefined;
    name?: string | undefined;
    phone?: string | undefined;
    taxId?: string | undefined;
    notes?: string | undefined;
    company?: string | undefined;
    addressLine1?: string | undefined;
    addressLine2?: string | undefined;
}, {
    city?: string | undefined;
    state?: string | undefined;
    postalCode?: string | undefined;
    country?: string | undefined;
    email?: string | undefined;
    name?: string | undefined;
    phone?: string | undefined;
    taxId?: string | undefined;
    notes?: string | undefined;
    company?: string | undefined;
    addressLine1?: string | undefined;
    addressLine2?: string | undefined;
}>;
export declare const VendorFilterSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    sortBy: z.ZodOptional<z.ZodString>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
} & {
    search: z.ZodOptional<z.ZodString>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    sortOrder: "asc" | "desc";
    sortBy?: string | undefined;
    search?: string | undefined;
    isActive?: boolean | undefined;
}, {
    page?: number | undefined;
    limit?: number | undefined;
    sortBy?: string | undefined;
    sortOrder?: "asc" | "desc" | undefined;
    search?: string | undefined;
    isActive?: boolean | undefined;
}>;
export declare const CreateExpenseCategorySchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    description?: string | undefined;
}, {
    name: string;
    description?: string | undefined;
}>;
export declare const CreateExpenseSchema: z.ZodObject<{
    categoryId: z.ZodString;
    vendorName: z.ZodOptional<z.ZodString>;
    date: z.ZodDate;
    amount: z.ZodNumber;
    currency: z.ZodDefault<z.ZodString>;
    taxAmount: z.ZodDefault<z.ZodNumber>;
    description: z.ZodString;
    isBillable: z.ZodDefault<z.ZodBoolean>;
    clientId: z.ZodOptional<z.ZodString>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    distance: z.ZodOptional<z.ZodNumber>;
    mileageRate: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    currency: string;
    date: Date;
    tags: string[];
    description: string;
    amount: number;
    categoryId: string;
    taxAmount: number;
    isBillable: boolean;
    clientId?: string | undefined;
    vendorName?: string | undefined;
    distance?: number | undefined;
    mileageRate?: number | undefined;
}, {
    date: Date;
    description: string;
    amount: number;
    categoryId: string;
    currency?: string | undefined;
    tags?: string[] | undefined;
    clientId?: string | undefined;
    vendorName?: string | undefined;
    taxAmount?: number | undefined;
    isBillable?: boolean | undefined;
    distance?: number | undefined;
    mileageRate?: number | undefined;
}>;
export declare const UpdateExpenseSchema: z.ZodObject<{
    categoryId: z.ZodOptional<z.ZodString>;
    vendorName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    date: z.ZodOptional<z.ZodDate>;
    amount: z.ZodOptional<z.ZodNumber>;
    currency: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    taxAmount: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    description: z.ZodOptional<z.ZodString>;
    isBillable: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    clientId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    tags: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodString, "many">>>;
    distance: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    mileageRate: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    currency?: string | undefined;
    date?: Date | undefined;
    tags?: string[] | undefined;
    description?: string | undefined;
    clientId?: string | undefined;
    amount?: number | undefined;
    categoryId?: string | undefined;
    vendorName?: string | undefined;
    taxAmount?: number | undefined;
    isBillable?: boolean | undefined;
    distance?: number | undefined;
    mileageRate?: number | undefined;
}, {
    currency?: string | undefined;
    date?: Date | undefined;
    tags?: string[] | undefined;
    description?: string | undefined;
    clientId?: string | undefined;
    amount?: number | undefined;
    categoryId?: string | undefined;
    vendorName?: string | undefined;
    taxAmount?: number | undefined;
    isBillable?: boolean | undefined;
    distance?: number | undefined;
    mileageRate?: number | undefined;
}>;
export declare const ExpenseFilterSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    sortBy: z.ZodOptional<z.ZodString>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
} & {
    categoryId: z.ZodOptional<z.ZodString>;
    clientId: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodNativeEnum<typeof ExpenseStatus>>;
    isBillable: z.ZodOptional<z.ZodBoolean>;
    from: z.ZodOptional<z.ZodDate>;
    to: z.ZodOptional<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    sortOrder: "asc" | "desc";
    status?: ExpenseStatus | undefined;
    sortBy?: string | undefined;
    clientId?: string | undefined;
    from?: Date | undefined;
    to?: Date | undefined;
    categoryId?: string | undefined;
    isBillable?: boolean | undefined;
}, {
    status?: ExpenseStatus | undefined;
    page?: number | undefined;
    limit?: number | undefined;
    sortBy?: string | undefined;
    sortOrder?: "asc" | "desc" | undefined;
    clientId?: string | undefined;
    from?: Date | undefined;
    to?: Date | undefined;
    categoryId?: string | undefined;
    isBillable?: boolean | undefined;
}>;
export declare const CreateRecurringProfileSchema: z.ZodObject<{
    clientId: z.ZodString;
    type: z.ZodEnum<["invoice", "expense"]>;
    frequency: z.ZodNativeEnum<typeof RecurringFrequency>;
    customDays: z.ZodOptional<z.ZodNumber>;
    startDate: z.ZodDate;
    endDate: z.ZodOptional<z.ZodDate>;
    maxOccurrences: z.ZodOptional<z.ZodNumber>;
    autoSend: z.ZodDefault<z.ZodBoolean>;
    autoCharge: z.ZodDefault<z.ZodBoolean>;
    templateData: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    type: "invoice" | "expense";
    clientId: string;
    autoSend: boolean;
    frequency: RecurringFrequency;
    startDate: Date;
    autoCharge: boolean;
    templateData: Record<string, unknown>;
    customDays?: number | undefined;
    endDate?: Date | undefined;
    maxOccurrences?: number | undefined;
}, {
    type: "invoice" | "expense";
    clientId: string;
    frequency: RecurringFrequency;
    startDate: Date;
    templateData: Record<string, unknown>;
    autoSend?: boolean | undefined;
    customDays?: number | undefined;
    endDate?: Date | undefined;
    maxOccurrences?: number | undefined;
    autoCharge?: boolean | undefined;
}>;
export declare const UpdateRecurringProfileSchema: z.ZodObject<{
    clientId: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodEnum<["invoice", "expense"]>>;
    frequency: z.ZodOptional<z.ZodNativeEnum<typeof RecurringFrequency>>;
    customDays: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    startDate: z.ZodOptional<z.ZodDate>;
    endDate: z.ZodOptional<z.ZodOptional<z.ZodDate>>;
    maxOccurrences: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    autoSend: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    autoCharge: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    templateData: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    type?: "invoice" | "expense" | undefined;
    clientId?: string | undefined;
    autoSend?: boolean | undefined;
    frequency?: RecurringFrequency | undefined;
    customDays?: number | undefined;
    startDate?: Date | undefined;
    endDate?: Date | undefined;
    maxOccurrences?: number | undefined;
    autoCharge?: boolean | undefined;
    templateData?: Record<string, unknown> | undefined;
}, {
    type?: "invoice" | "expense" | undefined;
    clientId?: string | undefined;
    autoSend?: boolean | undefined;
    frequency?: RecurringFrequency | undefined;
    customDays?: number | undefined;
    startDate?: Date | undefined;
    endDate?: Date | undefined;
    maxOccurrences?: number | undefined;
    autoCharge?: boolean | undefined;
    templateData?: Record<string, unknown> | undefined;
}>;
export declare const CreateWebhookSchema: z.ZodObject<{
    url: z.ZodString;
    events: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    url: string;
    events: string[];
}, {
    url: string;
    events: string[];
}>;
export declare const UpdateWebhookSchema: z.ZodObject<{
    url: z.ZodOptional<z.ZodString>;
    events: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    url?: string | undefined;
    events?: string[] | undefined;
}, {
    url?: string | undefined;
    events?: string[] | undefined;
}>;
export declare const UpdateSettingsSchema: z.ZodObject<{
    invoicePrefix: z.ZodOptional<z.ZodString>;
    quotePrefix: z.ZodOptional<z.ZodString>;
    defaultPaymentTerms: z.ZodOptional<z.ZodNumber>;
    defaultNotes: z.ZodOptional<z.ZodString>;
    defaultTerms: z.ZodOptional<z.ZodString>;
    defaultCurrency: z.ZodOptional<z.ZodString>;
    brandColors: z.ZodOptional<z.ZodObject<{
        primary: z.ZodString;
        accent: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        primary: string;
        accent: string;
    }, {
        primary: string;
        accent: string;
    }>>;
    logo: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    defaultCurrency?: string | undefined;
    invoicePrefix?: string | undefined;
    quotePrefix?: string | undefined;
    defaultPaymentTerms?: number | undefined;
    defaultNotes?: string | undefined;
    defaultTerms?: string | undefined;
    brandColors?: {
        primary: string;
        accent: string;
    } | undefined;
    logo?: string | undefined;
}, {
    defaultCurrency?: string | undefined;
    invoicePrefix?: string | undefined;
    quotePrefix?: string | undefined;
    defaultPaymentTerms?: number | undefined;
    defaultNotes?: string | undefined;
    defaultTerms?: string | undefined;
    brandColors?: {
        primary: string;
        accent: string;
    } | undefined;
    logo?: string | undefined;
}>;
export declare const InviteUserSchema: z.ZodObject<{
    email: z.ZodString;
    firstName: z.ZodString;
    lastName: z.ZodString;
    role: z.ZodNativeEnum<typeof UserRole>;
}, "strip", z.ZodTypeAny, {
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
}, {
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
}>;
export declare const UpdateUserRoleSchema: z.ZodObject<{
    role: z.ZodNativeEnum<typeof UserRole>;
}, "strip", z.ZodTypeAny, {
    role: UserRole;
}, {
    role: UserRole;
}>;
export declare const ReportFilterSchema: z.ZodObject<{
    from: z.ZodDate;
    to: z.ZodDate;
    clientId: z.ZodOptional<z.ZodString>;
    currency: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    from: Date;
    to: Date;
    currency?: string | undefined;
    clientId?: string | undefined;
}, {
    from: Date;
    to: Date;
    currency?: string | undefined;
    clientId?: string | undefined;
}>;
export declare const CreateDisputeSchema: z.ZodObject<{
    invoiceId: z.ZodOptional<z.ZodString>;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
    invoiceId?: string | undefined;
}, {
    reason: string;
    invoiceId?: string | undefined;
}>;
export declare const UpdateDisputeSchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodNativeEnum<typeof DisputeStatus>>;
    resolution: z.ZodOptional<z.ZodString>;
    adminNotes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status?: DisputeStatus | undefined;
    resolution?: string | undefined;
    adminNotes?: string | undefined;
}, {
    status?: DisputeStatus | undefined;
    resolution?: string | undefined;
    adminNotes?: string | undefined;
}>;
export declare const DisputeFilterSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    sortBy: z.ZodOptional<z.ZodString>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
} & {
    status: z.ZodOptional<z.ZodNativeEnum<typeof DisputeStatus>>;
    clientId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    sortOrder: "asc" | "desc";
    status?: DisputeStatus | undefined;
    sortBy?: string | undefined;
    clientId?: string | undefined;
}, {
    status?: DisputeStatus | undefined;
    page?: number | undefined;
    limit?: number | undefined;
    sortBy?: string | undefined;
    sortOrder?: "asc" | "desc" | undefined;
    clientId?: string | undefined;
}>;
export declare const CreateScheduledReportSchema: z.ZodObject<{
    reportType: z.ZodNativeEnum<typeof ScheduledReportType>;
    frequency: z.ZodNativeEnum<typeof ScheduledReportFrequency>;
    recipientEmail: z.ZodString;
    isActive: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    isActive: boolean;
    frequency: ScheduledReportFrequency;
    reportType: ScheduledReportType;
    recipientEmail: string;
}, {
    frequency: ScheduledReportFrequency;
    reportType: ScheduledReportType;
    recipientEmail: string;
    isActive?: boolean | undefined;
}>;
export declare const UpdateScheduledReportSchema: z.ZodObject<{
    reportType: z.ZodOptional<z.ZodNativeEnum<typeof ScheduledReportType>>;
    frequency: z.ZodOptional<z.ZodNativeEnum<typeof ScheduledReportFrequency>>;
    recipientEmail: z.ZodOptional<z.ZodString>;
    isActive: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    isActive?: boolean | undefined;
    frequency?: ScheduledReportFrequency | undefined;
    reportType?: ScheduledReportType | undefined;
    recipientEmail?: string | undefined;
}, {
    isActive?: boolean | undefined;
    frequency?: ScheduledReportFrequency | undefined;
    reportType?: ScheduledReportType | undefined;
    recipientEmail?: string | undefined;
}>;
export declare const CreateCouponSchema: z.ZodObject<{
    code: z.ZodString;
    name: z.ZodString;
    type: z.ZodNativeEnum<typeof CouponType>;
    value: z.ZodNumber;
    currency: z.ZodOptional<z.ZodString>;
    appliesTo: z.ZodDefault<z.ZodNativeEnum<typeof CouponAppliesTo>>;
    productId: z.ZodOptional<z.ZodString>;
    maxRedemptions: z.ZodOptional<z.ZodNumber>;
    maxRedemptionsPerClient: z.ZodOptional<z.ZodNumber>;
    minAmount: z.ZodDefault<z.ZodNumber>;
    validFrom: z.ZodDate;
    validUntil: z.ZodOptional<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    value: number;
    code: string;
    type: CouponType;
    name: string;
    appliesTo: CouponAppliesTo;
    minAmount: number;
    validFrom: Date;
    currency?: string | undefined;
    productId?: string | undefined;
    maxRedemptions?: number | undefined;
    maxRedemptionsPerClient?: number | undefined;
    validUntil?: Date | undefined;
}, {
    value: number;
    code: string;
    type: CouponType;
    name: string;
    validFrom: Date;
    currency?: string | undefined;
    productId?: string | undefined;
    appliesTo?: CouponAppliesTo | undefined;
    maxRedemptions?: number | undefined;
    maxRedemptionsPerClient?: number | undefined;
    minAmount?: number | undefined;
    validUntil?: Date | undefined;
}>;
export declare const UpdateCouponSchema: z.ZodObject<{
    code: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodNativeEnum<typeof CouponType>>;
    value: z.ZodOptional<z.ZodNumber>;
    currency: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    appliesTo: z.ZodOptional<z.ZodDefault<z.ZodNativeEnum<typeof CouponAppliesTo>>>;
    productId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    minAmount: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    validFrom: z.ZodOptional<z.ZodDate>;
    validUntil: z.ZodOptional<z.ZodOptional<z.ZodDate>>;
} & {
    maxRedemptions: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    maxRedemptionsPerClient: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    value?: number | undefined;
    code?: string | undefined;
    type?: CouponType | undefined;
    currency?: string | undefined;
    name?: string | undefined;
    productId?: string | undefined;
    appliesTo?: CouponAppliesTo | undefined;
    maxRedemptions?: number | null | undefined;
    maxRedemptionsPerClient?: number | null | undefined;
    minAmount?: number | undefined;
    validFrom?: Date | undefined;
    validUntil?: Date | undefined;
}, {
    value?: number | undefined;
    code?: string | undefined;
    type?: CouponType | undefined;
    currency?: string | undefined;
    name?: string | undefined;
    productId?: string | undefined;
    appliesTo?: CouponAppliesTo | undefined;
    maxRedemptions?: number | null | undefined;
    maxRedemptionsPerClient?: number | null | undefined;
    minAmount?: number | undefined;
    validFrom?: Date | undefined;
    validUntil?: Date | undefined;
}>;
export declare const ApplyCouponSchema: z.ZodObject<{
    code: z.ZodString;
    invoiceId: z.ZodString;
    clientId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
    clientId: string;
    invoiceId: string;
}, {
    code: string;
    clientId: string;
    invoiceId: string;
}>;
export declare const ValidateCouponSchema: z.ZodObject<{
    code: z.ZodString;
    amount: z.ZodOptional<z.ZodNumber>;
    clientId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    code: string;
    clientId?: string | undefined;
    amount?: number | undefined;
}, {
    code: string;
    clientId?: string | undefined;
    amount?: number | undefined;
}>;
export declare const CouponFilterSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    sortBy: z.ZodOptional<z.ZodString>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
} & {
    search: z.ZodOptional<z.ZodString>;
    isActive: z.ZodOptional<z.ZodBoolean>;
    appliesTo: z.ZodOptional<z.ZodNativeEnum<typeof CouponAppliesTo>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    sortOrder: "asc" | "desc";
    sortBy?: string | undefined;
    search?: string | undefined;
    isActive?: boolean | undefined;
    appliesTo?: CouponAppliesTo | undefined;
}, {
    page?: number | undefined;
    limit?: number | undefined;
    sortBy?: string | undefined;
    sortOrder?: "asc" | "desc" | undefined;
    search?: string | undefined;
    isActive?: boolean | undefined;
    appliesTo?: CouponAppliesTo | undefined;
}>;
export declare const CreatePlanSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    billingInterval: z.ZodNativeEnum<typeof BillingInterval>;
    billingIntervalDays: z.ZodOptional<z.ZodNumber>;
    trialPeriodDays: z.ZodDefault<z.ZodNumber>;
    price: z.ZodNumber;
    setupFee: z.ZodDefault<z.ZodNumber>;
    currency: z.ZodDefault<z.ZodString>;
    features: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    sortOrder: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    sortOrder: number;
    currency: string;
    name: string;
    billingInterval: BillingInterval;
    trialPeriodDays: number;
    price: number;
    setupFee: number;
    features: string[];
    description?: string | undefined;
    billingIntervalDays?: number | undefined;
}, {
    name: string;
    billingInterval: BillingInterval;
    price: number;
    sortOrder?: number | undefined;
    currency?: string | undefined;
    description?: string | undefined;
    billingIntervalDays?: number | undefined;
    trialPeriodDays?: number | undefined;
    setupFee?: number | undefined;
    features?: string[] | undefined;
}>;
export declare const UpdatePlanSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    billingInterval: z.ZodOptional<z.ZodNativeEnum<typeof BillingInterval>>;
    billingIntervalDays: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    trialPeriodDays: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    price: z.ZodOptional<z.ZodNumber>;
    setupFee: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    currency: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    features: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodString, "many">>>;
    sortOrder: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    sortOrder?: number | undefined;
    currency?: string | undefined;
    name?: string | undefined;
    description?: string | undefined;
    billingInterval?: BillingInterval | undefined;
    billingIntervalDays?: number | undefined;
    trialPeriodDays?: number | undefined;
    price?: number | undefined;
    setupFee?: number | undefined;
    features?: string[] | undefined;
}, {
    sortOrder?: number | undefined;
    currency?: string | undefined;
    name?: string | undefined;
    description?: string | undefined;
    billingInterval?: BillingInterval | undefined;
    billingIntervalDays?: number | undefined;
    trialPeriodDays?: number | undefined;
    price?: number | undefined;
    setupFee?: number | undefined;
    features?: string[] | undefined;
}>;
export declare const CreateSubscriptionSchema: z.ZodObject<{
    clientId: z.ZodString;
    planId: z.ZodString;
    quantity: z.ZodDefault<z.ZodNumber>;
    autoRenew: z.ZodDefault<z.ZodBoolean>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    clientId: string;
    quantity: number;
    planId: string;
    autoRenew: boolean;
    metadata?: Record<string, unknown> | undefined;
}, {
    clientId: string;
    planId: string;
    quantity?: number | undefined;
    autoRenew?: boolean | undefined;
    metadata?: Record<string, unknown> | undefined;
}>;
export declare const ChangeSubscriptionPlanSchema: z.ZodObject<{
    newPlanId: z.ZodString;
    prorate: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    newPlanId: string;
    prorate: boolean;
}, {
    newPlanId: string;
    prorate?: boolean | undefined;
}>;
export declare const CancelSubscriptionSchema: z.ZodObject<{
    reason: z.ZodOptional<z.ZodString>;
    cancelImmediately: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    cancelImmediately: boolean;
    reason?: string | undefined;
}, {
    reason?: string | undefined;
    cancelImmediately?: boolean | undefined;
}>;
export declare const SubscriptionFilterSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    sortBy: z.ZodOptional<z.ZodString>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
} & {
    status: z.ZodOptional<z.ZodNativeEnum<typeof SubscriptionStatus>>;
    clientId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    sortOrder: "asc" | "desc";
    status?: SubscriptionStatus | undefined;
    sortBy?: string | undefined;
    clientId?: string | undefined;
}, {
    status?: SubscriptionStatus | undefined;
    page?: number | undefined;
    limit?: number | undefined;
    sortBy?: string | undefined;
    sortOrder?: "asc" | "desc" | undefined;
    clientId?: string | undefined;
}>;
