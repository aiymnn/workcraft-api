import {
  int,
  mysqlTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { jobs } from "./jobs.js";
import { studios } from "./studios.js";

export const portalTokens = mysqlTable(
  "portal_tokens",
  {
    id: int("id").autoincrement().primaryKey(),

    studioId: int("studio_id")
      .notNull()
      .references(() => studios.id, { onDelete: "cascade" }),

    jobId: int("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),

    tokenHash: varchar("token_hash", { length: 128 }).notNull(),

    expiresAt: timestamp("expires_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("portal_tokens_token_hash_uidx").on(table.tokenHash),
  ],
);
