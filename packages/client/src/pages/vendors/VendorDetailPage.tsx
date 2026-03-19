import { useNavigate, useParams } from "react-router-dom";
import { Edit, Mail, Phone, MapPin, Hash, Building2 } from "lucide-react";
import { useVendor } from "@/api/hooks/vendor.hooks";
import { Button } from "@/components/common/Button";
import { PageHeader } from "@/components/common/PageHeader";
import { Spinner } from "@/components/common/Spinner";
import { EmptyState } from "@/components/common/EmptyState";

export function VendorDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: vendorData, isLoading } = useVendor(id);
  const vendor = vendorData?.data;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="p-6">
        <EmptyState title="Vendor not found" description="This vendor may have been deleted." />
      </div>
    );
  }

  const hasAddress = vendor.addressLine1 || vendor.city || vendor.state || vendor.country;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={vendor.name}
        subtitle={vendor.company || undefined}
        breadcrumb={[{ label: "Vendors", href: "/vendors" }, { label: vendor.name }]}
        actions={
          <Button
            variant="outline"
            icon={<Edit className="h-4 w-4" />}
            onClick={() => navigate(`/vendors/${id}/edit`)}
          >
            Edit
          </Button>
        }
      />

      {/* Status */}
      <div>
        <span
          className={
            vendor.isActive
              ? "inline-flex items-center rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700"
              : "inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500"
          }
        >
          {vendor.isActive ? "Active" : "Inactive"}
        </span>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Contact Info */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Contact Information</h2>
          <ul className="space-y-3 text-sm text-gray-700">
            {vendor.company && (
              <li className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-gray-400 flex-shrink-0" />
                {vendor.company}
              </li>
            )}
            {vendor.email && (
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <a href={`mailto:${vendor.email}`} className="hover:underline">{vendor.email}</a>
              </li>
            )}
            {vendor.phone && (
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-gray-400 flex-shrink-0" />
                {vendor.phone}
              </li>
            )}
            {vendor.taxId && (
              <li className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <span className="text-gray-500">GSTIN / Tax ID:</span>
                <span className="font-mono">{vendor.taxId}</span>
              </li>
            )}
            {!vendor.email && !vendor.phone && !vendor.taxId && !vendor.company && (
              <li className="text-gray-400">No contact information on file.</li>
            )}
          </ul>
        </div>

        {/* Address */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Address</h2>
          {hasAddress ? (
            <div className="flex items-start gap-2 text-sm text-gray-700">
              <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
              <address className="not-italic leading-relaxed">
                {vendor.addressLine1}
                {vendor.addressLine2 && <><br />{vendor.addressLine2}</>}
                {(vendor.city || vendor.state || vendor.postalCode) && (
                  <>
                    <br />
                    {[vendor.city, vendor.state, vendor.postalCode].filter(Boolean).join(", ")}
                  </>
                )}
                {vendor.country && <><br />{vendor.country}</>}
              </address>
            </div>
          ) : (
            <p className="text-sm text-gray-400">No address on file.</p>
          )}
        </div>
      </div>

      {/* Notes */}
      {vendor.notes && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-2">Notes</h2>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{vendor.notes}</p>
        </div>
      )}
    </div>
  );
}
