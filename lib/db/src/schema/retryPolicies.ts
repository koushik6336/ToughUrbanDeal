import { pgTable, uuid, varchar, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const retryPoliciesTable = pgTable("retry_policies", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: varchar("type", { length: 20 }).notNull(), // 'fixed' | 'linear' | 'exponential'
  baseDelayMs: integer("base_delay_ms").notNull().default(1000),
  maxRetries: integer("max_retries").notNull().default(3),
  multiplier: numeric("multiplier").default("2.0"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const insertRetryPolicySchema = createInsertSchema(retryPoliciesTable).omit({ id: true, createdAt: true });
export type InsertRetryPolicy = z.infer<typeof insertRetryPolicySchema>;
export type RetryPolicy = typeof retryPoliciesTable.$inferSelect;
