import {
  int,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/** Idempotency log for CHIP callbacks — one row per provider event id. */
export const chipWebhookEvents = mysqlTable(
  "chip_webhook_events",
  {
    id: int("id").autoincrement().primaryKey(),

    eventId: varchar("event_id", { length: 191 }).notNull(),

    payload: text("payload"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("chip_webhook_events_event_id_uidx").on(table.eventId),
  ],
);
