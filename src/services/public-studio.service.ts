import { db } from "../db/database.js";
import { studios } from "../db/schema/studios.js";

/** Public studio contact for the landing page. Phone is Company details → Phone. */
export async function getPublicStudioContact() {
  const rows = await db
    .select({
      name: studios.name,
      phone: studios.phone,
    })
    .from(studios)
    .limit(1);
  const studio = rows[0];
  return {
    name: studio?.name ?? "Workcraft Studio",
    phone: studio?.phone?.trim() || null,
  };
}
