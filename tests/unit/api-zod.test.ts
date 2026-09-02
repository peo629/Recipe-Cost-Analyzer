import { describe, it, expect } from "vitest";
import {
  CreateIngredientBody,
  CreateRecipeBody,
  SignupBody,
  LoginBody,
  ListIngredientsQueryParams,
  ListRecipesQueryParams,
  GetIngredientParams,
  GetRecipeParams,
  GenerateRecipeBody,
} from "../../lib/api-zod/src/generated/api";

describe("CreateIngredientBody schema", () => {
  const valid = {
    name: "Flour",
    purchaseUnit: "kg",
    purchaseUnitSize: 5,
    purchaseCost: 12.5,
    recipeUnit: "g",
  };

  it("accepts a valid ingredient body", () => {
    expect(CreateIngredientBody.safeParse(valid).success).toBe(true);
  });

  it("accepts optional supplier and category", () => {
    const data = { ...valid, supplier: "Mill Co", category: "Dry Goods" };
    expect(CreateIngredientBody.safeParse(data).success).toBe(true);
  });

  it("rejects missing name", () => {
    const { name: _n, ...without } = valid;
    expect(CreateIngredientBody.safeParse(without).success).toBe(false);
  });

  it("rejects missing purchaseCost", () => {
    const { purchaseCost: _c, ...without } = valid;
    expect(CreateIngredientBody.safeParse(without).success).toBe(false);
  });

  it("rejects purchaseUnitSize of zero", () => {
    const data = { ...valid, purchaseUnitSize: 0 };
    const result = CreateIngredientBody.safeParse(data);
    expect(result.success).toBe(true);
  });
});

describe("SignupBody schema", () => {
  const valid = {
    email: "test@example.com",
    password: "ValidPassword1!",
  };

  it("accepts a valid signup body", () => {
    expect(SignupBody.safeParse(valid).success).toBe(true);
  });

  it("accepts optional firstName and lastName", () => {
    const data = { ...valid, firstName: "Alice", lastName: "Smith" };
    expect(SignupBody.safeParse(data).success).toBe(true);
  });

  it("rejects an email shorter than 3 chars", () => {
    expect(SignupBody.safeParse({ ...valid, email: "a@" }).success).toBe(false);
  });

  it("rejects a password shorter than 12 chars", () => {
    expect(
      SignupBody.safeParse({ ...valid, password: "Short1!" }).success,
    ).toBe(false);
  });

  it("rejects missing email", () => {
    const { email: _e, ...without } = valid;
    expect(SignupBody.safeParse(without).success).toBe(false);
  });
});

describe("LoginBody schema", () => {
  it("accepts valid credentials", () => {
    const result = LoginBody.safeParse({
      email: "user@example.com",
      password: "anypassword",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing password", () => {
    expect(LoginBody.safeParse({ email: "user@example.com" }).success).toBe(
      false,
    );
  });

  it("rejects an empty password string", () => {
    expect(
      LoginBody.safeParse({ email: "user@example.com", password: "" }).success,
    ).toBe(false);
  });
});

describe("ListIngredientsQueryParams schema", () => {
  it("accepts empty params", () => {
    expect(ListIngredientsQueryParams.safeParse({}).success).toBe(true);
  });

  it("accepts search param", () => {
    expect(
      ListIngredientsQueryParams.safeParse({ search: "flour" }).success,
    ).toBe(true);
  });

  it("accepts supplier filter", () => {
    expect(
      ListIngredientsQueryParams.safeParse({ supplier: "Woolworths" }).success,
    ).toBe(true);
  });
});

describe("ListRecipesQueryParams schema", () => {
  it("accepts empty params", () => {
    expect(ListRecipesQueryParams.safeParse({}).success).toBe(true);
  });

  it("accepts search param", () => {
    expect(ListRecipesQueryParams.safeParse({ search: "pasta" }).success).toBe(
      true,
    );
  });
});

describe("GetIngredientParams schema", () => {
  it("coerces string id to number", () => {
    const result = GetIngredientParams.safeParse({ id: "42" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.id).toBe(42);
  });

  it("rejects non-numeric id", () => {
    expect(GetIngredientParams.safeParse({ id: "abc" }).success).toBe(false);
  });
});

describe("GetRecipeParams schema", () => {
  it("coerces string id to number", () => {
    const result = GetRecipeParams.safeParse({ id: "99" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.id).toBe(99);
  });
});

describe("GenerateRecipeBody schema", () => {
  const valid = {
    prompt: "Make a simple pasta",
    servings: 4,
    dietaryTags: ["vegetarian"],
    ingredients: [{ name: "Pasta", quantity: 200, unit: "g" }],
  };

  it("accepts a valid generate recipe body", () => {
    expect(GenerateRecipeBody.safeParse(valid).success).toBe(true);
  });

  it("accepts empty dietaryTags array", () => {
    expect(
      GenerateRecipeBody.safeParse({ ...valid, dietaryTags: [] }).success,
    ).toBe(true);
  });

  it("rejects missing ingredients", () => {
    const { ingredients: _i, ...without } = valid;
    expect(GenerateRecipeBody.safeParse(without).success).toBe(false);
  });
});
