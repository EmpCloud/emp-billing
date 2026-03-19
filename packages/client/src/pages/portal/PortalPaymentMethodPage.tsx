import { CreditCard, Shield, Trash2 } from "lucide-react";
import { Button } from "@/components/common/Button";
import { Spinner } from "@/components/common/Spinner";
import { usePortalPaymentMethod, useRemovePortalPaymentMethod } from "@/api/hooks/portal.hooks";

export function PortalPaymentMethodPage() {
  const { data: res, isLoading } = usePortalPaymentMethod();
  const removeMutation = useRemovePortalPaymentMethod();

  const method = res?.data as {
    hasPaymentMethod: boolean;
    paymentGateway: string | null;
    last4: string | null;
    brand: string | null;
  } | undefined;

  function handleRemove() {
    if (!window.confirm("Remove your saved payment method? Future subscription renewals will require manual payment.")) return;
    removeMutation.mutate();
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Payment Method</h1>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 max-w-lg">
        {method?.hasPaymentMethod ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-brand-50 rounded-xl flex items-center justify-center">
                <CreditCard className="h-6 w-6 text-brand-600" />
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-900 capitalize">
                  {method.brand || "Card"} &bull;&bull;&bull;&bull; {method.last4}
                </p>
                <p className="text-sm text-gray-500 capitalize">
                  via {method.paymentGateway}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2">
              <Shield className="h-4 w-4" />
              <span>This card will be used for automatic subscription renewals</span>
            </div>
            <Button variant="outline" size="sm" onClick={handleRemove} loading={removeMutation.isPending}>
              <Trash2 className="h-4 w-4 mr-1" /> Remove Payment Method
            </Button>
          </div>
        ) : (
          <div className="text-center py-8">
            <CreditCard className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-1">No payment method saved</p>
            <p className="text-sm text-gray-400">
              A payment method will be saved automatically when you make an online payment.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
