import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import ingredientsRouter from "./ingredients";
import recipesRouter from "./recipes";
import openaiRouter from "./openai";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.isAuthenticated()) {
    res.status(401).json({
      error: "Unauthorized: you must be logged in to access this resource",
    });
    return;
  }
  next();
}

router.use(requireAuth);

router.use(ingredientsRouter);
router.use(recipesRouter);
router.use(openaiRouter);
router.use(storageRouter);

export default router;
