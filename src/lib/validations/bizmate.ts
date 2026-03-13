import { z } from "zod";

// ============================================================
// Companies
// ============================================================

export const createCompanySchema = z.object({
  name: z.string().min(1, { message: "name is required" }).max(200),
  industry: z
    .enum(["ecommerce", "content", "service", "f&b", "other"])
    .optional(),
  team_size: z.enum(["1-5", "6-20", "21-50", "50+"]).optional(),
  icp_segment: z.enum(["creator", "sme", "agency"]).default("sme"),
  currency: z.string().default("VND"),
  settings: z.record(z.string(), z.unknown()).default({}),
});

export const updateCompanySchema = z
  .object({
    name: z.string().min(1).max(200),
    industry: z.enum(["ecommerce", "content", "service", "f&b", "other"]),
    team_size: z.enum(["1-5", "6-20", "21-50", "50+"]),
    icp_segment: z.enum(["creator", "sme", "agency"]),
    currency: z.string(),
    settings: z.record(z.string(), z.unknown()),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

// ============================================================
// Goals
// ============================================================

export const createGoalSchema = z.object({
  company_id: z.string().uuid({ message: "company_id must be a valid UUID" }),
  title: z.string().min(1, { message: "title is required" }).max(200),
  target_value: z.number().positive({ message: "target_value must be positive" }),
  unit: z.string().min(1, { message: "unit is required" }),
  deadline: z.string().optional(),
  status: z.enum(["active", "completed", "paused"]).default("active"),
});

export const updateGoalSchema = z
  .object({
    title: z.string().min(1).max(200),
    target_value: z.number().positive(),
    current_value: z.number().min(0),
    unit: z.string().min(1),
    deadline: z.string().nullable(),
    status: z.enum(["active", "completed", "paused"]),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
