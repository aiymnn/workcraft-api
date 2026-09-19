import { eq } from "drizzle-orm";
import { db } from "../db/database.js";
import { users } from "../db/schema/users.js";
import { verifyPassword } from "./password.js";
import { signAccessToken } from "./jwt.js";

export async function authenticateUser(email: string, password: string) {
  const userResult = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const user = userResult[0];

  if (!user) {
    throw new Error("Invalid email or password.");
  }

  if (user.status !== "ACTIVE") {
    throw new Error("User account is inactive.");
  }

  const passwordValid = await verifyPassword(password, user.passwordHash);

  if (!passwordValid) {
    throw new Error("Invalid email or password.");
  }

  const accessToken = signAccessToken(user.id);

  return {
    accessToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
    },
  };
}
