import {
  boolean,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { users } from "./users.js";

export const userSessions = mysqlTable("user_sessions", {
  id: int("id").autoincrement().primaryKey(),

  userId: int("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  refreshTokenHash: varchar("refresh_token_hash", { length: 128 }).notNull(),

  userAgent: varchar("user_agent", { length: 512 }),

  ipAddress: varchar("ip_address", { length: 64 }),

  expiresAt: timestamp("expires_at").notNull(),

  revokedAt: timestamp("revoked_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userOauthConnections = mysqlTable(
  "user_oauth_connections",
  {
    id: int("id").autoincrement().primaryKey(),

    userId: int("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    provider: mysqlEnum("provider", ["GOOGLE"]).notNull(),

    providerEmail: varchar("provider_email", { length: 255 }),

    accessTokenEnc: text("access_token_enc"),

    refreshTokenEnc: text("refresh_token_enc"),

    scopes: text("scopes"),

    calendarSyncEnabled: boolean("calendar_sync_enabled")
      .notNull()
      .default(false),

    driveReceiptsEnabled: boolean("drive_receipts_enabled")
      .notNull()
      .default(false),

    footagePortalEnabled: boolean("footage_portal_enabled")
      .notNull()
      .default(false),

    createdAt: timestamp("created_at").defaultNow().notNull(),

    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    uniqueIndex("user_oauth_user_provider_uidx").on(
      table.userId,
      table.provider,
    ),
  ],
);
