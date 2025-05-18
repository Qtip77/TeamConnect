import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";

import { trucks } from "../db/timesheet-schema.sql"; // trucks table is in timesheet-schema
import honoFactory from "../hono-factory";
import { truckCreateSchema, truckUpdateSchema } from "../validations/truck.schema";
import { users } from "../db/auth-schema.sql"; // For user roles

const trucksRoute = honoFactory
  .createApp()
  // List all trucks (all roles)
  .get("/", async (c) => {
    const db = c.get("db");
    const allTrucks = await db.query.trucks.findMany();
    return c.json(allTrucks);
  })
  // Create a new truck (Admin only)
  .post("/", zValidator("json", truckCreateSchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user");

    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    // Assuming 'admin' role covers 'Manager' responsibilities
    if (user.role !== "admin") {
      return c.json({ error: "Forbidden" }, 403);
    }

    const validJson = c.req.valid("json");
    
    try {
      // Drizzle will use default values for fields like id, createdAt, updatedAt if not provided
      // and if they have defaults in the schema (e.g. $defaultFn, .default())
      const newTruck = await db.insert(trucks).values(validJson).returning();
      if (newTruck.length === 0) {
        return c.json({ error: "Failed to create truck" }, 500);
      }
      return c.json(newTruck[0], 201);
    } catch (error: any) {
      // Catch potential unique constraint errors (e.g., unitNumber, serialNumber)
      if (error.message?.includes("UNIQUE constraint failed")) {
        return c.json({ error: "Truck with this unit number or serial number already exists" }, 409);
      }
      return c.json({ error: "Failed to create truck", details: error.message }, 500);
    }
  })
  // Get a specific truck by ID (all roles)
  .get("/:id", async (c) => {
    const db = c.get("db");
    const truckId = c.req.param("id");
    const truck = await db.query.trucks.findFirst({
      where: eq(trucks.id, truckId),
    });

    if (!truck) {
      return c.json({ error: "Truck not found" }, 404);
    }
    return c.json(truck);
  })
  // Update a truck (Admin only)
  .patch("/:id", zValidator("json", truckUpdateSchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const truckId = c.req.param("id");

    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    if (user.role !== "admin") {
      return c.json({ error: "Forbidden" }, 403);
    }

    const validJson = c.req.valid("json");

    // Check if truck exists before attempting update
    const existingTruck = await db.query.trucks.findFirst({
        where: eq(trucks.id, truckId),
    });
    if (!existingTruck) {
        return c.json({ error: "Truck not found" }, 404);
    }

    try {
      const updatedTruck = await db
        .update(trucks)
        .set({
          ...validJson,
          updatedAt: new Date(), // Drizzle/SQLite handles this if schema has .default(sql`(unixepoch())`) on update trigger or similar logic
                                // but explicitly setting it is safer for some setups.
                                // timesheet-schema.sql.ts has updatedAt .default(sql`(unixepoch())`) which might only apply on insert.
                                // For updates, it's better to set it manually if not auto-updated by DB triggers.
                                // Given the schema, it should auto-update. Let's rely on the schema's default for updatedAt if possible,
                                // or be explicit: updatedAt: Math.floor(Date.now() / 1000) if it's a number timestamp.
                                // The schema defines updatedAt as integer with mode "timestamp" and default(sql`(unixepoch())`).
                                // This default likely applies on insert. For update, we should set it.
                                // Let's assume the hono/drizzle setup handles this, or it should be `updatedAt: sql\`(unixepoch())\` if using drizzle orm update.
                                // For simplicity with .set(), we might need to pass the value. If it's a Date object, Drizzle handles conversion for timestamp mode.
                                // Or, if number (unix seconds), then Math.floor(Date.now()/1000)
                                // The createSelectSchema has preprocess for number -> Date -> string. Let's send Date obj for consistency. 
        })
        .where(eq(trucks.id, truckId))
        .returning();
     
      if (updatedTruck.length === 0) {
        // This case should ideally be caught by the prior existence check, but good for safety.
        return c.json({ error: "Truck not found or failed to update" }, 404);
      }
      return c.json(updatedTruck[0]);
    } catch (error: any) {
      if (error.message?.includes("UNIQUE constraint failed")) {
        return c.json({ error: "Update failed: unit number or serial number conflict" }, 409);
      }
      return c.json({ error: "Failed to update truck", details: error.message }, 500);
    }
  })
  // Delete a truck (Admin only)
  .delete("/:id", async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const truckId = c.req.param("id");

    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    if (user.role !== "admin") {
      return c.json({ error: "Forbidden" }, 403);
    }

    // Check if truck exists
    const existingTruck = await db.query.trucks.findFirst({
        where: eq(trucks.id, truckId),
    });
    if (!existingTruck) {
        return c.json({ error: "Truck not found" }, 404);
    }

    try {
      // Note: Consider impact of deleting truck on existing timesheets (truckId references trucks.id)
      // The timesheets schema has `onDelete: "restrict"` for truckId.
      // This means deleting a truck that is referenced by any timesheet will fail.
      // This is generally good to prevent data integrity issues.
      // The error will be caught by the generic error handler below.
      const deletedTruck = await db.delete(trucks).where(eq(trucks.id, truckId)).returning();
      if (deletedTruck.length === 0) {
          return c.json({ error: "Truck not found or failed to delete" }, 404);
      }
      return c.json({ message: "Truck deleted successfully", truck: deletedTruck[0] });
    } catch (error: any) {
       if (error.message?.includes("FOREIGN KEY constraint failed")) {
        return c.json({ error: "Cannot delete truck: it is referenced by existing timesheets." }, 409);
      }
      return c.json({ error: "Failed to delete truck", details: error.message }, 500);
    }
  });

export default trucksRoute; 