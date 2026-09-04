import { afterEach, describe, expect, it, vi } from "vitest";

const { setContentMock } = vi.hoisted(() => ({
  setContentMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("puppeteer", () => ({
  default: {
    launch: vi.fn().mockResolvedValue({
      newPage: vi.fn().mockResolvedValue({
        setContent: setContentMock,
        setRequestInterception: vi.fn().mockResolvedValue(undefined),
        on: vi.fn(),
        pdf: vi.fn().mockResolvedValue(Buffer.from("pdf")),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

import { findBrowserExecutable, generateInvoicePdf } from "./pdf";

const originalExecutablePath = process.env.PUPPETEER_EXECUTABLE_PATH;

afterEach(() => {
  setContentMock.mockClear();
  if (originalExecutablePath === undefined) {
    delete process.env.PUPPETEER_EXECUTABLE_PATH;
  } else {
    process.env.PUPPETEER_EXECUTABLE_PATH = originalExecutablePath;
  }
});

describe("findBrowserExecutable", () => {
  it("uses the configured Puppeteer executable when it exists", () => {
    process.env.PUPPETEER_EXECUTABLE_PATH = "/custom/chromium";

    expect(findBrowserExecutable("linux", (candidate) => candidate === "/custom/chromium"))
      .toBe("/custom/chromium");
  });

  it("falls back to a system browser when Puppeteer's downloaded Chrome is absent", () => {
    delete process.env.PUPPETEER_EXECUTABLE_PATH;

    expect(findBrowserExecutable("win32", (candidate) =>
      candidate === "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
    )).toBe("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe");
  });

  it("ignores a stale configured path and finds the container Chromium binary", () => {
    process.env.PUPPETEER_EXECUTABLE_PATH = "/usr/bin/chromium-browser";

    expect(findBrowserExecutable("linux", (candidate) => candidate === "/usr/bin/chromium"))
      .toBe("/usr/bin/chromium");
  });

  it("returns undefined when no configured or system browser exists", () => {
    delete process.env.PUPPETEER_EXECUTABLE_PATH;

    expect(findBrowserExecutable("linux", () => false)).toBeUndefined();
  });
});

describe("generateInvoicePdf", () => {
  it("keeps smallest-unit money formatting after email helpers are registered", async () => {
    // The application imports email.service during startup. It registers its
    // own Handlebars helpers, which must not overwrite the PDF environment.
    await import("../services/notification/email.service");

    await generateInvoicePdf({
      invoice: {
        invoiceNumber: "INV-TEST",
        status: "overdue",
        currency: "INR",
        issueDate: "2026-09-03",
        dueDate: "2026-09-03",
        subtotal: 500_000,
        discountAmount: 0,
        taxAmount: 0,
        total: 500_000,
        amountPaid: 0,
        amountDue: 500_000,
      },
      items: [{
        name: "Test plan",
        quantity: 10,
        rate: 50_000,
        discountAmount: 0,
        taxAmount: 0,
        amount: 500_000,
      }],
      org: { name: "EmpCloud" },
      client: { name: "Test customer" },
    });

    const html = String(setContentMock.mock.calls.at(-1)?.[0] ?? "");
    expect(html).toContain("₹500.00");
    expect(html).toContain("₹5,000.00");
    expect(html).not.toContain("500,000.00");
  });
});
