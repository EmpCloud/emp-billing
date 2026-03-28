import { Route } from "react-router-dom";

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

export function PortalRoutes() {
  return (
    <>
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
    </>
  );
}
