import { int, mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core";
import { users } from "./users.js";

export const emailChangeTokens = mysqlTable("email_change_tokens", {
  id: int("id").autoincrement().primaryKey(),

  userId: int("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  newEmail: varchar("new_email", { length: 255 }).notNull(),

  tokenHash: varchar("token_hash", { length: 128 }).notNull(),

  expiresAt: timestamp("expires_at").notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});
