import {
  boolean,
  int,
  mysqlEnum,
  mysqlTable,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),

  name: varchar("name", { length: 100 }).notNull(),

  email: varchar("email", { length: 255 }).notNull().unique(),

  passwordHash: varchar("password_hash", { length: 255 }).notNull(),

  phone: varchar("phone", { length: 32 }),

  status: mysqlEnum("status", ["ACTIVE", "INACTIVE"])
    .notNull()
    .default("ACTIVE"),

  totpSecret: varchar("totp_secret", { length: 64 }),

  totpEnabledAt: timestamp("totp_enabled_at"),

  waUpdatesOptIn: boolean("wa_updates_opt_in").notNull().default(false),

  myBillsRemindersEnabled: boolean("my_bills_reminders_enabled")
    .notNull()
    .default(false),

  myBillsDaysBefore: int("my_bills_days_before").notNull().default(3),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
