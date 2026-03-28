import { lazy } from "react";
import { Route, Navigate } from "react-router-dom";

// Dashboard
const DashboardPage = lazy(() => import("@/pages/dashboard/DashboardPage").then((m) => ({ default: m.DashboardPage })));

// Clients
const ClientListPage = lazy(() => import("@/pages/clients/ClientListPage").then((m) => ({ default: m.ClientListPage })));
const ClientDetailPage = lazy(() => import("@/pages/clients/ClientDetailPage").then((m) => ({ default: m.ClientDetailPage })));
const ClientCreatePage = lazy(() => import("@/pages/clients/ClientCreatePage").then((m) => ({ default: m.ClientCreatePage })));
const ClientEditPage = lazy(() => import("@/pages/clients/ClientEditPage").then((m) => ({ default: m.ClientEditPage })));

// Invoices
const InvoiceListPage = lazy(() => import("@/pages/invoices/InvoiceListPage").then((m) => ({ default: m.InvoiceListPage })));
const InvoiceCreatePage = lazy(() => import("@/pages/invoices/InvoiceCreatePage").then((m) => ({ default: m.InvoiceCreatePage })));
const InvoiceDetailPage = lazy(() => import("@/pages/invoices/InvoiceDetailPage").then((m) => ({ default: m.InvoiceDetailPage })));
const InvoiceEditPage = lazy(() => import("@/pages/invoices/InvoiceEditPage").then((m) => ({ default: m.InvoiceEditPage })));

// Quotes
const QuoteListPage = lazy(() => import("@/pages/quotes/QuoteListPage").then((m) => ({ default: m.QuoteListPage })));
const QuoteCreatePage = lazy(() => import("@/pages/quotes/QuoteCreatePage").then((m) => ({ default: m.QuoteCreatePage })));
const QuoteDetailPage = lazy(() => import("@/pages/quotes/QuoteDetailPage").then((m) => ({ default: m.QuoteDetailPage })));
const QuoteEditPage = lazy(() => import("@/pages/quotes/QuoteEditPage").then((m) => ({ default: m.QuoteEditPage })));

// Payments
const PaymentListPage = lazy(() => import("@/pages/payments/PaymentListPage").then((m) => ({ default: m.PaymentListPage })));
const PaymentRecordPage = lazy(() => import("@/pages/payments/PaymentRecordPage").then((m) => ({ default: m.PaymentRecordPage })));
const PaymentDetailPage = lazy(() => import("@/pages/payments/PaymentDetailPage").then((m) => ({ default: m.PaymentDetailPage })));

// Vendors
const VendorListPage = lazy(() => import("@/pages/vendors/VendorListPage").then((m) => ({ default: m.VendorListPage })));
const VendorCreatePage = lazy(() => import("@/pages/vendors/VendorCreatePage").then((m) => ({ default: m.VendorCreatePage })));
const VendorEditPage = lazy(() => import("@/pages/vendors/VendorEditPage").then((m) => ({ default: m.VendorEditPage })));
const VendorDetailPage = lazy(() => import("@/pages/vendors/VendorDetailPage").then((m) => ({ default: m.VendorDetailPage })));

// Expenses
const ExpenseListPage = lazy(() => import("@/pages/expenses/ExpenseListPage").then((m) => ({ default: m.ExpenseListPage })));
const ExpenseCreatePage = lazy(() => import("@/pages/expenses/ExpenseCreatePage").then((m) => ({ default: m.ExpenseCreatePage })));
const ExpenseDetailPage = lazy(() => import("@/pages/expenses/ExpenseDetailPage").then((m) => ({ default: m.ExpenseDetailPage })));
const ExpenseEditPage = lazy(() => import("@/pages/expenses/ExpenseEditPage").then((m) => ({ default: m.ExpenseEditPage })));

// Products
const ProductListPage = lazy(() => import("@/pages/products/ProductListPage").then((m) => ({ default: m.ProductListPage })));
const ProductCreatePage = lazy(() => import("@/pages/products/ProductCreatePage").then((m) => ({ default: m.ProductCreatePage })));
const ProductDetailPage = lazy(() => import("@/pages/products/ProductDetailPage").then((m) => ({ default: m.ProductDetailPage })));
const ProductEditPage = lazy(() => import("@/pages/products/ProductEditPage").then((m) => ({ default: m.ProductEditPage })));

// Credit Notes
const CreditNoteListPage = lazy(() => import("@/pages/credit-notes/CreditNoteListPage").then((m) => ({ default: m.CreditNoteListPage })));
const CreditNoteCreatePage = lazy(() => import("@/pages/credit-notes/CreditNoteCreatePage").then((m) => ({ default: m.CreditNoteCreatePage })));
const CreditNoteEditPage = lazy(() => import("@/pages/credit-notes/CreditNoteEditPage").then((m) => ({ default: m.CreditNoteEditPage })));
const CreditNoteDetailPage = lazy(() => import("@/pages/credit-notes/CreditNoteDetailPage").then((m) => ({ default: m.CreditNoteDetailPage })));

// Recurring
const RecurringListPage = lazy(() => import("@/pages/recurring/RecurringListPage").then((m) => ({ default: m.RecurringListPage })));
const RecurringCreatePage = lazy(() => import("@/pages/recurring/RecurringCreatePage").then((m) => ({ default: m.RecurringCreatePage })));
const RecurringEditPage = lazy(() => import("@/pages/recurring/RecurringEditPage").then((m) => ({ default: m.RecurringEditPage })));
const RecurringDetailPage = lazy(() => import("@/pages/recurring/RecurringDetailPage").then((m) => ({ default: m.RecurringDetailPage })));

// Subscriptions
const PlanListPage = lazy(() => import("@/pages/subscriptions/PlanListPage").then((m) => ({ default: m.PlanListPage })));
const PlanCreatePage = lazy(() => import("@/pages/subscriptions/PlanCreatePage").then((m) => ({ default: m.PlanCreatePage })));
const PlanEditPage = lazy(() => import("@/pages/subscriptions/PlanEditPage").then((m) => ({ default: m.PlanEditPage })));
const SubscriptionListPage = lazy(() => import("@/pages/subscriptions/SubscriptionListPage").then((m) => ({ default: m.SubscriptionListPage })));
const SubscriptionCreatePage = lazy(() => import("@/pages/subscriptions/SubscriptionCreatePage").then((m) => ({ default: m.SubscriptionCreatePage })));
const SubscriptionDetailPage = lazy(() => import("@/pages/subscriptions/SubscriptionDetailPage").then((m) => ({ default: m.SubscriptionDetailPage })));

// Usage, Coupons, Disputes
const UsageDashboardPage = lazy(() => import("@/pages/usage/UsageDashboardPage").then((m) => ({ default: m.UsageDashboardPage })));
const CouponListPage = lazy(() => import("@/pages/coupons/CouponListPage").then((m) => ({ default: m.CouponListPage })));
const CouponCreatePage = lazy(() => import("@/pages/coupons/CouponCreatePage").then((m) => ({ default: m.CouponCreatePage })));
const CouponEditPage = lazy(() => import("@/pages/coupons/CouponEditPage").then((m) => ({ default: m.CouponEditPage })));
const CouponDetailPage = lazy(() => import("@/pages/coupons/CouponDetailPage").then((m) => ({ default: m.CouponDetailPage })));
const DisputeListPage = lazy(() => import("@/pages/disputes/DisputeListPage").then((m) => ({ default: m.DisputeListPage })));
const DisputeDetailPage = lazy(() => import("@/pages/disputes/DisputeDetailPage").then((m) => ({ default: m.DisputeDetailPage })));

// Other admin pages
const WebhookListPage = lazy(() => import("@/pages/webhooks/WebhookListPage").then((m) => ({ default: m.WebhookListPage })));
const TeamPage = lazy(() => import("@/pages/team/TeamPage").then((m) => ({ default: m.TeamPage })));
const AuditLogPage = lazy(() => import("@/pages/audit/AuditLogPage").then((m) => ({ default: m.AuditLogPage })));
const DunningPage = lazy(() => import("@/pages/dunning/DunningPage").then((m) => ({ default: m.DunningPage })));
const SaaSMetricsPage = lazy(() => import("@/pages/metrics/SaaSMetricsPage").then((m) => ({ default: m.SaaSMetricsPage })));
const ReportsPage = lazy(() => import("@/pages/reports/ReportsPage").then((m) => ({ default: m.ReportsPage })));
const ReportBuilder = lazy(() => import("@/pages/reports/ReportBuilder").then((m) => ({ default: m.ReportBuilder })));
const SavedReports = lazy(() => import("@/pages/reports/SavedReports").then((m) => ({ default: m.SavedReports })));
const SettingsPage = lazy(() => import("@/pages/settings/SettingsPage").then((m) => ({ default: m.SettingsPage })));

export function AdminRoutes() {
  return (
    <>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<DashboardPage />} />

      <Route path="/clients" element={<ClientListPage />} />
      <Route path="/clients/new" element={<ClientCreatePage />} />
      <Route path="/clients/:id/edit" element={<ClientEditPage />} />
      <Route path="/clients/:id" element={<ClientDetailPage />} />

      <Route path="/invoices" element={<InvoiceListPage />} />
      <Route path="/invoices/new" element={<InvoiceCreatePage />} />
      <Route path="/invoices/:id/edit" element={<InvoiceEditPage />} />
      <Route path="/invoices/:id" element={<InvoiceDetailPage />} />

      <Route path="/quotes" element={<QuoteListPage />} />
      <Route path="/quotes/new" element={<QuoteCreatePage />} />
      <Route path="/quotes/:id/edit" element={<QuoteEditPage />} />
      <Route path="/quotes/:id" element={<QuoteDetailPage />} />

      <Route path="/payments" element={<PaymentListPage />} />
      <Route path="/payments/record" element={<PaymentRecordPage />} />
      <Route path="/payments/:id" element={<PaymentDetailPage />} />

      <Route path="/expenses" element={<ExpenseListPage />} />
      <Route path="/expenses/new" element={<ExpenseCreatePage />} />
      <Route path="/expenses/:id/edit" element={<ExpenseEditPage />} />
      <Route path="/expenses/:id" element={<ExpenseDetailPage />} />

      <Route path="/vendors" element={<VendorListPage />} />
      <Route path="/vendors/new" element={<VendorCreatePage />} />
      <Route path="/vendors/:id/edit" element={<VendorEditPage />} />
      <Route path="/vendors/:id" element={<VendorDetailPage />} />

      <Route path="/products" element={<ProductListPage />} />
      <Route path="/products/new" element={<ProductCreatePage />} />
      <Route path="/products/:id/edit" element={<ProductEditPage />} />
      <Route path="/products/:id" element={<ProductDetailPage />} />

      <Route path="/credit-notes" element={<CreditNoteListPage />} />
      <Route path="/credit-notes/new" element={<CreditNoteCreatePage />} />
      <Route path="/credit-notes/:id/edit" element={<CreditNoteEditPage />} />
      <Route path="/credit-notes/:id" element={<CreditNoteDetailPage />} />

      <Route path="/recurring" element={<RecurringListPage />} />
      <Route path="/recurring/new" element={<RecurringCreatePage />} />
      <Route path="/recurring/:id/edit" element={<RecurringEditPage />} />
      <Route path="/recurring/:id" element={<RecurringDetailPage />} />

      <Route path="/subscriptions" element={<SubscriptionListPage />} />
      <Route path="/subscriptions/new" element={<SubscriptionCreatePage />} />
      <Route path="/subscriptions/plans" element={<PlanListPage />} />
      <Route path="/subscriptions/plans/new" element={<PlanCreatePage />} />
      <Route path="/subscriptions/plans/:id/edit" element={<PlanEditPage />} />
      <Route path="/subscriptions/:id" element={<SubscriptionDetailPage />} />

      <Route path="/usage" element={<UsageDashboardPage />} />

      <Route path="/coupons" element={<CouponListPage />} />
      <Route path="/coupons/new" element={<CouponCreatePage />} />
      <Route path="/coupons/:id/edit" element={<CouponEditPage />} />
      <Route path="/coupons/:id" element={<CouponDetailPage />} />

      <Route path="/disputes" element={<DisputeListPage />} />
      <Route path="/disputes/:id" element={<DisputeDetailPage />} />

      <Route path="/webhooks" element={<WebhookListPage />} />
      <Route path="/team" element={<TeamPage />} />
      <Route path="/activity" element={<AuditLogPage />} />
      <Route path="/dunning" element={<DunningPage />} />
      <Route path="/metrics" element={<SaaSMetricsPage />} />
      <Route path="/reports" element={<ReportsPage />} />
      <Route path="/reports/builder" element={<ReportBuilder />} />
      <Route path="/reports/saved" element={<SavedReports />} />
      <Route path="/settings" element={<SettingsPage />} />
    </>
  );
}
