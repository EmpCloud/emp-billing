import { describe, it, expect } from "vitest";
import { parseCSV, toCSV } from "./csv";

describe("csv utility", () => {
  describe("parseCSV", () => {
    it("parses basic CSV", () => {
      const csv = "name,email\nJohn,john@test.com\nJane,jane@test.com";
      const result = parseCSV(csv);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ name: "John", email: "john@test.com" });
      expect(result[1]).toEqual({ name: "Jane", email: "jane@test.com" });
    });

    it("handles quoted fields with commas", () => {
      const csv = 'name,address\nJohn,"123 Main St, Suite 4"';
      const result = parseCSV(csv);

      expect(result[0].address).toBe("123 Main St, Suite 4");
    });

    it("handles escaped quotes", () => {
      const csv = 'name,note\nJohn,"He said ""hello"""';
      const result = parseCSV(csv);

      expect(result[0].note).toBe('He said "hello"');
    });

    it("handles Windows line endings (\\r\\n)", () => {
      const csv = "name,email\r\nJohn,j@t.com\r\nJane,ja@t.com";
      const result = parseCSV(csv);

      expect(result).toHaveLength(2);
    });

    it("returns empty array for header-only CSV", () => {
      const result = parseCSV("name,email");
      expect(result).toEqual([]);
    });

    it("returns empty array for empty string", () => {
      const result = parseCSV("");
      expect(result).toEqual([]);
    });

    it("trims whitespace from headers and values", () => {
      const csv = " name , email \n John , john@test.com ";
      const result = parseCSV(csv);

      expect(result[0]).toEqual({ name: "John", email: "john@test.com" });
    });

    it("handles missing values", () => {
      const csv = "a,b,c\n1,,3";
      const result = parseCSV(csv);

      expect(result[0]).toEqual({ a: "1", b: "", c: "3" });
    });
  });

  describe("toCSV", () => {
    it("serializes objects to CSV", () => {
      const data = [
        { name: "John", email: "john@test.com" },
        { name: "Jane", email: "jane@test.com" },
      ];
      const columns = [
        { key: "name", header: "Name" },
        { key: "email", header: "Email" },
      ];

      const csv = toCSV(data, columns);
      const lines = csv.split("\n");

      expect(lines[0]).toBe("Name,Email");
      expect(lines[1]).toBe("John,john@test.com");
      expect(lines[2]).toBe("Jane,jane@test.com");
    });

    it("escapes fields with commas", () => {
      const data = [{ name: "Doe, John", email: "j@t.com" }];
      const columns = [
        { key: "name", header: "Name" },
        { key: "email", header: "Email" },
      ];

      const csv = toCSV(data, columns);
      expect(csv).toContain('"Doe, John"');
    });

    it("escapes fields with quotes", () => {
      const data = [{ name: 'Say "hi"', email: "j@t.com" }];
      const columns = [
        { key: "name", header: "Name" },
        { key: "email", header: "Email" },
      ];

      const csv = toCSV(data, columns);
      expect(csv).toContain('"Say ""hi"""');
    });

    it("handles null/undefined values", () => {
      const data = [{ name: "John", email: undefined }];
      const columns = [
        { key: "name", header: "Name" },
        { key: "email", header: "Email" },
      ];

      const csv = toCSV(data, columns);
      expect(csv).toContain("John,");
    });

    it("handles empty data", () => {
      const columns = [{ key: "name", header: "Name" }];
      const csv = toCSV([], columns);
      expect(csv).toBe("Name");
    });
  });

  describe("roundtrip", () => {
    it("parse(toCSV(data)) returns the original data", () => {
      const data = [
        { name: "John", email: "john@test.com" },
        { name: "Jane", email: "jane@test.com" },
      ];
      const columns = [
        { key: "name", header: "name" },
        { key: "email", header: "email" },
      ];

      const csv = toCSV(data, columns);
      const parsed = parseCSV(csv);

      expect(parsed).toEqual(data);
    });
  });
});
