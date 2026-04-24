import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  useCreateRecipe,
  useListIngredients,
  useGenerateRecipe,
  getListIngredientsQueryKey,
  getListRecipesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/use-debounce";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Loader2,
  Save,
  Sparkles,
  Lock,
  Eye,
  Wand2,
  ChefHat,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { PreviewContent, type BuilderIngredient, type BuilderMethod } from "./recipe-builder";

const COMMON_ALLERGENS = ["Gluten", "Dairy", "Eggs", "Nuts", "Peanuts", "Shellfish", "Fish", "Soy", "Sesame"];
const DIETARY_TAGS = ["Vegetarian", "Vegan", "Gluten-Free", "Dairy-Free", "Nut-Free", "Halal", "Kosher", "Low-Carb", "Keto", "Paleo"];

export default function RecipeGenerator() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // Form state
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [servings, setServings] = useState(2);
  const [wastagePercent, setWastagePercent] = useState(10);
  const [foodCostPercent, setFoodCostPercent] = useState(30);
  const [dietary, setDietary] = useState<string[]>([]);
  const [allergens, setAllergens] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [ingredients, setIngredients] = useState<BuilderIngredient[]>([]);
  const [method, setMethod] = useState<BuilderMethod[]>([]);
  const [description, setDescription] = useState("");

  const [hasGenerated, setHasGenerated] = useState(false);

  // Ingredient search
  const [searchOpen, setSearchOpen] = useState(false);
  const [ingredientSearch, setIngredientSearch] = useState("");
  const debouncedSearch = useDebounce(ingredientSearch, 300);
  const { data: searchResults, isLoading: isSearchLoading } = useListIngredients(
    { search: debouncedSearch },
    { query: { enabled: searchOpen, queryKey: getListIngredientsQueryKey({ search: debouncedSearch }) } },
  );

  const generateMutation = useGenerateRecipe();
  const createMutation = useCreateRecipe();

  const handleAddIngredient = (item: any) => {
    setIngredients((prev) => [
      ...prev,
      {
        _tempId: Math.random().toString(36).substr(2, 9),
        ingredientId: item.id,
        quantity: 1,
        unit: item.recipeUnit,
        name: item.name,
        recipeUnitCost: item.recipeUnitCost,
        purchaseCost: item.purchaseCost,
        purchaseUnitSize: item.purchaseUnitSize,
        purchaseUnit: item.purchaseUnit,
      },
    ]);
    setSearchOpen(false);
    setIngredientSearch("");
  };

  const updateIngredient = (tempId: string, field: string, value: any) => {
    setIngredients((prev) => prev.map((i) => (i._tempId === tempId ? { ...i, [field]: value } : i)));
  };
  const removeIngredient = (tempId: string) =>
    setIngredients((prev) => prev.filter((i) => i._tempId !== tempId));

  const updateMethodBlock = (tempId: string, field: keyof BuilderMethod, value: any) =>
    setMethod((prev) => prev.map((m) => (m._tempId === tempId ? { ...m, [field]: value } : m)));
  const removeMethodBlock = (tempId: string) =>
    setMethod((prev) => prev.filter((m) => m._tempId !== tempId));
  const addMethodBlock = () =>
    setMethod((prev) => [
      ...prev,
      { _tempId: Math.random().toString(36).substr(2, 9), type: "text", content: "", order: prev.length },
    ]);
  const moveMethodBlock = (index: number, dir: 1 | -1) => {
    if (index + dir < 0 || index + dir >= method.length) return;
    const arr = [...method];
    const tmp = arr[index];
    arr[index] = arr[index + dir];
    arr[index + dir] = tmp;
    setMethod(arr);
  };

  const toggle = (list: string[], value: string, setter: (v: string[]) => void) =>
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  // Cost calc (mirror builder)
  const calculatedStats = useMemo(() => {
    const totalIngredientCost = ingredients.reduce((s, i) => s + i.quantity * i.recipeUnitCost, 0);
    const wastageCost = totalIngredientCost * (wastagePercent / 100);
    const totalCostWithWastage = totalIngredientCost + wastageCost;
    const costPerPortion = servings ? totalIngredientCost / servings : 0;
    const costPerPortionWithWastage = servings ? totalCostWithWastage / servings : 0;
    const recommendedSalePrice = foodCostPercent
      ? costPerPortionWithWastage / (foodCostPercent / 100)
      : 0;
    return {
      totalIngredientCost,
      costPerPortion,
      wastageCost,
      totalCostWithWastage,
      costPerPortionWithWastage,
      recommendedSalePrice,
    };
  }, [ingredients, wastagePercent, foodCostPercent, servings]);

  const canGenerate = ingredients.length > 0 && prompt.trim().length > 0 && !generateMutation.isPending;

  const handleGenerate = async () => {
    if (!canGenerate) {
      if (ingredients.length === 0) toast.error("Add at least one ingredient");
      else if (!prompt.trim()) toast.error("Describe what you want to make in the prompt");
      return;
    }
    generateMutation.mutate(
      {
        data: {
          prompt: prompt.trim(),
          servings,
          dietaryTags: dietary,
          ingredients: ingredients.map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit })),
        },
      },
      {
        onSuccess: (data) => {
          setTitle(data.title);
          setDescription(data.description);
          setMethod(
            (data.method ?? []).map((m, idx) => ({
              _tempId: Math.random().toString(36).substr(2, 9),
              type: m.type as BuilderMethod["type"],
              content: m.content,
              order: m.order ?? idx,
            })),
          );
          setHasGenerated(true);
          toast.success("Recipe generated — review and edit before saving");
        },
        onError: () => toast.error("Generation failed. Please try again."),
      },
    );
  };

  const handleSave = () => {
    if (!hasGenerated) {
      toast.error("Generate the recipe first");
      return;
    }
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    const payload = {
      title: title.trim(),
      description: description || null,
      servings,
      wastagePercent,
      foodCostPercent,
      authorName: null,
      tags: [...tags, ...dietary],
      allergens,
      ingredients: ingredients.map((i) => ({
        ingredientId: i.ingredientId,
        quantity: i.quantity,
        unit: i.unit,
      })),
      method: method.map((m, idx) => ({ type: m.type, content: m.content, order: idx })),
    };
    createMutation.mutate(
      { data: payload },
      {
        onSuccess: (data) => {
          queryClient.invalidateQueries({ queryKey: getListRecipesQueryKey() });
          toast.success("Recipe saved to library");
          setLocation(`/recipes/${data.id}`);
        },
        onError: () => toast.error("Failed to save recipe"),
      },
    );
  };

  const isGenerating = generateMutation.isPending;

  const InputsPanel = (
    <div className="p-4 sm:p-6 space-y-6 overflow-y-auto h-full">
      {/* Generate CTA */}
      <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-sm">AI Recipe Generator</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Choose ingredients & dietary tags, describe the dish, then generate. Title and method unlock after AI writes the draft.
        </p>
        <Button
          onClick={handleGenerate}
          disabled={!canGenerate}
          className="w-full"
          size="lg"
          data-testid="button-generate-recipe"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…
            </>
          ) : (
            <>
              <Wand2 className="mr-2 h-4 w-4" /> Generate Recipe
            </>
          )}
        </Button>
      </div>

      {/* Title (locked until generated) */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          Title
          {!hasGenerated && <Lock className="h-3 w-3 text-muted-foreground" />}
        </Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={!hasGenerated}
          placeholder={hasGenerated ? "Recipe title" : "Will be written by AI"}
          data-testid="input-title"
        />
      </div>

      {/* Prompt / description */}
      <div className="space-y-2">
        <Label>Description / AI Prompt</Label>
        <Textarea
          value={hasGenerated ? description : prompt}
          onChange={(e) => (hasGenerated ? setDescription(e.target.value) : setPrompt(e.target.value))}
          placeholder={
            hasGenerated
              ? "Recipe description (edit freely)"
              : "Describe the dish, technique, style, occasion…"
          }
          rows={4}
          data-testid="input-prompt"
        />
        {!hasGenerated && (
          <p className="text-xs text-muted-foreground">Used as the brief for the AI. Be specific.</p>
        )}
      </div>

      {/* Servings */}
      <div className="space-y-2">
        <Label>Servings: {servings}</Label>
        <Slider
          min={1}
          max={20}
          step={1}
          value={[servings]}
          onValueChange={(v) => setServings(v[0])}
          data-testid="slider-servings"
        />
      </div>

      {/* Dietary tags */}
      <div className="space-y-2">
        <Label>Dietary Tags</Label>
        <div className="flex flex-wrap gap-2">
          {DIETARY_TAGS.map((t) => {
            const on = dietary.includes(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggle(dietary, t, setDietary)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  on
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-muted border-border"
                }`}
                data-testid={`chip-dietary-${t.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      {/* Allergens */}
      <div className="space-y-2">
        <Label>Contains (Allergens)</Label>
        <div className="flex flex-wrap gap-2">
          {COMMON_ALLERGENS.map((a) => {
            const on = allergens.includes(a);
            return (
              <button
                key={a}
                type="button"
                onClick={() => toggle(allergens, a, setAllergens)}
                className={`text-xs px-2.5 py-1 rounded-full border ${
                  on
                    ? "bg-destructive text-destructive-foreground border-destructive"
                    : "bg-background hover:bg-muted border-border"
                }`}
              >
                {a}
              </button>
            );
          })}
        </div>
      </div>

      {/* Ingredients */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Ingredients ({ingredients.length})</Label>
          <Popover open={searchOpen} onOpenChange={setSearchOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-add-ingredient">
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-80" align="end">
              <div className="p-2 border-b">
                <Input
                  autoFocus
                  placeholder="Search ingredients…"
                  value={ingredientSearch}
                  onChange={(e) => setIngredientSearch(e.target.value)}
                />
              </div>
              <div className="max-h-72 overflow-y-auto">
                {isSearchLoading && (
                  <div className="p-4 text-center text-sm text-muted-foreground">Loading…</div>
                )}
                {!isSearchLoading && (searchResults ?? []).length === 0 && (
                  <div className="p-4 text-center text-sm text-muted-foreground">No matches</div>
                )}
                {(searchResults ?? []).map((r: any) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handleAddIngredient(r)}
                    className="w-full text-left px-3 py-2 hover:bg-muted text-sm border-b last:border-b-0"
                  >
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-muted-foreground flex justify-between">
                      <span>{r.supplier}</span>
                      <span>${Number(r.recipeUnitCost).toFixed(4)}/{r.recipeUnit}</span>
                    </div>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {ingredients.map((ing) => (
              <motion.div
                key={ing._tempId}
                layout
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="flex items-center gap-2 p-2 rounded-md border bg-card"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{ing.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    ${(ing.quantity * ing.recipeUnitCost).toFixed(2)} · ${ing.recipeUnitCost.toFixed(4)}/
                    {ing.unit}
                  </p>
                </div>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={ing.quantity}
                  onChange={(e) => updateIngredient(ing._tempId, "quantity", parseFloat(e.target.value) || 0)}
                  className="w-20 h-8 text-sm"
                />
                <span className="text-xs text-muted-foreground w-10">{ing.unit}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => removeIngredient(ing._tempId)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>
          {ingredients.length === 0 && (
            <p className="text-sm text-muted-foreground italic text-center py-4 border border-dashed rounded-md">
              Add ingredients before generating
            </p>
          )}
        </div>
      </div>

      {/* Cost dials */}
      <div className="space-y-2">
        <Label>Wastage: {wastagePercent}%</Label>
        <Slider min={0} max={50} step={1} value={[wastagePercent]} onValueChange={(v) => setWastagePercent(v[0])} />
      </div>
      <div className="space-y-2">
        <Label>Target Food Cost: {foodCostPercent}%</Label>
        <Slider min={10} max={60} step={1} value={[foodCostPercent]} onValueChange={(v) => setFoodCostPercent(v[0])} />
      </div>

      {/* Method (locked until generated) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2">
            Method
            {!hasGenerated && <Lock className="h-3 w-3 text-muted-foreground" />}
          </Label>
          {hasGenerated && (
            <Button variant="outline" size="sm" onClick={addMethodBlock}>
              <Plus className="h-4 w-4 mr-1" /> Block
            </Button>
          )}
        </div>
        {!hasGenerated && (
          <p className="text-xs text-muted-foreground italic border border-dashed rounded-md p-4 text-center">
            Method will be written by AI
          </p>
        )}
        {hasGenerated && (
          <div className="space-y-2">
            {method.map((m, idx) => (
              <div key={m._tempId} className="border rounded-md p-2 bg-card space-y-1">
                <div className="flex gap-1">
                  <select
                    value={m.type}
                    onChange={(e) => updateMethodBlock(m._tempId, "type", e.target.value)}
                    className="text-xs border rounded px-1 bg-background"
                  >
                    <option value="header">Header</option>
                    <option value="numbered">Step</option>
                    <option value="subinstruction">Sub-step</option>
                    <option value="text">Note</option>
                  </select>
                  <div className="flex-1" />
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveMethodBlock(idx, -1)}>
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveMethodBlock(idx, 1)}>
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => removeMethodBlock(m._tempId)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <Textarea
                  value={m.content}
                  onChange={(e) => updateMethodBlock(m._tempId, "content", e.target.value)}
                  rows={2}
                  className="text-sm"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save */}
      <Button
        onClick={handleSave}
        disabled={!hasGenerated || createMutation.isPending}
        className="w-full"
        variant="default"
        data-testid="button-save-recipe"
      >
        {createMutation.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
          </>
        ) : (
          <>
            <Save className="mr-2 h-4 w-4" /> Save to Recipe Library
          </>
        )}
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-3.5rem)]">
      {/* Mobile preview toggle */}
      <div className="lg:hidden no-print sticky top-0 z-10 flex items-center justify-between p-2 border-b bg-card">
        <div className="flex items-center gap-2 px-2">
          <ChefHat className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">Recipe Generator</span>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm">
              <Eye className="h-4 w-4 mr-1" /> Preview
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-2xl p-0 overflow-y-auto">
            <SheetTitle className="sr-only">Recipe preview</SheetTitle>
            <PreviewContent
              title={title}
              description={description}
              servings={servings}
              ingredients={ingredients}
              method={method}
              allergens={allergens}
              tags={[...tags, ...dietary]}
              authorName=""
              wastagePercent={wastagePercent}
              foodCostPercent={foodCostPercent}
              calculatedStats={calculatedStats}
              onPrint={() => window.print()}
            />
          </SheetContent>
        </Sheet>
      </div>

      {/* Left inputs */}
      <aside className="lg:w-[420px] xl:w-[460px] shrink-0 border-r bg-card no-print h-full overflow-hidden">
        {InputsPanel}
      </aside>

      {/* Right preview */}
      <section className="flex-1 hidden lg:block bg-muted/30 overflow-hidden">
        <PreviewContent
          title={title}
          description={description}
          servings={servings}
          ingredients={ingredients}
          method={method}
          allergens={allergens}
          tags={[...tags, ...dietary]}
          authorName=""
          wastagePercent={wastagePercent}
          foodCostPercent={foodCostPercent}
          calculatedStats={calculatedStats}
          onPrint={() => window.print()}
        />
      </section>
    </div>
  );
}
