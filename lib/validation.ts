import { z } from "zod";

const emailSchema = z
  .string()
  .trim()
  .max(320)
  .optional()
  .transform((v) => (v === undefined || v === "" ? undefined : v))
  .refine(
    (v) => v === undefined || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    "Invalid email",
  );

const pageUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .optional()
  .transform((v) => (v === undefined || v === "" ? undefined : v))
  .refine(
    (v) => v === undefined || /^https?:\/\//.test(v),
    "pageUrl must be an http(s) URL",
  );

export const feedbackInputSchema = z.object({
  message: z.string().trim().min(1, "Message is required").max(5000),
  email: emailSchema,
  pageUrl: pageUrlSchema,
});

export type FeedbackInput = z.infer<typeof feedbackInputSchema>;

export type ParseResult =
  | { success: true; data: FeedbackInput }
  | { success: false; error: string };

export function parseFeedbackInput(raw: unknown): ParseResult {
  const result = feedbackInputSchema.safeParse(raw);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: result.error.issues[0]?.message ?? "Invalid input",
  };
}
