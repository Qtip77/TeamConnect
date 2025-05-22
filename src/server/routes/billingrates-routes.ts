import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";

import honoFactory from "../hono-factory";
import { billingRates } from "../db/timesheet-schema.sql";
import { billingRateCreateSchema, billingRateUpdateSchema } from "../validations/timesheet.schema";

const billingRatesRoute = honoFactory
  .createApp()
  // Create a new billing rate (Admin only)
  .post("/", zValidator("json", billingRateCreateSchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user");

    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    
    if (user.role !== "admin") {
      return c.json({ error: "Forbidden: Only admins can manage billing rates" }, 403);
    }

    const validJson = c.req.valid("json");

    // Construct billing rate data with user ID as creator
    const billingRateData: typeof billingRates.$inferInsert = {
      rateName: validJson.rateName,
      ratePerHour: validJson.ratePerHour,
      currency: validJson.currency,
      description: validJson.description,
      isActive: validJson.isActive ?? true,
      createdBy: user.id,
      // id, createdAt, updatedAt will be handled by DB defaults
    };

    try {
      const newBillingRate = await db.insert(billingRates).values(billingRateData).returning();
      if (newBillingRate.length === 0) {
        return c.json({ error: "Failed to create billing rate" }, 500);
      }
      return c.json(newBillingRate[0], 201);
    } catch (error: any) {
      return c.json({ error: "Failed to create billing rate", details: error.message }, 500);
    }
  })
  // List all billing rates (Admin only)
  .get("/", async (c) => {
    const db = c.get("db");
    const user = c.get("user");

    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    
    if (user.role !== "admin") {
      return c.json({ error: "Forbidden: Only admins can view billing rates" }, 403);
    }

    try {
      // Assuming no relation is set up in the schema
      const rates = await db.query.billingRates.findMany({
        orderBy: (billingRates, { desc }) => [desc(billingRates.createdAt)],
      });
      
      return c.json(rates);
    } catch (error: any) {
      return c.json({ error: "Failed to fetch billing rates", details: error.message }, 500);
    }
  })
  // Get a specific billing rate by ID (Admin only)
  .get("/:id", async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const rateId = c.req.param("id");

    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    
    if (user.role !== "admin") {
      return c.json({ error: "Forbidden: Only admins can view billing rates" }, 403);
    }

    try {
      const rate = await db.query.billingRates.findFirst({
        where: eq(billingRates.id, rateId),
      });

      if (!rate) {
        return c.json({ error: "Billing rate not found" }, 404);
      }

      return c.json(rate);
    } catch (error: any) {
      return c.json({ error: "Failed to fetch billing rate", details: error.message }, 500);
    }
  })
  // Update a billing rate (Admin only)
  .patch("/:id", zValidator("json", billingRateUpdateSchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const rateId = c.req.param("id");
    const validJson = c.req.valid("json");

    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    
    if (user.role !== "admin") {
      return c.json({ error: "Forbidden: Only admins can update billing rates" }, 403);
    }

    const existingRate = await db.query.billingRates.findFirst({
      where: eq(billingRates.id, rateId),
    });

    if (!existingRate) {
      return c.json({ error: "Billing rate not found" }, 404);
    }

    // Construct update payload
    const updatePayload: Partial<typeof billingRates.$inferInsert> = {
      ...validJson,
      updatedAt: new Date(), // Explicitly set updatedAt using current Date
    };

    if (Object.keys(updatePayload).length === 0) {
      return c.json({ message: "No changes to apply" }, 200);
    }

    try {
      const updatedRate = await db
        .update(billingRates)
        .set(updatePayload)
        .where(eq(billingRates.id, rateId))
        .returning();

      if (updatedRate.length === 0) {
        return c.json({ error: "Failed to update billing rate" }, 500);
      }
      
      return c.json(updatedRate[0]);
    } catch (error: any) {
      return c.json({ error: "Failed to update billing rate", details: error.message }, 500);
    }
  })
  // Delete a billing rate (Admin only)
  .delete("/:id", async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const rateId = c.req.param("id");

    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    
    if (user.role !== "admin") {
      return c.json({ error: "Forbidden: Only admins can delete billing rates" }, 403);
    }

    const existingRate = await db.query.billingRates.findFirst({
      where: eq(billingRates.id, rateId),
    });
    
    if (!existingRate) {
      return c.json({ error: "Billing rate not found" }, 404);
    }

    try {
      const deletedRate = await db
        .delete(billingRates)
        .where(eq(billingRates.id, rateId))
        .returning();
        
      if (deletedRate.length === 0) {
        return c.json({ error: "Failed to delete billing rate" }, 500);
      }
      
      return c.json({ 
        message: "Billing rate deleted successfully", 
        billingRate: deletedRate[0] 
      });
    } catch (error: any) {
      return c.json({ error: "Failed to delete billing rate", details: error.message }, 500);
    }
  });

export default billingRatesRoute;
