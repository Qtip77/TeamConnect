import { zValidator } from "@hono/zod-validator";
import { eq, and, sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2"; // Import for generating IDs if needed, though DB does it.

import honoFactory from "../hono-factory";
import { timesheets, trucks } from "../db/timesheet-schema.sql";
import { users } from "../db/auth-schema.sql";
import { timesheetCreateSchema, timesheetUpdateSchema } from "../validations/timesheet.schema"; // Ensure this path is correct

const timesheetsRoute = honoFactory
  .createApp()
  // Create a new timesheet (Driver only)
  .post("/", zValidator("json", timesheetCreateSchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user");

    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Consider an explicit role check here if not all authenticated users can create
    if (user.role !== "driver" && user.role !== "admin") { // Allowing admin to also create for testing/flexibility
        return c.json({ error: "Forbidden: Only drivers or admins can create timesheets" }, 403);
    }

    const validJson = c.req.valid("json");

    try {
      const result = await db.transaction(async (tx) => {
        // 1. Ensure truckId provided exists
        const truckExists = await tx.query.trucks.findFirst({
          where: eq(trucks.id, validJson.truckId),
        });
        if (!truckExists) {
          // This will rollback the transaction
          throw new Error("Invalid truckId: Truck not found");
        }

        // 2. Construct timesheetData
        const timesheetData: typeof timesheets.$inferInsert = {
          // id: createId(), // DB handles this with $defaultFn
          driverId: user.id,
          truckId: validJson.truckId,
          shiftStartDate: new Date(validJson.shiftStartDate * 1000),
          // Handle optional shiftEndDate: if it's null/undefined from schema, it should be null for DB
          shiftEndDate: validJson.shiftEndDate ? new Date(validJson.shiftEndDate * 1000) : null,
          startOdometerReading: validJson.startOdometerReading,
          endOdometerReading: validJson.endOdometerReading,
          notes: validJson.notes,
          status: "pending", // Default status
          // createdAt and updatedAt are handled by DB defaults
        };

        // 3. Insert the new timesheet
        const newTimesheetArray = await tx.insert(timesheets).values(timesheetData).returning();
        if (newTimesheetArray.length === 0) {
          throw new Error("Failed to create timesheet entry");
        }
        const newTimesheet = newTimesheetArray[0];

        // 4. Update the truck's lastOdometerReading
        //    Only update if the new endOdometerReading is greater than the current lastOdometerReading,
        //    or if you always want the latest timesheet to dictate this value.
        //    For simplicity, we'll set it to the new endOdometerReading.
        //    Consider if startOdometerReading should also influence truck's lastOdometerReading
        //    (e.g. if it's higher than current DB value - might indicate an issue or correction)
        await tx
          .update(trucks)
          .set({ 
            lastOdometerReading: validJson.endOdometerReading,
            updatedAt: new Date() // Also update the truck's updatedAt timestamp
          })
          .where(eq(trucks.id, validJson.truckId));
        
        return newTimesheet;
      });

      return c.json(result, 201);

    } catch (error: any) {
      if (error.message === "Invalid truckId: Truck not found") {
        return c.json({ error: error.message }, 400);
      }
      console.error("Timesheet creation error:", error); // Log detailed error for server admin
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
        with: { 
          driver: { columns: { name: true, email: true, id: true } }, 
          truck: { columns: { unitNumber: true, id: true } },
          approver: { columns: { name: true, id: true } },
        },
        orderBy: (timesheets, { desc }) => [desc(timesheets.createdAt)],
      });
    } else if (user.role === "driver") {
      query = db.query.timesheets.findMany({
        where: eq(timesheets.driverId, user.id),
        with: {
          truck: { columns: { unitNumber: true, id: true } },
          approver: { columns: { name: true, id: true } },
        },
        orderBy: (timesheets, { desc }) => [desc(timesheets.createdAt)],
      });
    } else { 
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
        truck: { columns: { unitNumber: true, id: true } }, // Added id
        approver: { columns: { name: true, id: true } }, // Added id
      }
    });

    if (!timesheet) {
      return c.json({ error: "Timesheet not found" }, 404);
    }

    if (user.role === "driver" && timesheet.driverId !== user.id) {
      return c.json({ error: "Forbidden: You can only view your own timesheets" }, 403);
    }
    if (user.role !== "admin" && user.role !== "driver") { 
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
    
    try {
      const updatedTimesheetResult = await db.transaction(async (tx) => {
        const existingTimesheet = await tx.query.timesheets.findFirst({
          where: eq(timesheets.id, timesheetId),
        });

        if (!existingTimesheet) {
          throw new Error("Timesheet not found");
        }

        let updatePayload: Partial<Omit<typeof timesheets.$inferInsert, 'id' | 'createdAt' | 'driverId'>> = {};

        // Admin can update more fields
        if (user.role === "admin") {
          const { status, shiftStartDate, shiftEndDate, approvedAt, truckId, startOdometerReading, endOdometerReading, notes, rejectionReason, billingRateId, totalBilledAmount } = validJson;
          
          // General fields admin can update
          if (truckId !== undefined) {
             const truckExists = await tx.query.trucks.findFirst({ where: eq(trucks.id, truckId) });
             if (!truckExists) throw new Error("Invalid new truckId: Truck not found");
             updatePayload.truckId = truckId;
          }
          if (startOdometerReading !== undefined) updatePayload.startOdometerReading = startOdometerReading;
          if (endOdometerReading !== undefined) updatePayload.endOdometerReading = endOdometerReading;
          if (notes !== undefined) updatePayload.notes = notes;
          if (rejectionReason !== undefined) updatePayload.rejectionReason = rejectionReason;
          if (billingRateId !== undefined) updatePayload.billingRateId = billingRateId;
          if (totalBilledAmount !== undefined) updatePayload.totalBilledAmount = totalBilledAmount;


          if (shiftStartDate !== undefined) {
            updatePayload.shiftStartDate = new Date(shiftStartDate * 1000);
          }
          if (shiftEndDate !== undefined) { // Can be null
            updatePayload.shiftEndDate = shiftEndDate ? new Date(shiftEndDate * 1000) : null;
          }
        
          if (status !== undefined) {
            updatePayload.status = status;
            if (status === "approved") {
              updatePayload.approvedBy = user.id;
              updatePayload.approvedAt = new Date(); // Use current date for approval
              updatePayload.rejectionReason = null;
            } else if (status === "rejected") {
              updatePayload.approvedBy = null;
              updatePayload.approvedAt = null;
              updatePayload.rejectionReason = validJson.rejectionReason !== undefined ? validJson.rejectionReason : "Rejected by admin.";
            } else if (status === "pending") {
              updatePayload.approvedBy = null;
              updatePayload.approvedAt = null;
              updatePayload.rejectionReason = null;
            }
          } else if (approvedAt !== undefined && typeof approvedAt === 'number') { // legacy?
             updatePayload.approvedAt = new Date(approvedAt * 1000);
          }

        } else if (user.role === "driver") {
          if (existingTimesheet.driverId !== user.id) {
            throw new Error("Forbidden: You can only edit your own timesheets");
          }
          if (existingTimesheet.status !== "pending" && existingTimesheet.status !== "rejected") {
            throw new Error("Forbidden: You can only edit pending or rejected timesheets");
          }
          
          const { shiftStartDate, shiftEndDate, startOdometerReading, endOdometerReading, notes, truckId } = validJson;
          const allowedDriverUpdates: Partial<typeof timesheets.$inferInsert> = {};
          if (shiftStartDate !== undefined) allowedDriverUpdates.shiftStartDate = new Date(shiftStartDate * 1000);
          if (shiftEndDate !== undefined) allowedDriverUpdates.shiftEndDate = shiftEndDate ? new Date(shiftEndDate * 1000) : null;
          if (startOdometerReading !== undefined) allowedDriverUpdates.startOdometerReading = startOdometerReading;
          if (endOdometerReading !== undefined) allowedDriverUpdates.endOdometerReading = endOdometerReading;
          if (notes !== undefined) allowedDriverUpdates.notes = notes;
          
          if (truckId !== undefined) {
            const truckExists = await tx.query.trucks.findFirst({ where: eq(trucks.id, truckId) });
            if (!truckExists) throw new Error("Invalid new truckId: Truck not found");
            allowedDriverUpdates.truckId = truckId;
          }
          updatePayload = allowedDriverUpdates;

          // If a driver edits a rejected timesheet, move it back to pending
          if (existingTimesheet.status === "rejected") {
            updatePayload.status = "pending";
            updatePayload.rejectionReason = null;
            updatePayload.approvedBy = null;
            updatePayload.approvedAt = null;
          }
        } else {
          throw new Error("Forbidden: Insufficient permissions");
        }

        if (Object.keys(updatePayload).length === 0) {
          // return c.json({ message: "No changes to apply" }, 200); // Return existing if no changes
          return existingTimesheet; // Or just return the existing one
        }

        updatePayload.updatedAt = new Date();

        const updatedArr = await tx
          .update(timesheets)
          .set(updatePayload)
          .where(eq(timesheets.id, timesheetId))
          .returning();
        
        if(updatedArr.length === 0) throw new Error("Update failed or timesheet not found post-check");

        // If odometer readings were changed, update the truck's lastOdometerReading
        // This should be the endOdometer of THIS timesheet if it's the latest or being corrected.
        // More complex logic might be needed if multiple timesheets for a truck can be edited out of order.
        // For now, if endOdometerReading is part of the update, we update the truck.
        if (updatePayload.endOdometerReading !== undefined && updatePayload.truckId) {
             // Check if this timesheet is the one that last set the odometer reading for the truck,
             // or if its endOdometerReading is now the highest.
             // For simplicity, just update it if changed.
            await tx.update(trucks)
                .set({ 
                    lastOdometerReading: updatePayload.endOdometerReading,
                    updatedAt: new Date() 
                })
                .where(eq(trucks.id, updatePayload.truckId));
        } else if (updatePayload.endOdometerReading !== undefined && existingTimesheet.truckId) {
            // If truckId wasn't changed in this payload, use existingTimesheet.truckId
             await tx.update(trucks)
                .set({ 
                    lastOdometerReading: updatePayload.endOdometerReading,
                    updatedAt: new Date() 
                })
                .where(eq(trucks.id, existingTimesheet.truckId));
        }
        
        return updatedArr[0];
      });
      return c.json(updatedTimesheetResult);

    } catch (error: any) {
      if (error.message.includes("Forbidden") || error.message.includes("Invalid")) {
        return c.json({ error: error.message }, error.message.includes("Forbidden") ? 403 : 400);
      }
      if (error.message === "Timesheet not found") {
         return c.json({ error: "Timesheet not found" }, 404);
      }
      console.error("Timesheet update error:", error);
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

    // It might be good to also consider what happens to truck's lastOdometerReading.
    // If the deleted timesheet was the one that set it, it might need recalculation from other timesheets.
    // This is complex. For now, deletion won't auto-correct truck's odometer.
    
    try {
      const existingTimesheet = await db.query.timesheets.findFirst({
        where: eq(timesheets.id, timesheetId),
      });
      if (!existingTimesheet) {
        return c.json({ error: "Timesheet not found" }, 404);
      }

      const deletedTimesheet = await db.delete(timesheets).where(eq(timesheets.id, timesheetId)).returning();
      // No need to check length of deletedTimesheet again if findFirst passed.
      return c.json({ message: "Timesheet deleted successfully", timesheet: deletedTimesheet[0] });
    } catch (error: any) {
      // Foreign key constraints or other DB errors
      console.error("Timesheet deletion error:", error);
      return c.json({ error: "Failed to delete timesheet", details: error.message }, 500);
    }
  });

export default timesheetsRoute; 