import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAuthStore } from "./auth.store";
import { UserRole } from "@emp-billing/shared";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });

describe("useAuthStore", () => {
  beforeEach(() => {
    localStorageMock.clear();
    // Reset Zustand state
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
    });
  });

  it("starts unauthenticated", () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
  });

  it("setAuth sets user and token", () => {
    const user = {
      id: "usr-1",
      email: "test@example.com",
      role: UserRole.ADMIN,
      orgId: "org-1",
      orgName: "Test Org",
      firstName: "John",
      lastName: "Doe",
    };

    useAuthStore.getState().setAuth(user, "access-token-123");

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toEqual(user);
    expect(state.accessToken).toBe("access-token-123");
    expect(localStorageMock.getItem("access_token")).toBe("access-token-123");
  });

  it("clearAuth clears everything", () => {
    useAuthStore.getState().setAuth(
      { id: "usr-1", email: "a@b.com", role: UserRole.ADMIN, orgId: "org-1", orgName: "X", firstName: "A", lastName: "B" },
      "token"
    );

    useAuthStore.getState().clearAuth();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(localStorageMock.getItem("access_token")).toBeNull();
  });

  it("updateAccessToken updates only the token", () => {
    useAuthStore.getState().setAuth(
      { id: "usr-1", email: "a@b.com", role: UserRole.ADMIN, orgId: "org-1", orgName: "X", firstName: "A", lastName: "B" },
      "old-token"
    );

    useAuthStore.getState().updateAccessToken("new-token");

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe("new-token");
    expect(state.user?.id).toBe("usr-1"); // user unchanged
    expect(localStorageMock.getItem("access_token")).toBe("new-token");
  });
});
