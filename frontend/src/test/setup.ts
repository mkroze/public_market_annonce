import "@testing-library/jest-dom/vitest";

Object.defineProperty(window, "scrollTo", {
  value: vi.fn(),
  writable: true,
});
