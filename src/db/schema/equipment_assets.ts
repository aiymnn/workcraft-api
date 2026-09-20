import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { crewContacts } from "./crew_contacts.js";
import { jobs } from "./jobs.js";
import { studios } from "./studios.js";

export const equipmentAssets = mysqlTable("equipment_assets", {
  id: int("id").autoincrement().primaryKey(),

  studioId: int("studio_id")
    .notNull()
    .references(() => studios.id, { onDelete: "cascade" }),

  name: varchar("name", { length: 200 }).notNull(),

  category: varchar("category", { length: 100 }),

  serial: varchar("serial", { length: 100 }),

  status: mysqlEnum("status", [
    "IN_STUDIO",
    "ON_JOB",
    "WITH_CREW",
    "IN_REPAIR",
    "RETIRED",
  ])
    .notNull()
    .default("IN_STUDIO"),

  notes: text("notes"),

  /** Set when the asset is booked against a job. */
  jobId: int("job_id").references(() => jobs.id, { onDelete: "set null" }),

  /** Set when a crew member is holding the asset. */
  crewContactId: int("crew_contact_id").references(() => crewContacts.id, {
    onDelete: "set null",
  }),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
