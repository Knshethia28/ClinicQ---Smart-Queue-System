import { Router } from "express";
import { createDoctor, deleteDoctor, getDoctors, updateDoctorAvailability } from "../controllers/doctorController.js";

const router = Router();

router.get("/", getDoctors);
router.post("/", createDoctor);
router.put("/:doctorId/availability", updateDoctorAvailability);
router.delete("/:doctorId", deleteDoctor);

export default router;
