import { Router, type IRouter } from "express";
import healthRouter from "./health";
import ingredientsRouter from "./ingredients";
import recipesRouter from "./recipes";
import openaiRouter from "./openai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(ingredientsRouter);
router.use(recipesRouter);
router.use(openaiRouter);

export default router;
