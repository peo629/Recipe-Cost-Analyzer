import { Router, type IRouter } from "express";
import healthRouter from "./health";
import ingredientsRouter from "./ingredients";
import recipesRouter from "./recipes";

const router: IRouter = Router();

router.use(healthRouter);
router.use(ingredientsRouter);
router.use(recipesRouter);

export default router;
