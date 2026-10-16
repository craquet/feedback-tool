import { describe, expect, it } from "vitest";
import { parseFeedbackInput } from "./validation";

describe("parseFeedbackInput", () => {
  it("accepts a message and trims surrounding whitespace", () => {
    const result = parseFeedbackInput({ message: "  Something broke  " });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.message).toBe("Something broke");
    }
  });

  it("accepts a valid email and page URL", () => {
    const result = parseFeedbackInput({
      message: "hi",
      email: "user@example.com",
      pageUrl: "https://app.example.com/settings",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("user@example.com");
      expect(result.data.pageUrl).toBe("https://app.example.com/settings");
    }
  });

  it("rejects a missing or empty message", () => {
    expect(parseFeedbackInput({}).success).toBe(false);
    expect(parseFeedbackInput({ message: "" }).success).toBe(false);
    expect(parseFeedbackInput({ message: "   " }).success).toBe(false);
  });

  it("rejects a message longer than 5000 characters", () => {
    const result = parseFeedbackInput({ message: "a".repeat(5001) });

    expect(result.success).toBe(false);
  });

  it("treats an empty-string email as absent", () => {
    const result = parseFeedbackInput({ message: "hi", email: "" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBeUndefined();
    }
  });

  it("rejects an invalid email", () => {
    const result = parseFeedbackInput({ message: "hi", email: "not-an-email" });

    expect(result.success).toBe(false);
  });

  it("rejects a non-http(s) page URL", () => {
    const result = parseFeedbackInput({
      message: "hi",
      pageUrl: "javascript:alert(1)",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a message that is not a string", () => {
    expect(parseFeedbackInput({ message: 42 }).success).toBe(false);
  });
});
