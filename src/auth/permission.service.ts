import { and, eq } from "drizzle-orm";
import { db } from "../db/database.js";
import { userRoles } from "../db/schema/user_roles.js";
import { rolePermissions } from "../db/schema/role_permissions.js";
import { permissions } from "../db/schema/permissions.js";

export async function userHasPermission(
  userId: number,
  permissionName: string,
): Promise<boolean> {
  const result = await db
    .select({
      permissionId: permissions.id,
    })
    .from(userRoles)
    .innerJoin(
      rolePermissions,
      eq(userRoles.roleId, rolePermissions.roleId),
    )
    .innerJoin(
      permissions,
      eq(rolePermissions.permissionId, permissions.id),
    )
    .where(
      and(
        eq(userRoles.userId, userId),
        eq(permissions.name, permissionName),
      ),
    )
    .limit(1);

  return result.length > 0;
}
