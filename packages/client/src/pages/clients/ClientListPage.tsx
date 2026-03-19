import { useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Eye, Trash2, Users, Download, Upload, Tag, X } from "lucide-react";
import { formatMoney } from "@emp-billing/shared";
import { useClients, useDeleteClient, useExportClientsCSV, useImportClientsCSV } from "@/api/hooks/client.hooks";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { Spinner } from "@/components/common/Spinner";

export function ClientListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const queryParams = useMemo(() => {
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (tagFilter) params.tags = tagFilter;
    return Object.keys(params).length > 0 ? params : undefined;
  }, [search, tagFilter]);

  const { data, isLoading } = useClients(queryParams);
  const deleteClient = useDeleteClient();
  const { exportCSV, isExporting } = useExportClientsCSV();
  const importCSV = useImportClientsCSV();

  const clients = data?.data ?? [];

  function handleDelete(id: string, name: string) {
    if (window.confirm(`Delete client "${name}"? This cannot be undone.`)) {
      deleteClient.mutate(id);
    }
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    importCSV.mutate(formData);
    // Reset the input so the same file can be re-selected
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
        title="Clients"
        subtitle="Manage your client accounts"
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
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate("/clients/new")}>
              New Client
            </Button>
          </div>
        }
      />

      {/* Search & Tag Filter */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-64">
          <Input
            placeholder="Search clients…"
            prefix={<Search className="h-4 w-4" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-56 relative">
          <Input
            placeholder="Filter by tag…"
            prefix={<Tag className="h-4 w-4" />}
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
          />
          {tagFilter && (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              onClick={() => setTagFilter("")}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && clients.length === 0 && (
        <EmptyState
          icon={<Users className="h-12 w-12" />}
          title={search ? "No clients match your search" : "No clients yet"}
          description={search ? "Try a different search term." : "Add your first client to get started."}
          action={search ? undefined : { label: "New Client", onClick: () => navigate("/clients/new") }}
        />
      )}

      {/* Table */}
      {!isLoading && clients.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Email</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Tags</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Outstanding</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Total Billed</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {clients.map((client) => (
                <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{client.displayName || client.name}</div>
                    {client.displayName && client.displayName !== client.name && (
                      <div className="text-xs text-gray-400">{client.name}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{client.email}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(client.tags ?? []).map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center bg-brand-50 text-brand-700 rounded-full px-2 py-0.5 text-xs font-medium cursor-pointer hover:bg-brand-100 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setTagFilter(tag);
                          }}
                          title={`Filter by "${tag}"`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={client.outstandingBalance > 0 ? "text-amber-700 font-medium" : "text-gray-500"}>
                      {formatMoney(client.outstandingBalance, client.currency)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {formatMoney(client.totalBilled, client.currency)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Eye className="h-4 w-4" />}
                        onClick={() => navigate(`/clients/${client.id}`)}
                      >
                        View
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Trash2 className="h-4 w-4 text-red-500" />}
                        onClick={() => handleDelete(client.id, client.name)}
                        loading={deleteClient.isPending}
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
