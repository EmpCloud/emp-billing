import { useState, useMemo } from "react";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  X,
} from "lucide-react";
import { clsx } from "clsx";
import { Button } from "@/components/common/Button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReportColumn {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  /** Format cell value for display */
  format?: (value: unknown, row: Record<string, unknown>) => string;
  /** Whether this column can be sorted (default true) */
  sortable?: boolean;
  /** Whether to include in summary row (sum) */
  summable?: boolean;
  /** Default visibility */
  defaultVisible?: boolean;
}

interface ReportTableProps {
  columns: ReportColumn[];
  data: Record<string, unknown>[];
  /** Unique row key field */
  rowKey?: string;
  /** Page size options */
  pageSizeOptions?: number[];
  /** Show summary/totals row */
  showSummary?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Empty message */
  emptyMessage?: string;
}

type SortDirection = "asc" | "desc" | null;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReportTable({
  columns,
  data,
  rowKey = "id",
  pageSizeOptions = [10, 25, 50, 100],
  showSummary = true,
  loading = false,
  emptyMessage = "No data available for the selected filters.",
}: ReportTableProps) {
  // Column visibility
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    columns.forEach((col) => {
      if (col.defaultVisible !== false) {
        initial.add(col.key);
      }
    });
    return initial;
  });
  const [showColumnPicker, setShowColumnPicker] = useState(false);

  // Sorting
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);

  // Pagination
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(pageSizeOptions[0] ?? 10);

  // Visible columns in order
  const visibleColumns = useMemo(
    () => columns.filter((c) => visibleKeys.has(c.key)),
    [columns, visibleKeys],
  );

  // Sorted data
  const sortedData = useMemo(() => {
    if (!sortKey || !sortDir) return data;
    const copy = [...data];
    copy.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal);
      const bStr = String(bVal);
      return sortDir === "asc"
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });
    return copy;
  }, [data, sortKey, sortDir]);

  // Paginated data
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const pagedData = useMemo(
    () => sortedData.slice(page * pageSize, (page + 1) * pageSize),
    [sortedData, page, pageSize],
  );

  // Summary row
  const summaryRow = useMemo(() => {
    if (!showSummary || data.length === 0) return null;
    const sums: Record<string, number> = {};
    visibleColumns.forEach((col) => {
      if (col.summable) {
        sums[col.key] = data.reduce((acc, row) => {
          const val = row[col.key];
          return acc + (typeof val === "number" ? val : 0);
        }, 0);
      }
    });
    return sums;
  }, [data, visibleColumns, showSummary]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDir === "asc") setSortDir("desc");
      else if (sortDir === "desc") {
        setSortKey(null);
        setSortDir(null);
      }
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(0);
  };

  const toggleColumn = (key: string) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        // Don't allow hiding all columns
        if (next.size <= 1) return prev;
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const formatCell = (col: ReportColumn, row: Record<string, unknown>) => {
    const val = row[col.key];
    if (col.format) return col.format(val, row);
    if (val == null) return "-";
    return String(val);
  };

  const getSortIcon = (key: string) => {
    if (sortKey !== key) return <ArrowUpDown className="h-3.5 w-3.5 text-gray-400" />;
    if (sortDir === "asc") return <ArrowUp className="h-3.5 w-3.5 text-brand-600" />;
    return <ArrowDown className="h-3.5 w-3.5 text-brand-600" />;
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {visibleColumns.map((col) => (
                <th key={col.key} className="px-4 py-3">
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-20" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-gray-50">
                {visibleColumns.map((col) => (
                  <td key={col.key} className="px-4 py-3">
                    <div className="h-4 bg-gray-100 rounded animate-pulse" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar: column picker + pagination info */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500">
          {data.length === 0
            ? "No rows"
            : `Showing ${page * pageSize + 1}-${Math.min(
                (page + 1) * pageSize,
                sortedData.length,
              )} of ${sortedData.length} rows`}
        </div>
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            icon={<Columns3 className="h-4 w-4" />}
            onClick={() => setShowColumnPicker(!showColumnPicker)}
          >
            Columns
          </Button>
          {showColumnPicker && (
            <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-56">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Toggle Columns
                </span>
                <button
                  onClick={() => setShowColumnPicker(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {columns.map((col) => (
                  <label
                    key={col.key}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={visibleKeys.has(col.key)}
                      onChange={() => toggleColumn(col.key)}
                      className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="text-sm text-gray-700">{col.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      {data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-xl border border-gray-100 shadow-sm">
          <p className="text-sm text-gray-500">{emptyMessage}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {visibleColumns.map((col) => {
                  const canSort = col.sortable !== false;
                  return (
                    <th
                      key={col.key}
                      className={clsx(
                        "px-4 py-3 font-medium text-gray-500 whitespace-nowrap",
                        col.align === "right" && "text-right",
                        col.align === "center" && "text-center",
                        col.align !== "right" && col.align !== "center" && "text-left",
                        canSort && "cursor-pointer select-none hover:text-gray-700",
                      )}
                      onClick={canSort ? () => handleSort(col.key) : undefined}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        {canSort && getSortIcon(col.key)}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pagedData.map((row, rowIdx) => (
                <tr
                  key={(row[rowKey] as string) ?? rowIdx}
                  className="hover:bg-gray-50 transition-colors"
                >
                  {visibleColumns.map((col) => (
                    <td
                      key={col.key}
                      className={clsx(
                        "px-4 py-3",
                        col.align === "right" && "text-right",
                        col.align === "center" && "text-center",
                        col.align !== "right" && col.align !== "center" && "text-left",
                      )}
                    >
                      {formatCell(col, row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {summaryRow && Object.keys(summaryRow).length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                  {visibleColumns.map((col, colIdx) => (
                    <td
                      key={col.key}
                      className={clsx(
                        "px-4 py-3",
                        col.align === "right" && "text-right",
                        col.align === "center" && "text-center",
                        col.align !== "right" && col.align !== "center" && "text-left",
                      )}
                    >
                      {colIdx === 0 && !col.summable
                        ? "Total"
                        : col.summable && summaryRow[col.key] !== undefined
                          ? col.format
                            ? col.format(summaryRow[col.key], {} as Record<string, unknown>)
                            : String(summaryRow[col.key])
                          : ""}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* Pagination */}
      {data.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Rows per page:</label>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(0);
              }}
              className="rounded border border-gray-300 text-xs px-2 py-1 bg-white focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              icon={<ChevronLeft className="h-4 w-4" />}
            />
            <span className="text-xs text-gray-600 px-2">
              Page {page + 1} of {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              icon={<ChevronRight className="h-4 w-4" />}
            />
          </div>
        </div>
      )}
    </div>
  );
}
