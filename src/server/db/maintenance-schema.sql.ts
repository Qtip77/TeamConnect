import { createId } from "@paralleldrive/cuid2";
import { relations, sql } from "drizzle-orm";
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

import { users } from "./auth-schema.sql";
import { trucks } from "./timesheet-schema.sql";

// Maintenance Logs Table
export const maintenanceLogs = sqliteTable("maintenance_logs", (t) => ({
  id: t
    .text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    truckId: t
      .text("truck_id")
      .notNull()
      .references(() => trucks.id, { onDelete: "cascade" }),
    maintenanceStaffId: t
      .text("maintenance_staff_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    inspectionDate: t.integer("inspection_date", { mode: "timestamp" }).notNull(),
    inspectionTime: t.text("inspection_time"), // Storing as text e.g., "14:30"
    inspectorName: t.text("inspector_name").notNull(), // Can be pre-filled from user or entered
    locationOfInspection: t.text("location_of_inspection"),
    odometerReading: t.integer("odometer_reading").notNull(),
    hourMeter: t.integer("hour_meter"),
  
    // Inspection Checklist - Vehicle Systems
    bodyAndSeats: t.integer("body_and_seats", { mode: "boolean" }).default(false),
    chassisFrame: t.integer("chassis_frame", { mode: "boolean" }).default(false),
    underbody: t.integer("underbody", { mode: "boolean" }).default(false),
    driverShaft: t.integer("driver_shaft", { mode: "boolean" }).default(false),
    windowsAndMirror: t.integer("windows_and_mirror", { mode: "boolean" }).default(false),
    fuel: t.integer("fuel", { mode: "boolean" }).default(false),
    exhaust: t.integer("exhaust", { mode: "boolean" }).default(false),
    frictionComponents: t.integer("friction_components", { mode: "boolean" }).default(false),
    hydraulicAndVacuumAssistBrake: t.integer("hydraulic_and_vacuum_assist_brake", { mode: "boolean" }).default(false),
    mechanicalComponents: t.integer("mechanical_components", { mode: "boolean" }).default(false),
    brakePedal: t.integer("brake_pedal", { mode: "boolean" }).default(false),
  
    // Inspection Checklist - Mechanical Systems
    airBrakeSystem: t.integer("air_brake_system", { mode: "boolean" }).default(false),
    parkBrake: t.integer("park_brake", { mode: "boolean" }).default(false),
    brakeSystem: t.integer("brake_system", { mode: "boolean" }).default(false),
    engineControls: t.integer("engine_controls", { mode: "boolean" }).default(false),
    steeringColumnAndBox: t.integer("steering_column_and_box", { mode: "boolean" }).default(false),
    wheelAlignment: t.integer("wheel_alignment", { mode: "boolean" }).default(false),
    steeringLinkage: t.integer("steering_linkage", { mode: "boolean" }).default(false),
    suspension: t.integer("suspension", { mode: "boolean" }).default(false),
    generalRequirements: t.integer("general_requirements", { mode: "boolean" }).default(false),
    fireExtinguisher: t.integer("fire_extinguisher", { mode: "boolean" }).default(false),
    spillKit: t.integer("spill_kit", { mode: "boolean" }).default(false),
    firstAidKit: t.integer("first_aid_kit", { mode: "boolean" }).default(false),
    shovel: t.integer("shovel", { mode: "boolean" }).default(false),
    axe: t.integer("axe", { mode: "boolean" }).default(false),
    trackShovel: t.integer("track_shovel", { mode: "boolean" }).default(false),
    greaseGun: t.integer("grease_gun", { mode: "boolean" }).default(false),
    windshieldWiperAndWash: t.integer("windshield_wiper_and_wash", { mode: "boolean" }).default(false),
    heatingAndDefrostingSystem: t.integer("heating_and_defrosting_system", { mode: "boolean" }).default(false),
    startingSwitch: t.integer("starting_switch", { mode: "boolean" }).default(false),
    lampsAndReflectors: t.integer("lamps_and_reflectors", { mode: "boolean" }).default(false),
  
    // Inspection Checklist - Additional Components
    tires: t.integer("tires", { mode: "boolean" }).default(false),
    wheels: t.integer("wheels", { mode: "boolean" }).default(false),
    diffs: t.integer("diffs", { mode: "boolean" }).default(false),
    coolant: t.integer("coolant", { mode: "boolean" }).default(false),
    vhfRadio: t.integer("vhf_radio", { mode: "boolean" }).default(false),
    amFmRadio: t.integer("am_fm_radio", { mode: "boolean" }).default(false),
    grease: t.integer("grease", { mode: "boolean" }).default(false),
    airFilter: t.integer("air_filter", { mode: "boolean" }).default(false),
    airConditioning: t.integer("air_conditioning", { mode: "boolean" }).default(false),
    fanBelts: t.integer("fan_belts", { mode: "boolean" }).default(false),
  
    // Lubrication Section
    planetaryOil: t.integer("planetary_oil", { mode: "boolean" }).default(false),
    hydraulicOil: t.integer("hydraulic_oil", { mode: "boolean" }).default(false),
    drumOil: t.integer("drum_oil", { mode: "boolean" }).default(false),
    engineOil: t.integer("engine_oil", { mode: "boolean" }).default(false),
    transmissionOil: t.integer("transmission_oil", { mode: "boolean" }).default(false),
    winchOil: t.integer("winch_oil", { mode: "boolean" }).default(false),
    swingOil: t.integer("swing_oil", { mode: "boolean" }).default(false),
  
    maintenanceNotes: t.text("maintenance_notes"),
    createdAt: t
      .integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: t
      .integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  }));
  
  // Maintenance Items Table (Parts used)
  export const maintenanceItems = sqliteTable("maintenance_items", (t) => ({
    id: t
      .text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    maintenanceLogId: t
      .text("maintenance_log_id")
      .notNull()
      .references(() => maintenanceLogs.id, { onDelete: "cascade" }),
    itemName: t.text("item_name").notNull(),
    itemDescription: t.text("item_description"),
    quantity: t.integer("quantity").notNull().default(1),
    unitCost: real("unit_cost"), // Cost per item
    totalCost: real("total_cost"), // quantity * unitCost
    createdAt: t
      .integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  }));
  

export const maintenanceLogRelations = relations(maintenanceLogs, ({ one, many }) => ({
    truck: one(trucks, {
      fields: [maintenanceLogs.truckId],
      references: [trucks.id],
    }),
    maintenanceStaff: one(users, {
      fields: [maintenanceLogs.maintenanceStaffId],
      references: [users.id],
      relationName: "maintenance_staff",
    }),
    itemsUsed: many(maintenanceItems),
  }));

  export const maintenanceItemRelations = relations(maintenanceItems, ({ one }) => ({
    maintenanceLog: one(maintenanceLogs, {
      fields: [maintenanceItems.maintenanceLogId],
      references: [maintenanceLogs.id],
    }),
  }));