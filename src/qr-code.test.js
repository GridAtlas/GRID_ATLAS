import { describe, expect, it } from "vitest";
import { QrCodeError, generateQrCodeMatrix } from "./qr-code.js";

describe("QR code generation", () => {
  it("creates a square matrix with finder patterns", () => {
    const matrix = generateQrCodeMatrix("https://gridatlas.example/#gridatlas=v1.test");
    expect(matrix.length).toBeGreaterThanOrEqual(21);
    expect(matrix.every((row) => row.length === matrix.length)).toBe(true);
    expect(matrix[0][0]).toBe(true);
    expect(matrix[0][6]).toBe(true);
    expect(matrix[6][0]).toBe(true);
    expect(matrix[6][6]).toBe(true);
  });

  it("rejects data that does not fit the local QR capacity", () => {
    expect(() => generateQrCodeMatrix("x".repeat(3000))).toThrow(QrCodeError);
  });
});
