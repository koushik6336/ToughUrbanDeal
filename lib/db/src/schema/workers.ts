import { pgTable, uuid, varchar, timestamp, numeric, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const workersTable = pgTable("workers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("active"), // 'active' | 'draining' | 'dead'
  lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }),
  registeredAt: timestamp("registered_at", { withTimezone: true }).defaultNow(),
});

export const workerHeartbeatsTable = pgTable("worker_heartbeats", {
  id: uuid("id").primaryKey().defaultRandom(),
  workerId: uuid("worker_id").references(() => workersTable.id, { onDelete: "cascade" }),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow(),
  cpuUsage: numeric("cpu_usage"),
  memoryUsage: numeric("memory_usage"),
  activeJobCount: integer("active_job_count").default(0),
}, (t) => [
  index("idx_heartbeats_worker_time").on(t.workerId, t.timestamp),
]);

export const insertWorkerSchema = createInsertSchema(workersTable).omit({ id: true, registeredAt: true });
export type InsertWorker = z.infer<typeof insertWorkerSchema>;
export type Worker = typeof workersTable.$inferSelect;

export const insertWorkerHeartbeatSchema = createInsertSchema(workerHeartbeatsTable).omit({ id: true });
export type InsertWorkerHeartbeat = z.infer<typeof insertWorkerHeartbeatSchema>;
export type WorkerHeartbeat = typeof workerHeartbeatsTable.$inferSelect;
