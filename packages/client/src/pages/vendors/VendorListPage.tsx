import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Eye, Trash2, Building2 } from "lucide-react";
import { useVendors, useDeleteVendor } from "@/api/hooks/vendor.hooks";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Select } from "@/components/common/Input";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { Spinner } from "@/components/common/Spinner";

export function VendorListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");

  const params: Record<string, string | number> = {};
  if (search) params.search = search;
  if (activeFilter !== "all") params.isActive = activeFilter === "active" ? 1 : 0;

  const { data, isLoading } = useVendors(Object.keys(params).length > 0 ? params : undefined);
  const deleteVendor = useDeleteVendor();

  const vendors = data?.data ?? [];

  function handleDelete(id: string, name: string) {
    if (window.confirm(`Delete vendor "${name}"? This will deactivate the vendor.`)) {
      deleteVendor.mutate(id);
    }
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Vendors"
        subtitle="Manage your vendor and supplier accounts"
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate("/vendors/new")}>
            New Vendor
          </Button>
        }
      />

      {/* Filters */}
      <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="max-w-sm w-full">
          <Input
            placeholder="Search vendors..."
            prefix={<Search className="h-4 w-4" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-40">
          <Select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && vendors.length === 0 && (
        <EmptyState
          icon={<Building2 className="h-12 w-12" />}
          title={search ? "No vendors match your search" : "No vendors yet"}
          description={search ? "Try a different search term." : "Add your first vendor to get started."}
          action={search ? undefined : { label: "New Vendor", onClick: () => navigate("/vendors/new") }}
        />
      )}

      {/* Table */}
      {!isLoading && vendors.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Company</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Email</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Phone</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {vendors.map((vendor) => (
                <tr key={vendor.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{vendor.name}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{vendor.company || "\u2014"}</td>
                  <td className="px-4 py-3 text-gray-600">{vendor.email || "\u2014"}</td>
                  <td className="px-4 py-3 text-gray-600">{vendor.phone || "\u2014"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        vendor.isActive
                          ? "inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700"
                          : "inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500"
                      }
                    >
                      {vendor.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Eye className="h-4 w-4" />}
                        onClick={() => navigate(`/vendors/${vendor.id}`)}
                      >
                        View
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Trash2 className="h-4 w-4 text-red-500" />}
                        onClick={() => handleDelete(vendor.id, vendor.name)}
                        loading={deleteVendor.isPending}
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
