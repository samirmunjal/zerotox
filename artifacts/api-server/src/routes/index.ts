import { Router, type IRouter } from "express";
import healthRouter from "./health";
import claudeRouter from "./claude";
import geminiRouter from "./gemini";

const router: IRouter = Router();

router.use(healthRouter);
router.use(claudeRouter);
router.use(geminiRouter);

export default router;
