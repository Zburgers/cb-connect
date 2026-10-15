import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./ErrorBoundary.tsx", import.meta.url), "utf8");

describe("mobile error boundary source contract", () => {
  it("renders children normally and uses a fixed accessible fallback after an error", () => {
    expect(source).toContain("extends React.Component<");
    expect(source).toContain("static getDerivedStateFromError()");
    expect(source).toContain("if (!this.state.hasError) return this.props.children;");
    expect(source).toContain('accessibilityRole="alert"');
    expect(source).toContain('accessibilityLabel="An unexpected error occurred"');
    expect(source).toContain("Something went wrong");
  });

  it("does not render or log exception details or request and identity data", () => {
    expect(source).not.toMatch(/console\.(log|error|warn)|(?:error|exception)\.(message|stack)/i);
    expect(source).not.toMatch(/routeParams|authClaims|userData|email|password|userId|sessionId/i);
  });
});
