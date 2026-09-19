import type { Response } from "express";
import type { AuthenticatedRequest } from "../auth/auth.middleware.js";
import {
  createUser,
  deleteUser,
  listUsers,
  updateUser,
  UserServiceError,
  type UserStatus,
} from "../services/user.service.js";

function parsePositiveInt(value: unknown, fallback: number): number {
  if (typeof value !== "string" || value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

export async function listUsersController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const page = parsePositiveInt(req.query.page, 1);
    const pageSize = parsePositiveInt(req.query.pageSize, 20);

    const search =
      typeof req.query.search === "string" && req.query.search.trim()
        ? req.query.search.trim()
        : undefined;

    const statusRaw =
      typeof req.query.status === "string" ? req.query.status : undefined;

    if (
      statusRaw !== undefined &&
      statusRaw !== "ACTIVE" &&
      statusRaw !== "INACTIVE"
    ) {
      return res.status(400).json({
        status: "error",
        message: "Status must be ACTIVE or INACTIVE.",
      });
    }

    const status = statusRaw as UserStatus | undefined;

    const result = await listUsers({
      page,
      pageSize,
      ...(search !== undefined ? { search } : {}),
      ...(status !== undefined ? { status } : {}),
    });

    return res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    console.error("List users error:", error);

    return res.status(500).json({
      status: "error",
      message: "Unable to list users.",
    });
  }
}

export async function createUserController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const { name, email, password, roleIds } = req.body;

    if (typeof name !== "string" || typeof email !== "string") {
      return res.status(400).json({
        status: "error",
        message: "Name and email are required.",
      });
    }

    if (typeof password !== "string") {
      return res.status(400).json({
        status: "error",
        message: "Password is required.",
      });
    }

    if (
      roleIds !== undefined &&
      (!Array.isArray(roleIds) ||
        roleIds.some((roleId) => !Number.isInteger(roleId)))
    ) {
      return res.status(400).json({
        status: "error",
        message: "roleIds must be an array of integers.",
      });
    }

    const user = await createUser({
      name,
      email,
      password,
      ...(roleIds !== undefined ? { roleIds: roleIds as number[] } : {}),
    });

    return res.status(201).json({
      status: "success",
      data: {
        user,
      },
    });
  } catch (error) {
    if (error instanceof UserServiceError) {
      return res.status(error.statusCode).json({
        status: "error",
        message: error.message,
      });
    }

    console.error("Create user error:", error);

    return res.status(500).json({
      status: "error",
      message: "Unable to create user.",
    });
  }
}

export async function updateUserController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = Number(req.params.id);

    if (!Number.isInteger(userId) || userId < 1) {
      return res.status(400).json({
        status: "error",
        message: "Invalid user id.",
      });
    }

    const { name, email, status, password, roleIds } = req.body;

    if (name !== undefined && typeof name !== "string") {
      return res.status(400).json({
        status: "error",
        message: "Name must be a string.",
      });
    }

    if (email !== undefined && typeof email !== "string") {
      return res.status(400).json({
        status: "error",
        message: "Email must be a string.",
      });
    }

    if (password !== undefined && typeof password !== "string") {
      return res.status(400).json({
        status: "error",
        message: "Password must be a string.",
      });
    }

    if (
      status !== undefined &&
      status !== "ACTIVE" &&
      status !== "INACTIVE"
    ) {
      return res.status(400).json({
        status: "error",
        message: "Status must be ACTIVE or INACTIVE.",
      });
    }

    if (
      roleIds !== undefined &&
      (!Array.isArray(roleIds) ||
        roleIds.some((roleId) => !Number.isInteger(roleId)))
    ) {
      return res.status(400).json({
        status: "error",
        message: "roleIds must be an array of integers.",
      });
    }

    const user = await updateUser(userId, {
      ...(name !== undefined ? { name } : {}),
      ...(email !== undefined ? { email } : {}),
      ...(status !== undefined ? { status: status as UserStatus } : {}),
      ...(password !== undefined ? { password } : {}),
      ...(roleIds !== undefined ? { roleIds: roleIds as number[] } : {}),
    });

    return res.status(200).json({
      status: "success",
      data: {
        user,
      },
    });
  } catch (error) {
    if (error instanceof UserServiceError) {
      return res.status(error.statusCode).json({
        status: "error",
        message: error.message,
      });
    }

    console.error("Update user error:", error);

    return res.status(500).json({
      status: "error",
      message: "Unable to update user.",
    });
  }
}

export async function deleteUserController(
  req: AuthenticatedRequest,
  res: Response,
) {
  const targetUserId = Number(req.params.id);

  if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
    return res.status(400).json({
      status: "error",
      message: "Invalid user ID.",
    });
  }

  if (req.userId === targetUserId) {
    return res.status(403).json({
      status: "error",
      message: "You cannot delete your own account.",
    });
  }

  try {
    await deleteUser(targetUserId);

    return res.status(204).send();
  } catch (error) {
    if (error instanceof UserServiceError) {
      return res.status(error.statusCode).json({
        status: "error",
        message: error.message,
      });
    }

    console.error("Delete user error:", error);

    return res.status(500).json({
      status: "error",
      message: "Unable to delete user.",
    });
  }
}
