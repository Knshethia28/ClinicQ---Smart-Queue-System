import { Router } from "express";
import { login, me, signUp } from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/signup", signUp);
router.post("/login", login);
router.get("/me", requireAuth, me);

export default router;
