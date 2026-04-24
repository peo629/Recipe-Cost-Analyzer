import { Router, type IRouter } from "express";
import { GenerateRecipeBody } from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";

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

router.post("/openai/generate-recipe", async (req, res, next) => {
  try {
    const body = GenerateRecipeBody.parse(req.body);

    const ingredientLines = body.ingredients
      .map((i) => `- ${i.quantity} ${i.unit} ${i.name}`)
      .join("\n");
    const dietary = body.dietaryTags.length ? body.dietaryTags.join(", ") : "none";

    const userPrompt = `Servings: ${body.servings}
Dietary tags: ${dietary}
Ingredients available:
${ingredientLines}

User notes / brief:
${body.prompt || "(no additional notes — produce the most logical dish from these ingredients)"}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
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
            type: typeof b.type === "string" && ["header", "numbered", "text", "subinstruction"].includes(b.type) ? b.type : "numbered",
            content: typeof b.content === "string" ? b.content : "",
            order: typeof b.order === "number" ? b.order : idx,
          }))
          .filter((b) => b.content.length > 0)
      : [];

    res.json({
      title: typeof draft.title === "string" ? draft.title : "Untitled Recipe",
      description: typeof draft.description === "string" ? draft.description : "",
      method: safeMethod,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
