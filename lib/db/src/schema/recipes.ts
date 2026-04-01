import { pgTable, text, serial, timestamp, doublePrecision, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const recipesTable = pgTable("recipes", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  servings: integer("servings").notNull().default(1),
  wastagePercent: doublePrecision("wastage_percent").notNull().default(10),
  foodCostPercent: doublePrecision("food_cost_percent").notNull().default(30),
  tags: text("tags").array().notNull().default([]),
  allergens: text("allergens").array().notNull().default([]),
  method: jsonb("method").notNull().default([]),
  ingredients: jsonb("ingredients").notNull().default([]),
  authorName: text("author_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertRecipeSchema = createInsertSchema(recipesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertRecipe = z.infer<typeof insertRecipeSchema>;
export type Recipe = typeof recipesTable.$inferSelect;
