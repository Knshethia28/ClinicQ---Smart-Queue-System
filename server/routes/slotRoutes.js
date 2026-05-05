import { Router } from "express";
import { createSlot, getSlots } from "../controllers/slotController.js";

const router = Router();

router.get("/", getSlots);
router.post("/", createSlot);

export default router;
