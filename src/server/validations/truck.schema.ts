import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";

import { trucks } from "../db/timesheet-schema.sql";

export const truckSelectSchema = createSelectSchema(trucks, {
  // Assuming integer timestamps from DB (unixepoch) should be string ISO dates in API responses
  createdAt: z.preprocess((val) => (typeof val === 'number' ? new Date(val * 1000) : val), z.string().datetime()),
  updatedAt: z.preprocess((val) => (typeof val === 'number' ? new Date(val * 1000) : val), z.string().datetime()),
  // lastOdometerReading from DB is integer, allow null.
  lastOdometerReading: z.number().int().nullable(),
  // lastMaintenanceOdometerReading from DB is integer, allow null.
  lastMaintenanceOdometerReading: z.number().int().nullable(),
});
export type Truck = z.infer<typeof truckSelectSchema>;

export const truckCreateSchema = createInsertSchema(trucks, {
  unitNumber: z.string().min(1, "Unit number is required"),
  make: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  serialNumber: z.string().optional().nullable(),
  // DB default is 0, so this can be optional. Ensure it's a non-negative integer if provided.
  lastOdometerReading: z.number().int().min(0).optional().nullable(),
  // DB default is 0, so this can be optional. Ensure it's a non-negative integer if provided.
  lastMaintenanceOdometerReading: z.number().int().min(0).optional().nullable(),
  // DB default is 10000, notNull. Ensure positive integer if provided, else DB default.
  maintenanceIntervalKm: z.number().int().positive().optional(),
});
export type TruckCreate = z.infer<typeof truckCreateSchema>;

export const truckUpdateSchema = createUpdateSchema(trucks, {
  // All fields are optional by createUpdateSchema default
  unitNumber: z.string().min(1, "Unit number is required").optional(),
  make: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  serialNumber: z.string().optional().nullable(),
  lastOdometerReading: z.number().int().min(0).optional().nullable(),
  lastMaintenanceOdometerReading: z.number().int().min(0).optional().nullable(),
  maintenanceIntervalKm: z.number().int().positive().optional(),
});
export type TruckUpdate = z.infer<typeof truckUpdateSchema>; 