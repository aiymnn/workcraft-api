import { and, count, eq, inArray, like, or, type SQL } from "drizzle-orm";
import { db } from "../db/database.js";
import { users } from "../db/schema/users.js";
import { userRoles } from "../db/schema/user_roles.js";
import { roles } from "../db/schema/roles.js";
import { hashPassword } from "../auth/password.js";

export class UserServiceError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "UserServiceError";
  }
}

export type UserStatus = "ACTIVE" | "INACTIVE";

export type ListUsersParams = {
  page: number;
  pageSize: number;
  search?: string;
  status?: UserStatus;
};

export type ListedUser = {
  id: number;
  name: string;
  email: string;
  status: UserStatus;
  roles: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type CreateUserInput = {
  name: string;
  email: string;
  password: string;
  roleIds?: number[];
};

export type UpdateUserInput = {
  name?: string;
  email?: string;
  status?: UserStatus;
  password?: string;
  roleIds?: number[];
};

function buildUsersWhere(params: ListUsersParams): SQL | undefined {
  const conditions: SQL[] = [];

  if (params.status) {
    conditions.push(eq(users.status, params.status));
  }

  if (params.search) {
    const term = `%${params.search}%`;
    const searchCondition = or(
      like(users.name, term),
      like(users.email, term),
    );

    if (searchCondition) {
      conditions.push(searchCondition);
    }
  }

  if (conditions.length === 0) {
    return undefined;
  }

  return and(...conditions);
}

async function getUserRolesByUserIds(
  userIds: number[],
): Promise<Map<number, string[]>> {
  const rolesByUserId = new Map<number, string[]>();

  if (userIds.length === 0) {
    return rolesByUserId;
  }

  const roleRows = await db
    .select({
      userId: userRoles.userId,
      roleName: roles.name,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(inArray(userRoles.userId, userIds));

  for (const row of roleRows) {
    const existing = rolesByUserId.get(row.userId) ?? [];
    existing.push(row.roleName);
    rolesByUserId.set(row.userId, existing);
  }

  return rolesByUserId;
}

export async function listUsers(params: ListUsersParams) {
  const page = Math.max(1, params.page);
  const pageSize = Math.min(100, Math.max(1, params.pageSize));
  const where = buildUsersWhere({ ...params, page, pageSize });
  const offset = (page - 1) * pageSize;

  const totalResult = await db
    .select({ total: count() })
    .from(users)
    .where(where);

  const total = Number(totalResult[0]?.total ?? 0);

  const items = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      status: users.status,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(where)
    .orderBy(users.id)
    .limit(pageSize)
    .offset(offset);

  const rolesByUserId = await getUserRolesByUserIds(
    items.map((item) => item.id),
  );

  const listedUsers: ListedUser[] = items.map((item) => ({
    ...item,
    roles: rolesByUserId.get(item.id) ?? [],
  }));

  return {
    items: listedUsers,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    },
  };
}

export async function createUser(input: CreateUserInput): Promise<ListedUser> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  const roleIds = [...new Set(input.roleIds ?? [])];

  if (!name) {
    throw new UserServiceError("Name is required.", 400);
  }

  if (!email) {
    throw new UserServiceError("Email is required.", 400);
  }

  if (password.length < 8) {
    throw new UserServiceError(
      "Password must be at least 8 characters.",
      400,
    );
  }

  const existingUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingUsers[0]) {
    throw new UserServiceError("Email is already in use.", 409);
  }

  if (roleIds.length > 0) {
    const existingRoles = await db
      .select({ id: roles.id })
      .from(roles)
      .where(inArray(roles.id, roleIds));

    if (existingRoles.length !== roleIds.length) {
      throw new UserServiceError("One or more roleIds are invalid.", 400);
    }
  }

  const passwordHash = await hashPassword(password);

  const userId = await db.transaction(async (tx) => {
    const result = await tx.insert(users).values({
      name,
      email,
      passwordHash,
      status: "ACTIVE",
    });

    const insertId = result[0].insertId;

    if (roleIds.length > 0) {
      await tx.insert(userRoles).values(
        roleIds.map((roleId) => ({
          userId: insertId,
          roleId,
        })),
      );
    }

    return insertId;
  });

  const createdUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      status: users.status,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const createdUser = createdUsers[0];

  if (!createdUser) {
    throw new UserServiceError("Failed to create user.", 500);
  }

  const rolesByUserId = await getUserRolesByUserIds([createdUser.id]);

  return {
    ...createdUser,
    roles: rolesByUserId.get(createdUser.id) ?? [],
  };
}

async function getListedUserById(userId: number): Promise<ListedUser | null> {
  const foundUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      status: users.status,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const foundUser = foundUsers[0];

  if (!foundUser) {
    return null;
  }

  const rolesByUserId = await getUserRolesByUserIds([foundUser.id]);

  return {
    ...foundUser,
    roles: rolesByUserId.get(foundUser.id) ?? [],
  };
}

export async function updateUser(
  userId: number,
  input: UpdateUserInput,
): Promise<ListedUser> {
  if (
    input.name === undefined &&
    input.email === undefined &&
    input.status === undefined &&
    input.password === undefined &&
    input.roleIds === undefined
  ) {
    throw new UserServiceError("At least one field is required to update.", 400);
  }

  const existingUser = await getListedUserById(userId);

  if (!existingUser) {
    throw new UserServiceError("User not found.", 404);
  }

  const updates: {
    name?: string;
    email?: string;
    status?: UserStatus;
    passwordHash?: string;
  } = {};

  if (input.name !== undefined) {
    const name = input.name.trim();

    if (!name) {
      throw new UserServiceError("Name cannot be empty.", 400);
    }

    updates.name = name;
  }

  if (input.email !== undefined) {
    const email = input.email.trim().toLowerCase();

    if (!email) {
      throw new UserServiceError("Email cannot be empty.", 400);
    }

    if (email !== existingUser.email) {
      const duplicateUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (duplicateUsers[0]) {
        throw new UserServiceError("Email is already in use.", 409);
      }
    }

    updates.email = email;
  }

  if (input.status !== undefined) {
    if (input.status !== "ACTIVE" && input.status !== "INACTIVE") {
      throw new UserServiceError("Status must be ACTIVE or INACTIVE.", 400);
    }

    updates.status = input.status;
  }

  if (input.password !== undefined) {
    if (input.password.length < 8) {
      throw new UserServiceError(
        "Password must be at least 8 characters.",
        400,
      );
    }

    updates.passwordHash = await hashPassword(input.password);
  }

  let nextRoleIds: number[] | undefined;

  if (input.roleIds !== undefined) {
    nextRoleIds = [...new Set(input.roleIds)];

    if (nextRoleIds.length > 0) {
      const existingRoles = await db
        .select({ id: roles.id, name: roles.name })
        .from(roles)
        .where(inArray(roles.id, nextRoleIds));

      if (existingRoles.length !== nextRoleIds.length) {
        throw new UserServiceError("One or more roleIds are invalid.", 400);
      }
    }

    if (existingUser.roles.includes("SYSTEM_ADMIN")) {
      const systemAdminRoles = await db
        .select({ id: roles.id })
        .from(roles)
        .where(eq(roles.name, "SYSTEM_ADMIN"))
        .limit(1);

      const systemAdminRoleId = systemAdminRoles[0]?.id;

      if (!systemAdminRoleId) {
        throw new UserServiceError("SYSTEM_ADMIN role not found.", 500);
      }

      if (!nextRoleIds.includes(systemAdminRoleId)) {
        throw new UserServiceError(
          "SYSTEM_ADMIN role cannot be removed from this user.",
          403,
        );
      }
    }
  }

  await db.transaction(async (tx) => {
    if (Object.keys(updates).length > 0) {
      await tx.update(users).set(updates).where(eq(users.id, userId));
    }

    if (nextRoleIds !== undefined) {
      await tx.delete(userRoles).where(eq(userRoles.userId, userId));

      if (nextRoleIds.length > 0) {
        await tx.insert(userRoles).values(
          nextRoleIds.map((roleId) => ({
            userId,
            roleId,
          })),
        );
      }
    }
  });

  const updatedUser = await getListedUserById(userId);

  if (!updatedUser) {
    throw new UserServiceError("User not found.", 404);
  }

  return updatedUser;
}

export async function deleteUser(userId: number): Promise<void> {
  await db.transaction(async (tx) => {
    const targetUsers = await tx
      .select({
        id: users.id,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!targetUsers[0]) {
      throw new UserServiceError("User not found.", 404);
    }

    const systemAdminAssignments = await tx
      .select({
        userId: userRoles.userId,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(
        and(eq(userRoles.userId, userId), eq(roles.name, "SYSTEM_ADMIN")),
      )
      .limit(1);

    if (systemAdminAssignments[0]) {
      throw new UserServiceError(
        "SYSTEM_ADMIN users cannot be deleted.",
        403,
      );
    }

    await tx.delete(userRoles).where(eq(userRoles.userId, userId));
    await tx.delete(users).where(eq(users.id, userId));
  });
}
