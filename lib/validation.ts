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

const ratingSchema = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === null || v === "") {
      return undefined;
    }
    if (typeof v === "number") {
      return v;
    }
    const n = Number(v);
    return Number.isNaN(n) ? undefined : n;
  })
  .refine((v) => v === undefined || (Number.isInteger(v) && v >= 1 && v <= 5), {
    message: "Rating must be between 1 and 5",
  });

export const feedbackInputSchema = z
  .object({
    message: z.string().trim().optional(),
    email: emailSchema,
    pageUrl: pageUrlSchema,
    rating: ratingSchema,
  })
  .superRefine((data, ctx) => {
    const hasMessage =
      typeof data.message === "string" && data.message.trim().length > 0;
    if (!hasMessage && data.rating === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Message is required",
        path: ["message"],
      });
      return;
    }
    if (typeof data.message === "string" && data.message.length > 5000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Message must be at most 5000 characters",
        path: ["message"],
      });
    }
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
