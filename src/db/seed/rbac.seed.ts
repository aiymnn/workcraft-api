import { db } from "../database.js";
import { permissions } from "../schema/permissions.js";
import { roles } from "../schema/roles.js";
import { rolePermissions } from "../schema/role_permissions.js";

const permissionDefinitions = [
  ["users.view", "View users"],
  ["users.create", "Create users"],
  ["users.update", "Update users"],
  ["users.delete", "Delete users"],

  ["roles.view", "View roles"],
  ["roles.create", "Create roles"],
  ["roles.update", "Update roles"],
  ["roles.delete", "Delete roles"],

  ["permissions.view", "View permissions"],
  ["permissions.manage", "Manage permissions"],

  ["settings.view", "View system settings"],
  ["settings.manage", "Manage system settings"],

  ["system.manage", "Manage system"],

  ["clients.view", "View clients"],
  ["clients.create", "Create clients"],
  ["clients.update", "Update clients"],
  ["clients.delete", "Delete clients"],

  ["quotations.view", "View quotations"],
  ["quotations.create", "Create quotations"],
  ["quotations.update", "Update quotations"],
  ["quotations.delete", "Delete quotations"],

  ["jobs.view", "View jobs"],
  ["jobs.create", "Create jobs"],
  ["jobs.update", "Update jobs"],
  ["jobs.delete", "Delete jobs"],

  ["money.view", "View money"],
  ["money.create", "Create money records"],
  ["money.update", "Update money records"],
  ["money.delete", "Delete money records"],

  ["team.view", "View team"],
  ["team.manage", "Manage team"],

  ["calendar.view", "View calendar"],

  ["pricing.view", "View pricing"],
  ["pricing.manage", "Manage pricing"],

  ["equipment.view", "View equipment"],
  ["equipment.create", "Create equipment"],
  ["equipment.update", "Update equipment"],
  ["equipment.delete", "Delete equipment"],
] as const;

const roleDefinitions = [
  {
    name: "SYSTEM_ADMIN",
    description:
      "Full system administrator with unrestricted administrative access",
    isSystemRole: true,
  },
  {
    name: "ADMIN",
    description: "Administrative user",
    isSystemRole: true,
  },
  {
    name: "MANAGER",
    description: "Management user",
    isSystemRole: true,
  },
] as const;

const adminPermissions = [
  "users.view",
  "users.create",
  "users.update",
  "users.delete",

  "roles.view",
  "roles.create",
  "roles.update",
  "roles.delete",

  "permissions.view",

  "settings.view",
  "settings.manage",

  "clients.view",
  "clients.create",
  "clients.update",
  "clients.delete",

  "quotations.view",
  "quotations.create",
  "quotations.update",
  "quotations.delete",

  "jobs.view",
  "jobs.create",
  "jobs.update",
  "jobs.delete",

  "money.view",
  "money.create",
  "money.update",
  "money.delete",

  "team.view",
  "team.manage",

  "calendar.view",

  "pricing.view",
  "pricing.manage",

  "equipment.view",
  "equipment.create",
  "equipment.update",
  "equipment.delete",
] as const;

const managerPermissions = [
  "users.view",
  "clients.view",
  "quotations.view",
  "jobs.view",
  "money.view",
  "team.view",
  "calendar.view",
  "pricing.view",
  "settings.view",
  "equipment.view",
] as const;

async function seedRbac() {
  console.log("Seeding RBAC...");

  // 1. Seed permissions
  for (const [name, description] of permissionDefinitions) {
    await db
      .insert(permissions)
      .values({
        name,
        description,
      })
      .onDuplicateKeyUpdate({
        set: {
          description,
        },
      });
  }

  // 2. Seed roles
  for (const role of roleDefinitions) {
    await db
      .insert(roles)
      .values(role)
      .onDuplicateKeyUpdate({
        set: {
          description: role.description,
          isSystemRole: role.isSystemRole,
        },
      });
  }

  // 3. Get seeded roles and permissions
  const allRoles = await db.select().from(roles);
  const allPermissions = await db.select().from(permissions);

  const systemAdminRole = allRoles.find(
    (role) => role.name === "SYSTEM_ADMIN",
  );

  const adminRole = allRoles.find((role) => role.name === "ADMIN");

  const managerRole = allRoles.find((role) => role.name === "MANAGER");

  if (!systemAdminRole || !adminRole || !managerRole) {
    throw new Error("Required system roles were not found.");
  }

  // 4. SYSTEM_ADMIN gets every permission
  for (const permission of allPermissions) {
    await db
      .insert(rolePermissions)
      .values({
        roleId: systemAdminRole.id,
        permissionId: permission.id,
      })
      .onDuplicateKeyUpdate({
        set: {
          roleId: systemAdminRole.id,
        },
      });
  }

  // 5. ADMIN gets selected permissions
  for (const permissionName of adminPermissions) {
    const permission = allPermissions.find(
      (item) => item.name === permissionName,
    );

    if (!permission) {
      throw new Error(`Permission not found: ${permissionName}`);
    }

    await db
      .insert(rolePermissions)
      .values({
        roleId: adminRole.id,
        permissionId: permission.id,
      })
      .onDuplicateKeyUpdate({
        set: {
          roleId: adminRole.id,
        },
      });
  }

  // 6. MANAGER gets selected permissions
  for (const permissionName of managerPermissions) {
    const permission = allPermissions.find(
      (item) => item.name === permissionName,
    );

    if (!permission) {
      throw new Error(`Permission not found: ${permissionName}`);
    }

    await db
      .insert(rolePermissions)
      .values({
        roleId: managerRole.id,
        permissionId: permission.id,
      })
      .onDuplicateKeyUpdate({
        set: {
          roleId: managerRole.id,
        },
      });
  }

  console.log("RBAC seed completed.");
}

seedRbac()
  .catch((error) => {
    console.error("RBAC seed failed:", error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
