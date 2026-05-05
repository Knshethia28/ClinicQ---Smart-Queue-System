import { Router } from "express";
import { createClinic, getNearbyClinics } from "../controllers/clinicController.js";

const router = Router();

router.get("/nearby", getNearbyClinics);
router.post("/", createClinic);

export default router;
