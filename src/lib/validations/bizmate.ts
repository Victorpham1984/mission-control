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

// ============================================================
// KPIs
// ============================================================

export const createKpiSchema = z.object({
  company_id: z.string().uuid({ message: "company_id must be a valid UUID" }),
  goal_id: z.string().uuid().nullable().default(null),
  name: z.string().min(1, { message: "name is required" }).max(200),
  category: z.enum(["acquisition", "activation", "revenue", "operations"], {
    message: "category must be acquisition, activation, revenue, or operations",
  }),
  target_value: z.number().nullable().default(null),
  unit: z.string().min(1, { message: "unit is required" }),
  source: z.string().nullable().default(null),
});

export const updateKpiSchema = z
  .object({
    name: z.string().min(1).max(200),
    category: z.enum(["acquisition", "activation", "revenue", "operations"]),
    current_value: z.number().min(0),
    target_value: z.number().nullable(),
    unit: z.string().min(1),
    source: z.string().nullable(),
    goal_id: z.string().uuid().nullable(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

// ============================================================
// Installed Playbooks
// ============================================================

export const installPlaybookSchema = z.object({
  company_id: z.string().uuid({ message: "company_id must be a valid UUID" }),
  customization: z.record(z.string(), z.unknown()).default({}),
  schedule: z.string().nullable().default(null),
  active: z.boolean().default(true),
});

export const updateInstalledPlaybookSchema = z
  .object({
    customization: z.record(z.string(), z.unknown()),
    schedule: z.string().nullable(),
    active: z.boolean(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
