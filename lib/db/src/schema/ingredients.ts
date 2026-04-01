import { pgTable, text, serial, timestamp, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ingredientsTable = pgTable("ingredients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  supplier: text("supplier"),
  purchaseUnit: text("purchase_unit").notNull(),
  purchaseUnitSize: doublePrecision("purchase_unit_size").notNull(),
  purchaseCost: doublePrecision("purchase_cost").notNull(),
  recipeUnit: text("recipe_unit").notNull(),
  category: text("category"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertIngredientSchema = createInsertSchema(ingredientsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertIngredient = z.infer<typeof insertIngredientSchema>;
export type Ingredient = typeof ingredientsTable.$inferSelect;
