import { Router, type IRouter } from "express";
import { GenerateRecipeBody } from "@workspace/api-zod";
import { chatComplete, getChatProvider } from "@workspace/ai-provider";
import { openaiRateLimiter } from "../middlewares/rateLimiter";
import { checkAndConsumeQuota } from "../lib/aiQuota";

const router: IRouter = Router();

const SYSTEM_PROMPT = `You are a professional executive chef writing concise, kitchen-ready recipes for a restaurant brigade.
Given a list of ingredients (with quantities and units), dietary tags and a free-form prompt from the user, produce a recipe that:
- has a short, evocative title (3-7 words)
- has a 1-2 sentence description suitable for a menu card
- has a clear, numbered method using ONLY the supplied ingredients (do not invent additional ingredients)
- respects all dietary tags
- yields the requested number of servings
- uses the exact units the user provided
You MUST return valid JSON matching this shape exactly:
{
  "title": string,
  "description": string,
  "method": [ { "type": "header" | "numbered" | "text" | "subinstruction", "content": string, "order": number } ]
}
The method array should typically start with a "header" block, then numbered steps. Order is 0-indexed and increments by 1. No prose outside the JSON.`;

router.post(
  "/openai/generate-recipe",
  openaiRateLimiter,
  async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const quota = checkAndConsumeQuota(req.user.id);
      if (!quota.allowed) {
        res.status(429).json({ error: quota.reason });
        return;
      }

      const bodyParsed = GenerateRecipeBody.safeParse(req.body);
      if (!bodyParsed.success) {
        res.status(400).json({ error: bodyParsed.error.message });
        return;
      }
      const body = bodyParsed.data;

      const ingredientLines = body.ingredients
        .map((i) => `- ${i.quantity} ${i.unit} ${i.name}`)
        .join("\n");
      const dietary = body.dietaryTags.length
        ? body.dietaryTags.join(", ")
        : "none";

      const userPrompt = `Servings: ${body.servings}
Dietary tags: ${dietary}
Ingredients available:
${ingredientLines}

User notes / brief:
${body.prompt || "(no additional notes — produce the most logical dish from these ingredients)"}`;

      const provider = await getChatProvider();
      const completion = await chatComplete({
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        maxTokens: 4096,
        jsonMode: true,
      });

      req.log.info(
        {
          userId: req.user.id,
          aiProvider: provider.name,
          model: completion.model,
          promptTokens: completion.usage.promptTokens,
          completionTokens: completion.usage.completionTokens,
          totalTokens: completion.usage.totalTokens,
          quotaRemaining: quota.remaining,
        },
        "AI recipe generation completed",
      );

      const raw = completion.text;
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        res.status(502).json({ error: "AI returned non-JSON output", raw });
        return;
      }

      const draft = parsed as {
        title?: unknown;
        description?: unknown;
        method?: Array<{ type?: unknown; content?: unknown; order?: unknown }>;
      };

      const safeMethod = Array.isArray(draft.method)
        ? draft.method
            .map((b, idx) => ({
              type:
                typeof b.type === "string" &&
                ["header", "numbered", "text", "subinstruction"].includes(
                  b.type,
                )
                  ? b.type
                  : "numbered",
              content: typeof b.content === "string" ? b.content : "",
              order: typeof b.order === "number" ? b.order : idx,
            }))
            .filter((b) => b.content.length > 0)
        : [];

      res.json({
        title:
          typeof draft.title === "string" ? draft.title : "Untitled Recipe",
        description:
          typeof draft.description === "string" ? draft.description : "",
        method: safeMethod,
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
