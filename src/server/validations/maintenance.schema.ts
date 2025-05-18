import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";

import { maintenanceLogs, maintenanceItems } from "../db/maintenance-schema.sql";

export const maintenanceLogSchema = createSelectSchema(maintenanceLogs, {
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  inspectionDate: z.number(),
  inspectionTime: z.string(),
  inspectorName: z.string(),
  locationOfInspection: z.string(),
});
export type MaintenanceLog = z.infer<typeof maintenanceLogSchema>;

export const maintenanceItemSchema = createSelectSchema(maintenanceItems, {
  createdAt: z.string().datetime(),
});
export type MaintenanceItem = z.infer<typeof maintenanceItemSchema>;

export const maintenanceLogCreateSchema = createInsertSchema(maintenanceLogs, {
    truckId: z.string(),
    maintenanceStaffId: z.string(),
    inspectionDate: z.number(),
    inspectionTime: z.string(),
    inspectorName: z.string(),
    locationOfInspection: z.string(),
    odometerReading: z.number(),

    // Inspection Checklist - Vehicle Systems
    bodyAndSeats: z.boolean(),
    chassisFrame: z.boolean(),
    underbody: z.boolean(),
    driverShaft: z.boolean(),
    windowsAndMirror: z.boolean(),
    fuel: z.boolean(),
    exhaust: z.boolean(),
    frictionComponents: z.boolean(),
    hydraulicAndVacuumAssistBrake: z.boolean(),
    mechanicalComponents: z.boolean(),
    brakePedal: z.boolean(),
    
    // Inspection Checklist - Mechanical Systems
    airBrakeSystem: z.boolean(),
    parkBrake: z.boolean(),
    brakeSystem: z.boolean(),
    engineControls: z.boolean(),
    steeringColumnAndBox: z.boolean(),
    wheelAlignment: z.boolean(),
    steeringLinkage: z.boolean(),
    suspension: z.boolean(),
    generalRequirements: z.boolean(),
    fireExtinguisher: z.boolean(),
    spillKit: z.boolean(),
    firstAidKit: z.boolean(),
    shovel: z.boolean(),
    axe: z.boolean(),
    trackShovel: z.boolean(),
    greaseGun: z.boolean(),
    windshieldWiperAndWash: z.boolean(),
    heatingAndDefrostingSystem: z.boolean(),
    startingSwitch: z.boolean(),
    lampsAndReflectors: z.boolean(),

    // Inspection Checklist - Additional Components
    tires: z.boolean(),
    wheels: z.boolean(),
    diffs: z.boolean(),
    coolant: z.boolean(),
    vhfRadio: z.boolean(),
    amFmRadio: z.boolean(),
    grease: z.boolean(),
    airFilter: z.boolean(),
    airConditioning: z.boolean(),
    fanBelts: z.boolean(),

    // Lubrication Section
    planetaryOil: z.boolean(),
    hydraulicOil: z.boolean(),
    drumOil: z.boolean(),
    engineOil: z.boolean(),
    transmissionOil: z.boolean(),
    winchOil: z.boolean(),
    swingOil: z.boolean(),

    // Maintenance Notes
    maintenanceNotes: z.string(),
});
export type MaintenanceLogCreate = z.infer<typeof maintenanceLogCreateSchema>;

export const maintenanceItemCreateSchema = createInsertSchema(maintenanceItems, {
  itemName: z.string(),
  itemDescription: z.string(),
  quantity: z.number(),
  unitCost: z.number(),
  totalCost: z.number(),
});
export type MaintenanceItemCreate = z.infer<typeof maintenanceItemCreateSchema>;

export const maintenanceItemUpdateSchema = createUpdateSchema(maintenanceItems, {
  // Override fields if necessary
  itemName: z.string().optional(),
  itemDescription: z.string().optional(),
  quantity: z.number().optional(),
  unitCost: z.number().optional(),
  totalCost: z.number().optional(),
});
export type MaintenanceItemUpdate = z.infer<typeof maintenanceItemUpdateSchema>;

export const maintenanceLogUpdateSchema = createUpdateSchema(maintenanceLogs, {
  // Override fields if necessary, similar to createInsertSchema
  // All fields will be optional by default
  truckId: z.string().optional(),
  locationOfInspection: z.string().optional(),
  odometerReading: z.number().optional(),

  // Inspection Checklist - Vehicle Systems
  bodyAndSeats: z.boolean().optional(),
  chassisFrame: z.boolean().optional(),
  underbody: z.boolean().optional(),
  driverShaft: z.boolean().optional(),
  windowsAndMirror: z.boolean().optional(),
  fuel: z.boolean().optional(),
  exhaust: z.boolean().optional(),
  frictionComponents: z.boolean().optional(),
  hydraulicAndVacuumAssistBrake: z.boolean().optional(),
  mechanicalComponents: z.boolean().optional(),
  brakePedal: z.boolean().optional(),
  
  // Inspection Checklist - Mechanical Systems
  airBrakeSystem: z.boolean().optional(),
  parkBrake: z.boolean().optional(),
  brakeSystem: z.boolean().optional(),
  engineControls: z.boolean().optional(),
  steeringColumnAndBox: z.boolean().optional(),
  wheelAlignment: z.boolean().optional(),
  steeringLinkage: z.boolean().optional(),
  suspension: z.boolean().optional(),
  generalRequirements: z.boolean().optional(),
  fireExtinguisher: z.boolean().optional(),
  spillKit: z.boolean().optional(),
  firstAidKit: z.boolean().optional(),
  shovel: z.boolean().optional(),
  axe: z.boolean().optional(),
  trackShovel: z.boolean().optional(),
  greaseGun: z.boolean().optional(),
  windshieldWiperAndWash: z.boolean().optional(),
  heatingAndDefrostingSystem: z.boolean().optional(),
  startingSwitch: z.boolean().optional(),
  lampsAndReflectors: z.boolean().optional(),

  // Inspection Checklist - Additional Components
  tires: z.boolean().optional(),
  wheels: z.boolean().optional(),
  diffs: z.boolean().optional(),
  coolant: z.boolean().optional(),
  vhfRadio: z.boolean().optional(),
  amFmRadio: z.boolean().optional(),
  grease: z.boolean().optional(),
  airFilter: z.boolean().optional(),
  airConditioning: z.boolean().optional(),
  fanBelts: z.boolean().optional(),

  // Lubrication Section
  planetaryOil: z.boolean().optional(),
  hydraulicOil: z.boolean().optional(),
  drumOil: z.boolean().optional(),
  engineOil: z.boolean().optional(),
  transmissionOil: z.boolean().optional(),
  winchOil: z.boolean().optional(),
  swingOil: z.boolean().optional(),

  // Maintenance Notes
  maintenanceNotes: z.string().optional(),
});

  
export type MaintenanceLogUpdate = z.infer<typeof maintenanceLogUpdateSchema>;



