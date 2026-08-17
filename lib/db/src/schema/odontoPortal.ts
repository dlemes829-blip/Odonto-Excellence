import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * A single, versioned portal document keeps the operational dashboard in sync
 * between collaborators without coupling the portal UI to database columns.
 */
export const odontoPortalStates = pgTable("odonto_portal_states", {
  portalKey: text("portal_key").primaryKey(),
  state: jsonb("state").$type<Record<string, unknown>>().notNull(),
  revision: integer("revision").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** A human identity can own multiple isolated login profiles. */
export const odontoPortalPeople = pgTable("odonto_portal_people", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  email: text("email").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Accounts and state are deliberately separate: one login never inherits another login's privileges. */
export const odontoPortalUsers = pgTable(
  "odonto_portal_users",
  {
    id: text("id").primaryKey(),
    personId: text("person_id"),
    username: text("username").notNull(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull().default("member"),
    accountType: text("account_type").notNull().default("individual"),
    accountStatus: text("account_status").notNull().default("active"),
    managerId: text("manager_id"),
    workspaceOwnerId: text("workspace_owner_id"),
    mustChangePassword: boolean("must_change_password").notNull().default(true),
    isActive: boolean("is_active").notNull().default(true),
    teamMemberLimit: integer("team_member_limit").notNull().default(10),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("odonto_portal_users_username_idx").on(table.username),
    uniqueIndex("odonto_portal_users_email_idx").on(table.email),
    index("odonto_portal_users_person_idx").on(table.personId),
    index("odonto_portal_users_last_seen_idx").on(table.lastSeenAt),
    index("odonto_portal_users_manager_idx").on(table.managerId),
    index("odonto_portal_users_workspace_idx").on(table.workspaceOwnerId),
  ],
);

/** One manager can belong to at most one supervisor; one supervisor can own many managers. */
export const odontoPortalSupervisorManagers = pgTable(
  "odonto_portal_supervisor_managers",
  {
    supervisorId: text("supervisor_id")
      .notNull()
      .references(() => odontoPortalUsers.id, { onDelete: "cascade" }),
    managerId: text("manager_id")
      .notNull()
      .references(() => odontoPortalUsers.id, { onDelete: "cascade" }),
    createdBy: text("created_by").references(() => odontoPortalUsers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("odonto_portal_supervisor_manager_unique_idx").on(table.managerId),
    index("odonto_portal_supervisor_idx").on(table.supervisorId),
  ],
);

export const odontoPortalAuditLog = pgTable(
  "odonto_portal_audit_log",
  {
    id: text("id").primaryKey(),
    actorUserId: text("actor_user_id").references(() => odontoPortalUsers.id, {
      onDelete: "set null",
    }),
    targetUserId: text("target_user_id").references(() => odontoPortalUsers.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    context: jsonb("context").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("odonto_portal_audit_actor_idx").on(table.actorUserId, table.createdAt),
    index("odonto_portal_audit_target_idx").on(table.targetUserId, table.createdAt),
  ],
);

export const odontoPortalSessions = pgTable(
  "odonto_portal_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => odontoPortalUsers.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("odonto_portal_sessions_token_idx").on(table.tokenHash),
    index("odonto_portal_sessions_user_idx").on(table.userId),
    index("odonto_portal_sessions_expiry_idx").on(table.expiresAt),
  ],
);

export const odontoPortalUserStates = pgTable("odonto_portal_user_states", {
  userId: text("user_id")
    .primaryKey()
    .references(() => odontoPortalUsers.id, { onDelete: "cascade" }),
  state: jsonb("state").$type<Record<string, unknown>>().notNull(),
  revision: integer("revision").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const odontoPortalNotifications = pgTable(
  "odonto_portal_notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => odontoPortalUsers.id, {
      onDelete: "cascade",
    }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    kind: text("kind").notNull().default("info"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (table) => [
    index("odonto_portal_notifications_user_idx").on(
      table.userId,
      table.createdAt,
    ),
  ],
);

export const odontoPortalPasswordResets = pgTable(
  "odonto_portal_password_resets",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => odontoPortalUsers.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("odonto_portal_password_resets_token_idx").on(table.tokenHash),
    index("odonto_portal_password_resets_user_idx").on(table.userId),
  ],
);