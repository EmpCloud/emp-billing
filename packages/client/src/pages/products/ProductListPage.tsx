import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Edit2, Trash2, Package, Download, Upload, AlertTriangle } from "lucide-react";
import { formatMoney } from "@emp-billing/shared";
import { useProducts, useDeleteProduct, useExportProductsCSV, useImportProductsCSV } from "@/api/hooks/product.hooks";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Badge } from "@/components/common/Badge";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { Spinner } from "@/components/common/Spinner";

export function ProductListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const params: Record<string, string> = {};
  if (search) params.search = search;

  const { data, isLoading } = useProducts(
    Object.keys(params).length ? params : undefined,
  );
  const deleteProduct = useDeleteProduct();
  const { exportCSV, isExporting } = useExportProductsCSV();
  const importCSV = useImportProductsCSV();

  const products = data?.data ?? [];

  function handleDelete(id: string, name: string) {
    if (window.confirm(`Delete "${name}"? This cannot be undone.`)) {
      deleteProduct.mutate(id);
    }
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    importCSV.mutate(formData);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="p-6">
      <input
        type="file"
        accept=".csv"
        ref={fileInputRef}
        className="hidden"
        onChange={handleImportFile}
      />
      <PageHeader
        title="Products"
        subtitle="Manage your product and service catalog"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              icon={<Download className="h-4 w-4" />}
              onClick={exportCSV}
              loading={isExporting}
            >
              Export
            </Button>
            <Button
              variant="outline"
              icon={<Upload className="h-4 w-4" />}
              onClick={() => fileInputRef.current?.click()}
              loading={importCSV.isPending}
            >
              Import
            </Button>
            <Button
              icon={<Plus className="h-4 w-4" />}
              onClick={() => navigate("/products/new")}
            >
              New Product
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="w-64">
          <Input
            placeholder="Search products..."
            prefix={<Search className="h-4 w-4" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {/* Empty */}
      {!isLoading && products.length === 0 && (
        <EmptyState
          icon={<Package className="h-12 w-12" />}
          title={search ? "No products match your search" : "No products yet"}
          description={
            search
              ? "Try adjusting the search term."
              : "Add your first product or service to get started."
          }
          action={
            search
              ? undefined
              : { label: "New Product", onClick: () => navigate("/products/new") }
          }
        />
      )}

      {/* Table */}
      {!isLoading && products.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  Name
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  SKU
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  Type
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">
                  Rate
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  Unit
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">
                  Stock
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  Active
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {products.map((product) => (
                <tr
                  key={product.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div>
                      <span className="font-medium text-gray-900">
                        {product.name}
                      </span>
                      {product.description && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">
                          {product.description}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                    {product.sku || "-"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={
                        product.type === "goods" ? "info" : "purple"
                      }
                      size="sm"
                    >
                      {product.type === "goods" ? "Goods" : "Service"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatMoney(product.rate, "INR")}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {product.unit || "-"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {product.trackInventory ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <span
                          className={`text-sm font-medium ${
                            product.reorderLevel != null && product.stockOnHand != null
                              ? product.stockOnHand <= product.reorderLevel
                                ? "text-red-600"
                                : product.stockOnHand <= product.reorderLevel * 1.5
                                  ? "text-yellow-600"
                                  : "text-gray-900"
                              : "text-gray-900"
                          }`}
                        >
                          {product.stockOnHand ?? 0}
                        </span>
                        {product.reorderLevel != null &&
                          product.stockOnHand != null &&
                          product.stockOnHand <= product.reorderLevel && (
                            <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                          )}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={product.isActive ? "success" : "gray"}
                      size="sm"
                    >
                      {product.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Edit2 className="h-4 w-4" />}
                        onClick={() => navigate(`/products/${product.id}/edit`)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Trash2 className="h-4 w-4 text-red-500" />}
                        onClick={() => handleDelete(product.id, product.name)}
                        loading={deleteProduct.isPending}
                      >
                        <span className="text-red-600">Delete</span>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
