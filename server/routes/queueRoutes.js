import { Router } from "express";
import { callNextInQueue, completeCurrentInQueue, getQueueByDoctor, reorderQueuePosition } from "../controllers/queueController.js";

const router = Router();

router.get("/:doctorId", getQueueByDoctor);
router.post("/:doctorId/next", callNextInQueue);
router.post("/:doctorId/complete", completeCurrentInQueue);
router.put("/:doctorId/reorder", reorderQueuePosition);

export default router;
