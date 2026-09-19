import {
  boolean,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { clients } from "./clients.js";
import { crewContacts } from "./crew_contacts.js";
import { quotations } from "./quotations.js";
import { studioMembers } from "./studio_members.js";
import { studios } from "./studios.js";

export const jobs = mysqlTable("jobs", {
  id: int("id").autoincrement().primaryKey(),

  studioId: int("studio_id")
    .notNull()
    .references(() => studios.id, { onDelete: "cascade" }),

  clientId: int("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "restrict" }),

  quotationId: int("quotation_id").references(() => quotations.id, {
    onDelete: "set null",
  }),

  number: varchar("number", { length: 64 }),

  status: mysqlEnum("status", ["CONFIRMED", "COMPLETED", "CANCELLED"])
    .notNull()
    .default("CONFIRMED"),

  jobTypeItemId: int("job_type_item_id"),

  leadSourceItemId: int("lead_source_item_id"),

  cancelReasonItemId: int("cancel_reason_item_id"),

  notes: text("notes"),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const jobSessions = mysqlTable("job_sessions", {
  id: int("id").autoincrement().primaryKey(),

  jobId: int("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),

  ceremonyTypeItemId: int("ceremony_type_item_id"),

  label: varchar("label", { length: 200 }),

  startsAt: timestamp("starts_at").notNull(),

  endsAt: timestamp("ends_at"),

  venue: varchar("venue", { length: 255 }),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const sessionCrew = mysqlTable("session_crew", {
  id: int("id").autoincrement().primaryKey(),

  sessionId: int("session_id")
    .notNull()
    .references(() => jobSessions.id, { onDelete: "cascade" }),

  studioMemberId: int("studio_member_id").references(() => studioMembers.id, {
    onDelete: "set null",
  }),

  crewContactId: int("crew_contact_id").references(() => crewContacts.id, {
    onDelete: "set null",
  }),

  crewRoleItemId: int("crew_role_item_id"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const jobChecklistItems = mysqlTable("job_checklist_items", {
  id: int("id").autoincrement().primaryKey(),

  jobId: int("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),

  label: varchar("label", { length: 255 }).notNull(),

  phase: mysqlEnum("phase", ["BEFORE", "ON_DAY", "AFTER"]).notNull(),

  doneAt: timestamp("done_at"),

  sortOrder: int("sort_order").notNull().default(0),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const jobDeliverables = mysqlTable("job_deliverables", {
  id: int("id").autoincrement().primaryKey(),

  jobId: int("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),

  title: varchar("title", { length: 255 }).notNull(),

  status: mysqlEnum("status", ["PENDING", "IN_PROGRESS", "DELIVERED"])
    .notNull()
    .default("PENDING"),

  clientVisible: boolean("client_visible").notNull().default(false),

  url: varchar("url", { length: 512 }),

  sortOrder: int("sort_order").notNull().default(0),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const jobContracts = mysqlTable("job_contracts", {
  id: int("id").autoincrement().primaryKey(),

  jobId: int("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),

  name: varchar("name", { length: 200 }).notNull(),

  body: text("body").notNull(),

  status: mysqlEnum("status", ["DRAFT", "SENT", "SIGNED"])
    .notNull()
    .default("DRAFT"),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
