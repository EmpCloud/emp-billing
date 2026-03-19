import { describe, it, expect, beforeEach } from "vitest";
import { useUIStore } from "./ui.store";

describe("useUIStore", () => {
  beforeEach(() => {
    useUIStore.setState({ sidebarOpen: true });
  });

  it("starts with sidebar open", () => {
    expect(useUIStore.getState().sidebarOpen).toBe(true);
  });

  it("setSidebarOpen sets sidebar state", () => {
    useUIStore.getState().setSidebarOpen(false);
    expect(useUIStore.getState().sidebarOpen).toBe(false);

    useUIStore.getState().setSidebarOpen(true);
    expect(useUIStore.getState().sidebarOpen).toBe(true);
  });

  it("toggleSidebar toggles the state", () => {
    expect(useUIStore.getState().sidebarOpen).toBe(true);

    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarOpen).toBe(false);

    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarOpen).toBe(true);
  });
});
