import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { jobs } from "./jobs.js";
import { invoices } from "./money.js";

export const jobActivityChannels = ["EMAIL", "WHATSAPP", "NOTE"] as const;

export const jobActivity = mysqlTable("job_activity", {
  id: int("id").autoincrement().primaryKey(),

  jobId: int("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),

  channel: mysqlEnum("channel", [...jobActivityChannels]).notNull(),

  kind: varchar("kind", { length: 64 }).notNull(),

  subject: varchar("subject", { length: 255 }),

  summary: text("summary"),

  invoiceId: int("invoice_id").references(() => invoices.id, {
    onDelete: "set null",
  }),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});
