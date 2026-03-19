import { useState, useMemo, useCallback } from "react";
import {
  FileText,
  Play,
  Pencil,
  Trash2,
  BookmarkCheck,
  Clock,
  TrendingUp,
  DollarSign,
  Receipt,
  BarChart3,
  Percent,
  Wrench,
  Search,
} from "lucide-react";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Modal } from "@/components/common/Modal";
import { EmptyState } from "@/components/common/EmptyState";

// ---------------------------------------------------------------------------
// Types (mirrored from ReportBuilder)
// ---------------------------------------------------------------------------

type ReportType =
  | "revenue"
  | "receivables"
  | "tax"
  | "expenses"
  | "aging"
  | "pnl"
  | "custom";

interface ReportFilterValues {
  dateFrom: string;
  dateTo: string;
  clientId: string;
  statuses: string[];
  currency: string;
  category: string;
  groupBy: string;
}

interface SavedReportConfig {
  name: string;
  reportType: ReportType;
  filters: ReportFilterValues;
  visibleColumns: string[];
}

// ---------------------------------------------------------------------------
// Local storage helpers
// ---------------------------------------------------------------------------

const SAVED_REPORTS_KEY = "emp_billing_saved_reports";

function loadSavedReports(): SavedReportConfig[] {
  try {
    const raw = localStorage.getItem(SAVED_REPORTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistSavedReports(reports: SavedReportConfig[]) {
  localStorage.setItem(SAVED_REPORTS_KEY, JSON.stringify(reports));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const REPORT_TYPE_META: Record<
  ReportType,
  { label: string; icon: React.ReactNode; color: string }
> = {
  revenue: {
    label: "Revenue",
    icon: <TrendingUp className="h-4 w-4" />,
    color: "text-green-600 bg-green-50",
  },
  receivables: {
    label: "Receivables",
    icon: <DollarSign className="h-4 w-4" />,
    color: "text-blue-600 bg-blue-50",
  },
  tax: {
    label: "Tax",
    icon: <Percent className="h-4 w-4" />,
    color: "text-amber-600 bg-amber-50",
  },
  expenses: {
    label: "Expenses",
    icon: <Receipt className="h-4 w-4" />,
    color: "text-red-600 bg-red-50",
  },
  aging: {
    label: "Aging",
    icon: <Clock className="h-4 w-4" />,
    color: "text-purple-600 bg-purple-50",
  },
  pnl: {
    label: "P&L",
    icon: <BarChart3 className="h-4 w-4" />,
    color: "text-indigo-600 bg-indigo-50",
  },
  custom: {
    label: "Custom",
    icon: <Wrench className="h-4 w-4" />,
    color: "text-gray-600 bg-gray-100",
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SavedReports() {
  const navigate = useNavigate();
  const [reports, setReports] = useState<SavedReportConfig[]>(loadSavedReports);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<SavedReportConfig | null>(null);
  const [editName, setEditName] = useState("");

  // Filtered list
  const filteredReports = useMemo(() => {
    if (!searchQuery.trim()) return reports;
    const q = searchQuery.toLowerCase();
    return reports.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.reportType.toLowerCase().includes(q),
    );
  }, [reports, searchQuery]);

  // Quick-run: navigate to report builder with the saved config loaded
  const handleRun = useCallback(
    (report: SavedReportConfig) => {
      // Store the config temporarily so ReportBuilder can pick it up
      sessionStorage.setItem(
        "emp_billing_run_report",
        JSON.stringify(report),
      );
      navigate("/reports/builder");
    },
    [navigate],
  );

  // Edit report name
  const handleEditOpen = (report: SavedReportConfig) => {
    setEditTarget(report);
    setEditName(report.name);
  };

  const handleEditSave = () => {
    if (!editTarget || !editName.trim()) {
      toast.error("Report name cannot be empty");
      return;
    }
    const updated = reports.map((r) =>
      r.name === editTarget.name ? { ...r, name: editName.trim() } : r,
    );
    setReports(updated);
    persistSavedReports(updated);
    setEditTarget(null);
    setEditName("");
    toast.success("Report renamed");
  };

  // Delete report
  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    const updated = reports.filter((r) => r.name !== deleteTarget);
    setReports(updated);
    persistSavedReports(updated);
    setDeleteTarget(null);
    toast.success("Report deleted");
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Saved Reports"
        subtitle="View and manage your saved custom report configurations"
        breadcrumb={[
          { label: "Reports", href: "/reports" },
          { label: "Saved Reports" },
        ]}
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<FileText className="h-4 w-4" />}
            onClick={() => navigate("/reports/builder")}
          >
            New Report
          </Button>
        }
      />

      {/* Search */}
      {reports.length > 0 && (
        <div className="mb-5 max-w-sm">
          <Input
            placeholder="Search saved reports..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            prefix={<Search className="h-4 w-4" />}
          />
        </div>
      )}

      {/* Report list */}
      {reports.length === 0 ? (
        <EmptyState
          icon={<BookmarkCheck className="h-12 w-12" />}
          title="No saved reports"
          description="Build a custom report in the Report Builder and save it for quick access later."
          action={{
            label: "Open Report Builder",
            onClick: () => navigate("/reports/builder"),
          }}
        />
      ) : filteredReports.length === 0 ? (
        <EmptyState
          icon={<Search className="h-12 w-12" />}
          title="No matching reports"
          description="No saved reports match your search query."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredReports.map((report) => {
            const meta = REPORT_TYPE_META[report.reportType];
            const filterCount =
              (report.filters.clientId ? 1 : 0) +
              report.filters.statuses.length +
              (report.filters.currency ? 1 : 0) +
              (report.filters.category ? 1 : 0) +
              (report.filters.groupBy ? 1 : 0);

            return (
              <div
                key={report.name}
                className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg ${meta.color}`}
                    >
                      {meta.icon}
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">
                        {report.name}
                      </h3>
                      <p className="text-xs text-gray-500">{meta.label} Report</p>
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-1.5 mb-4">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Clock className="h-3 w-3" />
                    <span>
                      {dayjs(report.filters.dateFrom).format("MMM D, YYYY")} -{" "}
                      {dayjs(report.filters.dateTo).format("MMM D, YYYY")}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>{report.visibleColumns.length} columns</span>
                    {filterCount > 0 && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-700 font-medium">
                        {filterCount} filter{filterCount > 1 ? "s" : ""}
                      </span>
                    )}
                    {report.filters.groupBy && (
                      <span className="text-gray-400">
                        Grouped by {report.filters.groupBy}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 pt-3 border-t border-gray-100">
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Play className="h-3.5 w-3.5" />}
                    onClick={() => handleRun(report)}
                    className="flex-1"
                  >
                    Run
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Pencil className="h-3.5 w-3.5" />}
                    onClick={() => handleEditOpen(report)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Trash2 className="h-3.5 w-3.5 text-red-500" />}
                    onClick={() => setDeleteTarget(report.name)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit name modal */}
      <Modal
        open={editTarget !== null}
        onClose={() => setEditTarget(null)}
        title="Rename Report"
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditTarget(null)}
            >
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleEditSave}>
              Save
            </Button>
          </>
        }
      >
        <Input
          label="Report Name"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          required
        />
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete Report"
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Are you sure you want to delete the report{" "}
          <span className="font-semibold text-gray-900">"{deleteTarget}"</span>?
          This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
