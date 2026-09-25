import type { Request, Response } from "express";
import { getPublicStudioContact } from "../services/public-studio.service.js";

export async function getPublicStudioController(_req: Request, res: Response) {
  try {
    const data = await getPublicStudioContact();
    return res.status(200).json({ status: "success", data });
  } catch (error) {
    console.error("Unable to load public studio.", error);
    return res
      .status(500)
      .json({ status: "error", message: "Unable to load studio." });
  }
}
