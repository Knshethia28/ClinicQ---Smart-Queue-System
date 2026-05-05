import { Router } from "express";
import {
	addWalkInAppointment,
	cancelAppointment,
	checkInAppointment,
	createAppointment,
	getAppointmentQueueStatus,
	getPatientAppointments,
} from "../controllers/appointmentController.js";

const router = Router();

router.post("/", createAppointment);
router.post("/walkin", addWalkInAppointment);
router.get("/", getPatientAppointments);
router.get("/:appointmentId/queue-status", getAppointmentQueueStatus);
router.post("/:appointmentId/checkin", checkInAppointment);
router.post("/:appointmentId/cancel", cancelAppointment);

export default router;
