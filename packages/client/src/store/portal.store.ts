import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PortalState {
  portalToken: string | null;
  clientId: string | null;
  orgName: string | null;
  clientName: string | null;
  brandPrimary: string | null;
  logoUrl: string | null;
  isPortalAuthenticated: boolean;
  setPortalAuth: (token: string, clientId: string, orgName: string, clientName: string, brandPrimary?: string, logoUrl?: string) => void;
  clearPortalAuth: () => void;
}

export const usePortalStore = create<PortalState>()(
  persist(
    (set) => ({
      portalToken: null,
      clientId: null,
      orgName: null,
      clientName: null,
      brandPrimary: null,
      logoUrl: null,
      isPortalAuthenticated: false,

      setPortalAuth: (token, clientId, orgName, clientName, brandPrimary, logoUrl) => {
        set({
          portalToken: token,
          clientId,
          orgName,
          clientName,
          brandPrimary: brandPrimary ?? null,
          logoUrl: logoUrl ?? null,
          isPortalAuthenticated: true,
        });
      },

      clearPortalAuth: () => {
        set({
          portalToken: null,
          clientId: null,
          orgName: null,
          clientName: null,
          brandPrimary: null,
          logoUrl: null,
          isPortalAuthenticated: false,
        });
      },
    }),
    {
      name: "emp-billing-portal",
      partialize: (state) => ({
        portalToken: state.portalToken,
        clientId: state.clientId,
        orgName: state.orgName,
        clientName: state.clientName,
        brandPrimary: state.brandPrimary,
        logoUrl: state.logoUrl,
        isPortalAuthenticated: state.isPortalAuthenticated,
      }),
    }
  )
);
