import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { PortalLayout } from "@/components/layout/PortalLayout";

import { LoginPage } from "@/pages/auth/LoginPage";
import { RegisterPage } from "@/pages/auth/RegisterPage";
import { DashboardPage } from "@/pages/dashboard/DashboardPage";
import { ClientListPage } from "@/pages/clients/ClientListPage";
import { ClientDetailPage } from "@/pages/clients/ClientDetailPage";
import { ClientCreatePage } from "@/pages/clients/ClientCreatePage";
import { ClientEditPage } from "@/pages/clients/ClientEditPage";
import { InvoiceListPage } from "@/pages/invoices/InvoiceListPage";
import { InvoiceCreatePage } from "@/pages/invoices/InvoiceCreatePage";
import { InvoiceDetailPage } from "@/pages/invoices/InvoiceDetailPage";
import { QuoteListPage } from "@/pages/quotes/QuoteListPage";
import { QuoteCreatePage } from "@/pages/quotes/QuoteCreatePage";
import { QuoteDetailPage } from "@/pages/quotes/QuoteDetailPage";
import { PaymentListPage } from "@/pages/payments/PaymentListPage";
import { PaymentRecordPage } from "@/pages/payments/PaymentRecordPage";
import { PaymentDetailPage } from "@/pages/payments/PaymentDetailPage";
import { VendorListPage } from "@/pages/vendors/VendorListPage";
import { VendorCreatePage } from "@/pages/vendors/VendorCreatePage";
import { VendorEditPage } from "@/pages/vendors/VendorEditPage";
import { VendorDetailPage } from "@/pages/vendors/VendorDetailPage";
import { ExpenseListPage } from "@/pages/expenses/ExpenseListPage";
import { ExpenseCreatePage } from "@/pages/expenses/ExpenseCreatePage";
import { ProductListPage } from "@/pages/products/ProductListPage";
import { ProductCreatePage } from "@/pages/products/ProductCreatePage";
import { ReportsPage } from "@/pages/reports/ReportsPage";
import { SettingsPage } from "@/pages/settings/SettingsPage";
import { CreditNoteListPage } from "@/pages/credit-notes/CreditNoteListPage";
import { CreditNoteCreatePage } from "@/pages/credit-notes/CreditNoteCreatePage";
import { CreditNoteEditPage } from "@/pages/credit-notes/CreditNoteEditPage";
import { CreditNoteDetailPage } from "@/pages/credit-notes/CreditNoteDetailPage";
import { RecurringListPage } from "@/pages/recurring/RecurringListPage";
import { RecurringCreatePage } from "@/pages/recurring/RecurringCreatePage";
import { RecurringEditPage } from "@/pages/recurring/RecurringEditPage";
import { RecurringDetailPage } from "@/pages/recurring/RecurringDetailPage";
import { WebhookListPage } from "@/pages/webhooks/WebhookListPage";
import { TeamPage } from "@/pages/team/TeamPage";
import { AuditLogPage } from "@/pages/audit/AuditLogPage";
import { InvoiceEditPage } from "@/pages/invoices/InvoiceEditPage";
import { QuoteEditPage } from "@/pages/quotes/QuoteEditPage";
import { ExpenseDetailPage } from "@/pages/expenses/ExpenseDetailPage";
import { ExpenseEditPage } from "@/pages/expenses/ExpenseEditPage";
import { ProductDetailPage } from "@/pages/products/ProductDetailPage";
import { ProductEditPage } from "@/pages/products/ProductEditPage";
import { ForgotPasswordPage } from "@/pages/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "@/pages/auth/ResetPasswordPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

import { DunningPage } from "@/pages/dunning/DunningPage";
import { SaaSMetricsPage } from "@/pages/metrics/SaaSMetricsPage";

import { PlanListPage } from "@/pages/subscriptions/PlanListPage";
import { PlanCreatePage } from "@/pages/subscriptions/PlanCreatePage";
import { PlanEditPage } from "@/pages/subscriptions/PlanEditPage";
import { SubscriptionListPage } from "@/pages/subscriptions/SubscriptionListPage";
import { SubscriptionCreatePage } from "@/pages/subscriptions/SubscriptionCreatePage";
import { SubscriptionDetailPage } from "@/pages/subscriptions/SubscriptionDetailPage";

import { UsageDashboardPage } from "@/pages/usage/UsageDashboardPage";
import { CouponListPage } from "@/pages/coupons/CouponListPage";
import { CouponCreatePage } from "@/pages/coupons/CouponCreatePage";
import { CouponEditPage } from "@/pages/coupons/CouponEditPage";
import { CouponDetailPage } from "@/pages/coupons/CouponDetailPage";

import { ErrorBoundary } from "@/components/common/ErrorBoundary";

import { DisputeListPage } from "@/pages/disputes/DisputeListPage";
import { DisputeDetailPage } from "@/pages/disputes/DisputeDetailPage";

import { ReportBuilder } from "@/pages/reports/ReportBuilder";
import { SavedReports } from "@/pages/reports/SavedReports";

import { PortalLoginPage } from "@/pages/portal/PortalLoginPage";
import { PortalDashboard } from "@/pages/portal/PortalDashboard";
import { PortalInvoicesPage } from "@/pages/portal/PortalInvoicesPage";
import { PortalQuotesPage } from "@/pages/portal/PortalQuotesPage";
import { PortalPaymentsPage } from "@/pages/portal/PortalPaymentsPage";
import { PortalCreditNotesPage } from "@/pages/portal/PortalCreditNotesPage";
import { PortalStatementPage } from "@/pages/portal/PortalStatementPage";
import { PortalDisputesPage } from "@/pages/portal/PortalDisputesPage";
import { PortalSubscriptionsPage } from "@/pages/portal/PortalSubscriptionsPage";
import { PortalSubscriptionDetailPage } from "@/pages/portal/PortalSubscriptionDetailPage";
import { PortalPaymentMethodPage } from "@/pages/portal/PortalPaymentMethodPage";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60 * 1000, retry: 1 } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          {/* Auth */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
          </Route>

          {/* Admin / Accountant Dashboard */}
          <Route element={<DashboardLayout />}>
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
          </Route>

          {/* Client Portal */}
          <Route element={<PortalLayout />}>
            <Route path="/portal/login" element={<PortalLoginPage />} />
            <Route path="/portal" element={<PortalDashboard />} />
            <Route path="/portal/invoices" element={<PortalInvoicesPage />} />
            <Route path="/portal/quotes" element={<PortalQuotesPage />} />
            <Route path="/portal/payments" element={<PortalPaymentsPage />} />
            <Route path="/portal/credit-notes" element={<PortalCreditNotesPage />} />
            <Route path="/portal/statements" element={<PortalStatementPage />} />
            <Route path="/portal/disputes" element={<PortalDisputesPage />} />
            <Route path="/portal/subscriptions" element={<PortalSubscriptionsPage />} />
            <Route path="/portal/subscriptions/:id" element={<PortalSubscriptionDetailPage />} />
            <Route path="/portal/payment-method" element={<PortalPaymentMethodPage />} />
          </Route>
          {/* 404 Catch-all */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
