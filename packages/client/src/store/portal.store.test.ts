import { describe, it, expect, beforeEach } from "vitest";
import { usePortalStore } from "./portal.store";

describe("usePortalStore", () => {
  beforeEach(() => {
    usePortalStore.setState({
      portalToken: null,
      clientId: null,
      orgName: null,
      clientName: null,
      brandPrimary: null,
      logoUrl: null,
      isPortalAuthenticated: false,
    });
  });

  it("starts unauthenticated", () => {
    const state = usePortalStore.getState();
    expect(state.isPortalAuthenticated).toBe(false);
    expect(state.portalToken).toBeNull();
  });

  it("setPortalAuth sets all fields", () => {
    usePortalStore.getState().setPortalAuth(
      "portal-token",
      "client-1",
      "Acme Inc",
      "John Doe",
      "#ff0000",
      "https://example.com/logo.png"
    );

    const state = usePortalStore.getState();
    expect(state.isPortalAuthenticated).toBe(true);
    expect(state.portalToken).toBe("portal-token");
    expect(state.clientId).toBe("client-1");
    expect(state.orgName).toBe("Acme Inc");
    expect(state.clientName).toBe("John Doe");
    expect(state.brandPrimary).toBe("#ff0000");
    expect(state.logoUrl).toBe("https://example.com/logo.png");
  });

  it("setPortalAuth defaults optional fields to null", () => {
    usePortalStore.getState().setPortalAuth(
      "token",
      "client-1",
      "Org",
      "Client"
    );

    const state = usePortalStore.getState();
    expect(state.brandPrimary).toBeNull();
    expect(state.logoUrl).toBeNull();
  });

  it("clearPortalAuth resets everything", () => {
    usePortalStore.getState().setPortalAuth("token", "c1", "org", "name", "#000", "url");
    usePortalStore.getState().clearPortalAuth();

    const state = usePortalStore.getState();
    expect(state.isPortalAuthenticated).toBe(false);
    expect(state.portalToken).toBeNull();
    expect(state.clientId).toBeNull();
    expect(state.orgName).toBeNull();
    expect(state.clientName).toBeNull();
    expect(state.brandPrimary).toBeNull();
    expect(state.logoUrl).toBeNull();
  });
});
