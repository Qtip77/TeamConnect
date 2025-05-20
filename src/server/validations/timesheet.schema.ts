import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";
// import { cuid2 } from "@paralleldrive/cuid2"; // Removed this import based on linter error

import { billingRates, timesheets } from "../db/timesheet-schema.sql";

export const billingRateSchema = createSelectSchema(billingRates, {
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type BillingRate = z.infer<typeof billingRateSchema>;

export const timesheetSchema = createSelectSchema(timesheets, {
  // Ensure timestamps from DB (which are numbers/Date) are correctly typed for API responses if needed.
  // If they are already Date objects from Drizzle, this might not be necessary or could be z.date().
  // For now, assuming string conversion for API, consistent with billingRateSchema.
  shiftStartDate: z.number().or(z.date()).transform(val => new Date(val).toISOString()),
  shiftEndDate: z.number().or(z.date()).transform(val => new Date(val).toISOString()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  approvedAt: z.number().or(z.date()).nullable().transform(val => val ? new Date(val).toISOString() : null),
});
export type Timesheet = z.infer<typeof timesheetSchema>;

export const billingRateCreateSchema = createInsertSchema(billingRates, {
  rateName: z.string().min(1, "Rate name is required."),
  ratePerHour: z.number().positive("Rate per hour must be positive."),
  currency: z.string().min(1, "Currency is required."),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
}).omit({ createdBy: true}); // createdBy will be set by the server based on logged-in user
export type BillingRateCreate = z.infer<typeof billingRateCreateSchema>;

export const billingRateUpdateSchema = createUpdateSchema(billingRates, {
  rateName: z.string().min(1, "Rate name is required.").optional(),
  ratePerHour: z.number().positive("Rate per hour must be positive.").optional(),
  currency: z.string().min(1, "Currency is required.").optional(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
}).omit({ createdBy: true});
export type BillingRateUpdate = z.infer<typeof billingRateUpdateSchema>;

export const timesheetCreateSchema = createInsertSchema(timesheets, {
  truckId: z.string({ required_error: "Truck selection is required."}).cuid2({ message: "Invalid Truck ID format." }),
  shiftStartDate: z.number({ required_error: "Shift start date is required." }).int().positive("Shift start date must be a valid future or past date represented as a positive timestamp."),
  shiftEndDate: z.number().int().positive("Shift end date must be a valid future date represented as a positive timestamp."),
  startOdometerReading: z.number({ required_error: "Start odometer reading is required." }).int().min(0, "Start odometer reading cannot be negative."),
  endOdometerReading: z.number({ required_error: "End odometer reading is required." }).int().positive("End odometer reading must be a positive number."),
  notes: z.string().max(500, "Notes must be 500 characters or less.").optional().nullable(),
})
.omit({ 
  id: true, // Handled by DB
  driverId: true, // Will be set by the server from the authenticated user
  status: true, // Will be defaulted to 'pending' by the server
  approvedBy: true,
  approvedAt: true,
  rejectionReason: true,
  billingRateId: true,
  totalBilledAmount: true,
  createdAt: true, // Handled by DB
  updatedAt: true, // Handled by DB
})
.refine(
  (data) => {
    if (data.shiftEndDate === null || data.shiftEndDate === undefined) {
      return true; // No end date, so validation passes
    }
    return data.shiftEndDate > data.shiftStartDate;
  },
  {
    message: "Shift end date must be after shift start date.",
    path: ["shiftEndDate"],
  }
)
.refine(
  (data) => data.endOdometerReading > (data.startOdometerReading ?? -1), // Allow startOdometerReading to be 0
  {
    message: "End odometer reading must be greater than start odometer reading.",
    path: ["endOdometerReading"],
  }
);
export type TimesheetCreate = z.infer<typeof timesheetCreateSchema>;

export const timesheetUpdateSchema = createUpdateSchema(timesheets, {
  // Fields a driver might update (if logic allows, e.g., for pending/rejected timesheets)
  truckId: z.string().cuid2({ message: "Invalid Truck ID format." }).optional(),
  shiftStartDate: z.number().int().positive().optional(),
  shiftEndDate: z.number().int().positive().optional(),
  startOdometerReading: z.number().int().min(0).optional(),
  endOdometerReading: z.number().int().positive().optional(),
  notes: z.string().max(500).optional().nullable(),

  // Fields an admin/manager might update
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  // approvedBy is string (user ID), will be set by server on approval
  // approvedAt is number (timestamp), will be set by server on approval
  rejectionReason: z.string().max(500).optional().nullable(),
  billingRateId: z.string().cuid2({ message: "Invalid Billing Rate ID format." }).optional().nullable(),
  totalBilledAmount: z.number().min(0).optional().nullable(),
})
.omit({
  id: true,
  driverId: true, // Should not be updatable directly through this schema by client
  // approvedBy: true, // Server should handle this based on user approving
  // approvedAt: true, // Server should handle this
  createdAt: true,
  updatedAt: true, // Server will manage updatedAt
})
.refine( // Ensure end date is after start date if both are provided
    (data) => {
        if (data.shiftEndDate === undefined || data.shiftStartDate === undefined) return true; // One or both not being updated
        if (data.shiftEndDate === null) return true; // End date being cleared
        return data.shiftEndDate > data.shiftStartDate;
    },
    { message: "Shift end date must be after start date.", path: ["shiftEndDate"] }
)
.refine( // Ensure end odometer is greater than start if both are provided
    (data) => {
        if (data.endOdometerReading === undefined || data.startOdometerReading === undefined) return true; // One or both not being updated
        return data.endOdometerReading > data.startOdometerReading;
    },
    { message: "End odometer reading must be greater than start odometer reading.", path: ["endOdometerReading"] }
);

export type TimesheetUpdate = z.infer<typeof timesheetUpdateSchema>;
