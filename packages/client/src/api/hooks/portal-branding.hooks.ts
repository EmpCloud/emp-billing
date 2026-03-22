import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import type { ApiResponse } from "@emp-billing/shared";

const API_BASE = import.meta.env.VITE_API_URL || "/api/v1";

export interface PortalBranding {
  orgName: string;
  logo: string | null;
  primaryColor: string | null;
  email: string | null;
  website: string | null;
}

const PORTAL_BRANDING_KEY = "portal-branding";

async function fetchPortalBranding(): Promise<PortalBranding> {
  const res = await axios.get<ApiResponse<PortalBranding>>(
    `${API_BASE}/portal/branding`
  );
  return res.data.data as PortalBranding;
}

/**
 * Fetches the org branding for the current domain.
 * This is a public endpoint — no auth required.
 * The result is cached for the lifetime of the session (staleTime: Infinity).
 */
export function usePortalBranding() {
  return useQuery({
    queryKey: [PORTAL_BRANDING_KEY],
    queryFn: fetchPortalBranding,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
  });
}
