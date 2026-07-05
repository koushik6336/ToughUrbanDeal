import { pgTable, uuid, integer, timestamp } from "drizzle-orm/pg-core";
import { queuesTable } from "./queues";

export const queueDepthSnapshotsTable = pgTable("queue_depth_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  queueId: uuid("queue_id").notNull().references(() => queuesTable.id, { onDelete: "cascade" }),
  queuedCount: integer("queued_count").notNull().default(0),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow().notNull(),
});

export type QueueDepthSnapshot = typeof queueDepthSnapshotsTable.$inferSelect;
