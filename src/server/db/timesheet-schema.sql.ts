import { createId } from "@paralleldrive/cuid2";
import { relations, sql } from "drizzle-orm";
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

import { users } from "./auth-schema.sql";
import { maintenanceLogs, maintenanceItems } from "./maintenance-schema.sql";
// Trucks Table
export const trucks = sqliteTable("trucks", (t) => ({
  id: t
    .text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  unitNumber: t.text("unit_number").notNull().unique(),
  make: t.text("make"),
  model: t.text("model"),
  serialNumber: t.text("serial_number").unique(),
  lastOdometerReading: t.integer("last_odometer_reading").default(0),
  lastMaintenanceOdometerReading: t.integer("last_maintenance_odometer_reading").default(0),
  maintenanceIntervalKm: t.integer("maintenance_interval_km").notNull().default(10000), // Default to 10,000 KM
  createdAt: t
    .integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: t
    .integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}));

// Timesheets Table
export const timesheets = sqliteTable("timesheets", (t) => ({
  id: t
    .text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  driverId: t
    .text("driver_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }), // Prevent deleting user if they have timesheets
  truckId: t
    .text("truck_id")
    .notNull()
    .references(() => trucks.id, { onDelete: "restrict" }),
  shiftStartDate: t.integer("shift_start_date", { mode: "timestamp" }).notNull(),
  shiftEndDate: t.integer("shift_end_date", { mode: "timestamp" }),
  startOdometerReading: t.integer("start_odometer_reading"),
  endOdometerReading: t.integer("end_odometer_reading").notNull(),
  status: t
    .text("status", { enum: ["pending", "approved", "rejected"] })
    .notNull()
    .default("pending"),
  approvedBy: t.text("approved_by").references(() => users.id, { onDelete: "set null" }), // Manager/Admin
  approvedAt: t.integer("approved_at", { mode: "timestamp" }),
  rejectionReason: t.text("rejection_reason"),
  billingRateId: t.text("billing_rate_id").references(() => billingRates.id, { onDelete: "set null" }),
  totalBilledAmount: real("total_billed_amount"),
  notes: t.text("notes"),
  createdAt: t
    .integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: t
    .integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}));


// Billing Rates Table
export const billingRates = sqliteTable("billing_rates", (t) => ({
  id: t
    .text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  rateName: t.text("rate_name").notNull().unique(), // e.g., "Standard Driver Rate", "Weekend Rate"
  ratePerHour: real("rate_per_hour").notNull(),
  currency: t.text("currency").notNull().default("CAD"),
  description: t.text("description"),
  isActive: t.integer("is_active", { mode: "boolean" }).default(true),
  createdBy: t.text("created_by").references(() => users.id, { onDelete: "set null" }), // Admin/Manager
  createdAt: t
    .integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: t
    .integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}));


// RELATIONS

export const truckRelations = relations(trucks, ({ many }) => ({
  timesheets: many(timesheets),
  maintenanceLogs: many(maintenanceLogs),
}));

export const timesheetRelations = relations(timesheets, ({ one }) => ({
  driver: one(users, {
    fields: [timesheets.driverId],
    references: [users.id],
    relationName: "timesheet_driver",
  }),
  truck: one(trucks, {
    fields: [timesheets.truckId],
    references: [trucks.id],
  }),
  approver: one(users, {
    fields: [timesheets.approvedBy],
    references: [users.id],
    relationName: "timesheet_approver",
  }),
  billingRate: one(billingRates, {
    fields: [timesheets.billingRateId],
    references: [billingRates.id],
  }),
}));


export const billingRateRelations = relations(billingRates, ({ one, many }) => ({
  creator: one(users, {
    fields: [billingRates.createdBy],
    references: [users.id],
    relationName: "billing_rate_creator",
  }),
  timesheets: many(timesheets),
}));

// Extend user relations if needed, for example, to link users to their timesheets or maintenance logs directly
export const userExtendedRelations = relations(users, ({ many }) => ({
    timesheets: many(timesheets, {relationName: "timesheet_driver"}),
    approvedTimesheets: many(timesheets, {relationName: "timesheet_approver"}),
    maintenanceLogs: many(maintenanceLogs, {relationName: "maintenance_staff"}),
    createdBillingRates: many(billingRates, {relationName: "billing_rate_creator"}),
}));


