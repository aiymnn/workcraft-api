import express, { Router } from "express";
import { chipWebhookController } from "../controllers/chip-webhook.controller.js";

const router = Router();

/** Public: CHIP posts here. Raw body is kept for signature verification. */
router.post(
  "/chip",
  express.raw({ type: "*/*", limit: "1mb" }),
  chipWebhookController,
);

export default router;
