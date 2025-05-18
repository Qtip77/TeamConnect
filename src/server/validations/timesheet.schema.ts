import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";

import { billingRates, timesheets } from "../db/timesheet-schema.sql";

export const billingRateSchema = createSelectSchema(billingRates, {
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type BillingRate = z.infer<typeof billingRateSchema>;

export const timesheetSchema = createSelectSchema(timesheets, {
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Timesheet = z.infer<typeof timesheetSchema>;

export const billingRateCreateSchema = createInsertSchema(billingRates, {
  rateName: z.string(),
  ratePerHour: z.number(),
  currency: z.string(),
  description: z.string(),
  isActive: z.boolean(),
});
export type BillingRateCreate = z.infer<typeof billingRateCreateSchema>;

export const billingRateUpdateSchema = createUpdateSchema(billingRates, {
  rateName: z.string(),
  ratePerHour: z.number(),
  currency: z.string(),
  description: z.string(),
  isActive: z.boolean(),
});
export type BillingRateUpdate = z.infer<typeof billingRateUpdateSchema>;

export const timesheetCreateSchema = createInsertSchema(timesheets, {
  shiftStartDate: z.number(),
  shiftEndDate: z.number(),
  startOdometerReading: z.number(),
  status: z.enum(["pending"]),
  endOdometerReading: z.number(),
  notes: z.string().optional(),
});
export type TimesheetCreate = z.infer<typeof timesheetCreateSchema>;

export const timesheetUpdateSchema = createUpdateSchema(timesheets, {
  shiftStartDate: z.number(),
  shiftEndDate: z.number(),
  startOdometerReading: z.number(),
  endOdometerReading: z.number(),
  status: z.enum(["pending", "approved", "rejected"]),
  approvedBy: z.string(),
  approvedAt: z.number(),
  rejectionReason: z.string(),
  billingRateId: z.string(),
  totalBilledAmount: z.number(),
  notes: z.string().optional(),
});
export type TimesheetUpdate = z.infer<typeof timesheetUpdateSchema>;
