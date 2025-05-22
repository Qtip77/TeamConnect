import { zValidator } from "@hono/zod-validator";
import { eq, and, sql } from "drizzle-orm";

import honoFactory from "../hono-factory";
import { timesheets, trucks } from "../db/timesheet-schema.sql"; // timesheets, users (for relations), trucks (for relations)
// users table is actually in auth-schema.sql, so need to import that separately for direct user queries if any beyond relations.
import { users } from "../db/auth-schema.sql";  
import { timesheetCreateSchema, timesheetUpdateSchema } from "../validations/timesheet.schema";

const timesheetsRoute = honoFactory
  .createApp()
  // Create a new timesheet (Driver only)
  .post("/", zValidator("json", timesheetCreateSchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user");

    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    // Any authenticated user can create a timesheet, driverId will be user.id
    // Role check might be implicit (e.g. only drivers have access to this part of UI)
    // or explicit if other roles should be blocked from creating.
    // For now, assume any authenticated user can submit, their ID becomes driverId.

    const validJson = c.req.valid("json");

    // Ensure truckId provided exists
    if (validJson.truckId) {
      const truckExists = await db.query.trucks.findFirst({ where: eq(trucks.id, validJson.truckId) });
      if (!truckExists) {
        return c.json({ error: "Invalid truckId: Truck not found" }, 400);
      }
    }

    // Explicitly construct timesheetData to ensure correct types
    const timesheetData: typeof timesheets.$inferInsert = {
      driverId: user.id,
      truckId: validJson.truckId,
      shiftStartDate: new Date(validJson.shiftStartDate * 1000),
      shiftEndDate: new Date(validJson.shiftEndDate * 1000),
      startOdometerReading: validJson.startOdometerReading,
      endOdometerReading: validJson.endOdometerReading,
      notes: validJson.notes, // notes is optional in schema, so validJson.notes could be undefined
      status: "pending", // Ensure status is pending on creation
      // id, createdAt, updatedAt, approvedBy, approvedAt, rejectionReason, billingStatus, etc.,
      // will be handled by DB defaults or subsequent updates.
    };

    try {
      const newTimesheet = await db.insert(timesheets).values(timesheetData).returning();
      if (newTimesheet.length === 0) {
        return c.json({ error: "Failed to create timesheet" }, 500);
      }
      return c.json(newTimesheet[0], 201);
    } catch (error: any) {
      return c.json({ error: "Failed to create timesheet", details: error.message }, 500);
    }
  })
  // List timesheets (Admin: all, Driver: their own)
  .get("/", async (c) => {
    const db = c.get("db");
    const user = c.get("user");

    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    let query;
    if (user.role === "admin") { // Assuming admin role covers Manager
      query = db.query.timesheets.findMany({
        with: { // Example of loading relations
          driver: { columns: { name: true, email: true } }, // from users table
          truck: { columns: { unitNumber: true } },
          approver: { columns: { name: true } },
        },
        orderBy: (timesheets, { desc }) => [desc(timesheets.createdAt)],
      });
    } else if (user.role === "driver") {
      query = db.query.timesheets.findMany({
        where: eq(timesheets.driverId, user.id),
        with: {
          truck: { columns: { unitNumber: true } },
          approver: { columns: { name: true } },
        },
        orderBy: (timesheets, { desc }) => [desc(timesheets.createdAt)],
      });
    } else { // Other roles like 'maintenance' if they exist and have no specific timesheet view logic
      return c.json({ error: "Forbidden: Insufficient permissions" }, 403);
    }

    const result = await query;
    return c.json(result);
  })
  // Get a specific timesheet by ID
  .get("/:id", async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const timesheetId = c.req.param("id");

    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const timesheet = await db.query.timesheets.findFirst({
      where: eq(timesheets.id, timesheetId),
      with: {
        driver: { columns: { name: true, email: true, id: true } },
        truck: { columns: { unitNumber: true } },
        approver: { columns: { name: true } },
      }
    });

    if (!timesheet) {
      return c.json({ error: "Timesheet not found" }, 404);
    }

    // Admin can access any. Driver can only access their own.
    if (user.role === "driver" && timesheet.driverId !== user.id) {
      return c.json({ error: "Forbidden: You can only view your own timesheets" }, 403);
    }
    // Allow admin role without further checks on driverId
    if (user.role !== "admin" && user.role !== "driver") { // e.g. maintenance role
      return c.json({ error: "Forbidden: Insufficient permissions" }, 403);
    }

    return c.json(timesheet);
  })
  // Update a timesheet
  .patch("/:id", zValidator("json", timesheetUpdateSchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const timesheetId = c.req.param("id");
    const validJson = c.req.valid("json");

    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const existingTimesheet = await db.query.timesheets.findFirst({
      where: eq(timesheets.id, timesheetId),
    });

    if (!existingTimesheet) {
      return c.json({ error: "Timesheet not found" }, 404);
    }

    let updatePayload: Partial<typeof timesheets.$inferInsert> = {};

    if (user.role === "admin") { // Admin/Manager can update most fields
      // Selectively build the update payload to manage types correctly
      const { status, shiftStartDate, shiftEndDate, approvedAt, ...restOfAdminJson } = validJson;
      updatePayload = { ...restOfAdminJson };

      if (shiftStartDate !== undefined) {
        updatePayload.shiftStartDate = new Date(shiftStartDate * 1000);
      }
      if (shiftEndDate !== undefined) {
        updatePayload.shiftEndDate = new Date(shiftEndDate * 1000);
      }

      // Handle status and related fields explicitly
      if (status !== undefined) {
        updatePayload.status = status; // status from validJson should be "pending" | "approved" | "rejected"
        if (status === "approved") {
          updatePayload.approvedBy = user.id;
          updatePayload.approvedAt = new Date();
          updatePayload.rejectionReason = null; 
          
          // Update the associated truck's lastOdometerReading when timesheet is approved
          if (existingTimesheet.truckId && existingTimesheet.endOdometerReading) {
            try {
              await db
                .update(trucks)
                .set({
                  lastOdometerReading: existingTimesheet.endOdometerReading,
                  updatedAt: new Date()
                })
                .where(eq(trucks.id, existingTimesheet.truckId));
            } catch (error: any) {
              console.error("Failed to update truck odometer reading:", error.message);
              // Continue with timesheet approval even if truck update fails
            }
          }
        } else if (status === "rejected") {
          updatePayload.approvedBy = null;
          updatePayload.approvedAt = null;
          // rejectionReason is part of restOfAdminJson if provided, or handle explicitly:
          updatePayload.rejectionReason = validJson.rejectionReason !== undefined ? validJson.rejectionReason : null;
        } else if (status === "pending") {
          updatePayload.approvedBy = null;
          updatePayload.approvedAt = null;
          updatePayload.rejectionReason = null;
        }
      } else {
        // If status is not in validJson, but approvedAt (as a number) is, convert it.
        // This case implies an update to approvedAt without changing status, which might be unusual.
        if (approvedAt !== undefined && typeof approvedAt === 'number') {
          updatePayload.approvedAt = new Date(approvedAt * 1000);
        }
      }

    } else if (user.role === "driver") {
      if (existingTimesheet.driverId !== user.id) {
        return c.json({ error: "Forbidden: You can only edit your own timesheets" }, 403);
      }
      if (existingTimesheet.status !== "pending" && existingTimesheet.status !== "rejected") {
        return c.json({ error: "Forbidden: You can only edit pending or rejected timesheets" }, 403);
      }
      // Drivers can update specific fields for their pending/rejected timesheets
      const allowedDriverUpdates: Partial<typeof timesheets.$inferInsert> = {};
      if (validJson.shiftStartDate !== undefined) allowedDriverUpdates.shiftStartDate = new Date(validJson.shiftStartDate * 1000);
      if (validJson.shiftEndDate !== undefined) allowedDriverUpdates.shiftEndDate = new Date(validJson.shiftEndDate * 1000);
      if (validJson.startOdometerReading !== undefined) allowedDriverUpdates.startOdometerReading = validJson.startOdometerReading;
      if (validJson.endOdometerReading !== undefined) allowedDriverUpdates.endOdometerReading = validJson.endOdometerReading;
      if (validJson.notes !== undefined) allowedDriverUpdates.notes = validJson.notes;
      if (validJson.truckId !== undefined) {
        // Ensure new truckId exists if changed
        const truckExists = await db.query.trucks.findFirst({ where: eq(trucks.id, validJson.truckId) });
        if (!truckExists) {
          return c.json({ error: "Invalid new truckId: Truck not found" }, 400);
        }
        allowedDriverUpdates.truckId = validJson.truckId;
      }
      // Driver cannot change status, approval details, billing details etc.
      updatePayload = allowedDriverUpdates;
      // If a driver edits a rejected timesheet, it should probably go back to pending? Or stay rejected but updated?
      // For now, status is not changed by driver update. Admin has to re-evaluate.
      // If it should go back to pending upon driver edit: updatePayload.status = "pending"; updatePayload.rejectionReason = null;
    } else {
      return c.json({ error: "Forbidden: Insufficient permissions" }, 403);
    }

    if (Object.keys(updatePayload).length === 0) {
      return c.json({ message: "No changes to apply" }, 200); // Or 304 Not Modified, or 400 if update expected
    }

    updatePayload.updatedAt = new Date(); // Explicitly set updatedAt using current Date

    try {
      const updatedTimesheet = await db
        .update(timesheets)
        .set(updatePayload)
        .where(eq(timesheets.id, timesheetId))
        .returning();

      if (updatedTimesheet.length === 0) {
        return c.json({ error: "Failed to update timesheet or timesheet not found" }, 500); // Should be caught by findFirst earlier
      }
      return c.json(updatedTimesheet[0]);
    } catch (error: any) {
      return c.json({ error: "Failed to update timesheet", details: error.message }, 500);
    }
  })
  // Delete a timesheet (Admin only)
  .delete("/:id", async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const timesheetId = c.req.param("id");

    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    if (user.role !== "admin") {
      return c.json({ error: "Forbidden: Only admins can delete timesheets" }, 403);
    }

    const existingTimesheet = await db.query.timesheets.findFirst({
      where: eq(timesheets.id, timesheetId),
    });
    if (!existingTimesheet) {
      return c.json({ error: "Timesheet not found" }, 404);
    }

    try {
      const deletedTimesheet = await db.delete(timesheets).where(eq(timesheets.id, timesheetId)).returning();
      if (deletedTimesheet.length === 0) {
        return c.json({ error: "Timesheet not found or failed to delete" }, 404); // Should be caught by findFirst
      }
      return c.json({ message: "Timesheet deleted successfully", timesheet: deletedTimesheet[0] });
    } catch (error: any) {
      return c.json({ error: "Failed to delete timesheet", details: error.message }, 500);
    }
  });

export default timesheetsRoute; 