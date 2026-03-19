import { useNavigate, useParams } from "react-router-dom";
import { Edit, Trash2, Package, Tag, Hash, Layers, Ruler, IndianRupee, CheckCircle, XCircle, BarChart3, AlertTriangle, Gauge } from "lucide-react";
import { formatMoney, PricingModel } from "@emp-billing/shared";
import type { PricingTier } from "@emp-billing/shared";
import { useProduct, useDeleteProduct, useTaxRates } from "@/api/hooks/product.hooks";
import { Button } from "@/components/common/Button";
import { PageHeader } from "@/components/common/PageHeader";
import { Badge } from "@/components/common/Badge";
import { Spinner } from "@/components/common/Spinner";
import { EmptyState } from "@/components/common/EmptyState";

const PRICING_MODEL_LABELS: Record<string, string> = {
  [PricingModel.FLAT]: "Flat Rate",
  [PricingModel.TIERED]: "Tiered",
  [PricingModel.VOLUME]: "Volume",
  [PricingModel.PER_SEAT]: "Per-Seat",
  [PricingModel.METERED]: "Metered",
};

const PRICING_MODEL_COLORS: Record<string, string> = {
  [PricingModel.FLAT]: "gray",
  [PricingModel.TIERED]: "info",
  [PricingModel.VOLUME]: "purple",
  [PricingModel.PER_SEAT]: "success",
  [PricingModel.METERED]: "warning",
};

export function ProductDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: productData, isLoading } = useProduct(id);
  const deleteProduct = useDeleteProduct();
  const { data: taxRatesData } = useTaxRates();

  const product = productData?.data;
  const taxRates = taxRatesData?.data ?? [];

  const taxRate = product?.taxRateId
    ? taxRates.find((tr) => tr.id === product.taxRateId)
    : undefined;

  function handleDelete() {
    if (!product) return;
    if (window.confirm(`Delete "${product.name}"? This cannot be undone.`)) {
      deleteProduct.mutate(product.id, {
        onSuccess: () => navigate("/products"),
      });
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-6">
        <EmptyState
          title="Product not found"
          description="This product may have been deleted."
        />
      </div>
    );
  }

  const pricingModel = product.pricingModel ?? PricingModel.FLAT;
  const hasTiers = product.pricingTiers && product.pricingTiers.length > 0;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={product.name}
        subtitle={product.sku ? `SKU: ${product.sku}` : undefined}
        breadcrumb={[
          { label: "Products", href: "/products" },
          { label: product.name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              icon={<Edit className="h-4 w-4" />}
              onClick={() => navigate(`/products/${id}/edit`)}
            >
              Edit
            </Button>
            <Button
              variant="danger"
              icon={<Trash2 className="h-4 w-4" />}
              onClick={handleDelete}
              loading={deleteProduct.isPending}
            >
              Delete
            </Button>
          </div>
        }
      />

      {/* Product Details Card */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">
            Product Details
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5 p-6">
          {/* Name */}
          <div className="flex items-start gap-3">
            <Package className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-gray-500">Name</p>
              <p className="text-sm text-gray-900">{product.name}</p>
            </div>
          </div>

          {/* Type */}
          <div className="flex items-start gap-3">
            <Layers className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-gray-500">Type</p>
              <div className="mt-0.5">
                <Badge
                  variant={product.type === "goods" ? "info" : "purple"}
                  size="sm"
                >
                  {product.type === "goods" ? "Goods" : "Service"}
                </Badge>
              </div>
            </div>
          </div>

          {/* SKU */}
          <div className="flex items-start gap-3">
            <Hash className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-gray-500">SKU</p>
              <p className="text-sm text-gray-900 font-mono">
                {product.sku || "-"}
              </p>
            </div>
          </div>

          {/* Unit */}
          <div className="flex items-start gap-3">
            <Ruler className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-gray-500">Unit</p>
              <p className="text-sm text-gray-900">{product.unit || "-"}</p>
            </div>
          </div>

          {/* Rate */}
          <div className="flex items-start gap-3">
            <IndianRupee className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-gray-500">Base Rate</p>
              <p className="text-sm text-gray-900 font-medium">
                {formatMoney(product.rate, "INR")}
              </p>
            </div>
          </div>

          {/* Pricing Model */}
          <div className="flex items-start gap-3">
            <Gauge className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-gray-500">Pricing Model</p>
              <div className="mt-0.5">
                <Badge
                  variant={PRICING_MODEL_COLORS[pricingModel] as any ?? "gray"}
                  size="sm"
                >
                  {PRICING_MODEL_LABELS[pricingModel] ?? pricingModel}
                </Badge>
              </div>
            </div>
          </div>

          {/* Tax Rate */}
          <div className="flex items-start gap-3">
            <Tag className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-gray-500">Tax Rate</p>
              <p className="text-sm text-gray-900">
                {taxRate ? taxRate.name : "None"}
              </p>
            </div>
          </div>

          {/* Active Status */}
          <div className="flex items-start gap-3">
            {product.isActive ? (
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
            )}
            <div>
              <p className="text-xs font-medium text-gray-500">Status</p>
              <div className="mt-0.5">
                <Badge
                  variant={product.isActive ? "success" : "gray"}
                  size="sm"
                >
                  {product.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
          </div>

          {/* HSN Code */}
          {product.hsnCode && (
            <div className="flex items-start gap-3">
              <Hash className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-gray-500">
                  HSN/SAC Code
                </p>
                <p className="text-sm text-gray-900 font-mono">
                  {product.hsnCode}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pricing Tiers Card */}
      {hasTiers && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-800">
              Pricing Tiers
              {pricingModel === PricingModel.TIERED && (
                <span className="ml-2 text-xs font-normal text-gray-500">
                  (each tier is priced independently)
                </span>
              )}
              {pricingModel === PricingModel.VOLUME && (
                <span className="ml-2 text-xs font-normal text-gray-500">
                  (total quantity determines single rate for all units)
                </span>
              )}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="px-6 py-3 font-medium text-gray-500">Tier</th>
                  <th className="px-6 py-3 font-medium text-gray-500">Up To</th>
                  <th className="px-6 py-3 font-medium text-gray-500">Unit Price</th>
                  <th className="px-6 py-3 font-medium text-gray-500">Flat Fee</th>
                </tr>
              </thead>
              <tbody>
                {product.pricingTiers!.map((tier: PricingTier, idx: number) => (
                  <tr key={idx} className="border-b border-gray-50">
                    <td className="px-6 py-3 text-gray-600">Tier {idx + 1}</td>
                    <td className="px-6 py-3 text-gray-900">
                      {tier.upTo !== null ? tier.upTo.toLocaleString() + " units" : "Unlimited"}
                    </td>
                    <td className="px-6 py-3 text-gray-900 font-medium">
                      {formatMoney(tier.unitPrice, "INR")}
                    </td>
                    <td className="px-6 py-3 text-gray-600">
                      {tier.flatFee ? formatMoney(tier.flatFee, "INR") : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Inventory Card */}
      {product.trackInventory && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-800">
              Inventory
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5 p-6">
            {/* Stock on Hand */}
            <div className="flex items-start gap-3">
              <BarChart3 className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-gray-500">Stock on Hand</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className={`text-sm font-semibold ${
                      product.reorderLevel != null && product.stockOnHand != null
                        ? product.stockOnHand <= 0
                          ? "text-red-600"
                          : product.stockOnHand <= product.reorderLevel
                            ? "text-red-600"
                            : product.stockOnHand <= product.reorderLevel * 1.5
                              ? "text-yellow-600"
                              : "text-green-600"
                        : "text-gray-900"
                    }`}
                  >
                    {product.stockOnHand ?? 0}
                  </span>
                  {product.reorderLevel != null &&
                    product.stockOnHand != null &&
                    product.stockOnHand <= product.reorderLevel && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                        <AlertTriangle className="h-3 w-3" />
                        Low Stock
                      </span>
                    )}
                </div>
              </div>
            </div>

            {/* Reorder Level */}
            <div className="flex items-start gap-3">
              <Package className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-gray-500">Reorder Level</p>
                <p className="text-sm text-gray-900 mt-0.5">
                  {product.reorderLevel ?? 0}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Description Card */}
      {product.description && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-2">
            Description
          </h2>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">
            {product.description}
          </p>
        </div>
      )}
    </div>
  );
}
