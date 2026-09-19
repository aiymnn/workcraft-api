import {
  boolean,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

/** Tenant / studio — Settings fundamentals live here. */
export const studios = mysqlTable("studios", {
  id: int("id").autoincrement().primaryKey(),

  name: varchar("name", { length: 200 }).notNull(),

  ssm: varchar("ssm", { length: 64 }),

  tin: varchar("tin", { length: 64 }),

  address: text("address"),

  phone: varchar("phone", { length: 32 }),

  email: varchar("email", { length: 255 }),

  bizType: mysqlEnum("biz_type", ["SOLE_PROP", "SDN_BHD"]),

  logoUrl: varchar("logo_url", { length: 512 }),

  payToBank: varchar("pay_to_bank", { length: 100 }),

  payToAccountName: varchar("pay_to_account_name", { length: 200 }),

  payToAccountNo: varchar("pay_to_account_no", { length: 64 }),

  portalMessage: text("portal_message"),

  currency: varchar("currency", { length: 8 }).notNull().default("MYR"),

  /** ISO weekday numbers 1=Mon … 7=Sun */
  workingDays: json("working_days").$type<number[]>().notNull(),

  capacityPerDay: int("capacity_per_day").notNull().default(2),

  invoiceTemplateId: varchar("invoice_template_id", { length: 32 })
    .notNull()
    .default("BASIC"),

  quoteNextNumber: int("quote_next_number").notNull().default(1),

  invoiceNextNumber: int("invoice_next_number").notNull().default(1),

  quoteIntro: text("quote_intro"),

  quoteNotes: text("quote_notes"),

  invoiceNotes: text("invoice_notes"),

  chipEnabled: boolean("chip_enabled").notNull().default(false),

  paymentRemindersEnabled: boolean("payment_reminders_enabled")
    .notNull()
    .default(true),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
