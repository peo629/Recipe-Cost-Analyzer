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
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Calculator,
  Tags as TagsIcon,
  Check,
} from "lucide-react";
import type { MethodBlockType } from "@workspace/api-client-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  PreviewContent,
  type BuilderIngredient,
  type BuilderMethod,
} from "./recipe-builder";
import { formatCurrency, formatUnitCost } from "@/lib/i18n";

const COMMON_ALLERGENS = [
  "Gluten",
  "Dairy",
  "Eggs",
  "Nuts",
  "Peanuts",
  "Shellfish",
  "Fish",
  "Soy",
  "Sesame",
];
const DIETARY_TAGS = [
  "Vegetarian",
  "Vegan",
  "Gluten-Free",
  "Dairy-Free",
  "Nut-Free",
  "Halal",
  "Kosher",
  "Low-Carb",
  "Keto",
  "Paleo",
];

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
  const [tagInput, setTagInput] = useState("");

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const newTag = tagInput.trim().toLowerCase();
      if (newTag && !tags.includes(newTag)) setTags([...tags, newTag]);
      setTagInput("");
    }
  };
  const removeTag = (tagToRemove: string) =>
    setTags(tags.filter((t) => t !== tagToRemove));

  // Ingredient search
  const [searchOpen, setSearchOpen] = useState(false);
  const [ingredientSearch, setIngredientSearch] = useState("");
  const debouncedSearch = useDebounce(ingredientSearch, 300);
  const { data: searchResults, isLoading: isSearchLoading } =
    useListIngredients(
      { search: debouncedSearch },
      {
        query: {
          enabled: searchOpen,
          queryKey: getListIngredientsQueryKey({ search: debouncedSearch }),
        },
      },
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
    setIngredients((prev) =>
      prev.map((i) => (i._tempId === tempId ? { ...i, [field]: value } : i)),
    );
  };
  const removeIngredient = (tempId: string) =>
    setIngredients((prev) => prev.filter((i) => i._tempId !== tempId));

  const updateMethodBlock = (
    tempId: string,
    field: keyof BuilderMethod,
    value: any,
  ) =>
    setMethod((prev) =>
      prev.map((m) => (m._tempId === tempId ? { ...m, [field]: value } : m)),
    );
  const removeMethodBlock = (tempId: string) =>
    setMethod((prev) => prev.filter((m) => m._tempId !== tempId));
  const addMethodBlock = () =>
    setMethod((prev) => [
      ...prev,
      {
        _tempId: Math.random().toString(36).substr(2, 9),
        type: "text",
        content: "",
        order: prev.length,
      },
    ]);
  const moveMethodBlock = (index: number, dir: 1 | -1) => {
    if (index + dir < 0 || index + dir >= method.length) return;
    const arr = [...method];
    const tmp = arr[index];
    arr[index] = arr[index + dir];
    arr[index + dir] = tmp;
    setMethod(arr);
  };

  const toggle = (
    list: string[],
    value: string,
    setter: (v: string[]) => void,
  ) =>
    setter(
      list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
    );

  // Cost calc (mirror builder)
  const calculatedStats = useMemo(() => {
    const totalIngredientCost = ingredients.reduce(
      (s, i) => s + i.quantity * i.recipeUnitCost,
      0,
    );
    const wastageCost = totalIngredientCost * (wastagePercent / 100);
    const totalCostWithWastage = totalIngredientCost + wastageCost;
    const costPerPortion = servings ? totalIngredientCost / servings : 0;
    const costPerPortionWithWastage = servings
      ? totalCostWithWastage / servings
      : 0;
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

  const canGenerate =
    ingredients.length > 0 &&
    prompt.trim().length > 0 &&
    !generateMutation.isPending;

  const handleGenerate = async () => {
    if (!canGenerate) {
      if (ingredients.length === 0) toast.error("Add at least one ingredient");
      else if (!prompt.trim())
        toast.error("Describe what you want to make in the prompt");
      return;
    }
    generateMutation.mutate(
      {
        data: {
          prompt: prompt.trim(),
          servings,
          dietaryTags: dietary,
          ingredients: ingredients.map((i) => ({
            name: i.name,
            quantity: i.quantity,
            unit: i.unit,
          })),
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
      method: method.map((m, idx) => ({
        type: m.type,
        content: m.content,
        order: idx,
      })),
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
    <div className="p-4 sm:p-6 space-y-8 overflow-y-auto h-full">
      {/* Generate CTA */}
      <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-sm">AI Recipe Generator</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Choose ingredients & dietary tags, describe the dish, then generate.
          Title and method unlock after AI writes the draft.
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

      {/* Header info: Title (locked) + Description/Prompt + Yield */}
      <div className="space-y-4">
        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
            Title
            {!hasGenerated && <Lock className="h-3 w-3" />}
          </Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={!hasGenerated}
            placeholder={
              hasGenerated ? "Recipe title" : "Will be written by AI"
            }
            data-testid="input-title"
          />
        </div>
        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
            Description / AI Prompt
          </Label>
          <Textarea
            value={hasGenerated ? description : prompt}
            onChange={(e) =>
              hasGenerated
                ? setDescription(e.target.value)
                : setPrompt(e.target.value)
            }
            placeholder={
              hasGenerated
                ? "Recipe description (edit freely)"
                : "Describe the dish, technique, style, occasion…"
            }
            className="resize-y"
            data-testid="input-prompt"
          />
          {!hasGenerated && (
            <p className="text-xs text-muted-foreground mt-1">
              Used as the brief for the AI. Be specific.
            </p>
          )}
        </div>
        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
            Yield (Servings)
          </Label>
          <Input
            type="number"
            min="1"
            value={servings}
            onChange={(e) => setServings(Number(e.target.value) || 1)}
            data-testid="input-servings"
          />
        </div>
      </div>

      {/* Cost Metrics — original styling, ABOVE ingredients */}
      <div className="space-y-6 bg-accent/5 p-5 rounded-xl border border-accent/20">
        <h3 className="text-sm font-bold uppercase tracking-wider text-accent flex items-center gap-2">
          <Calculator className="h-4 w-4" />
          Target Metrics
        </h3>
        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-3">
            <div className="flex justify-between">
              <Label>Wastage Buffer</Label>
              <span className="text-sm font-bold text-accent">
                {wastagePercent}%
              </span>
            </div>
            <Slider
              value={[wastagePercent]}
              onValueChange={(v) => setWastagePercent(v[0])}
              max={50}
              step={1}
              className="[&_[role=slider]]:bg-accent"
            />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <Label>Target Food Cost</Label>
              <span className="text-sm font-bold text-primary">
                {foodCostPercent}%
              </span>
            </div>
            <Slider
              value={[foodCostPercent]}
              onValueChange={(v) => setFoodCostPercent(v[0])}
              min={5}
              max={50}
              step={1}
            />
          </div>
        </div>
      </div>

      {/* Ingredients */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Ingredients List
          </Label>
          <Popover open={searchOpen} onOpenChange={setSearchOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                data-testid="button-add-ingredient"
              >
                <Plus className="mr-2 h-3 w-3" /> Add Ingredient
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="end">
              <div className="p-2 border-b">
                <Input
                  placeholder="Search ingredients..."
                  value={ingredientSearch}
                  onChange={(e) => setIngredientSearch(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                {isSearchLoading ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Searching...
                  </div>
                ) : (searchResults ?? []).length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No ingredients found.
                  </div>
                ) : (
                  (searchResults ?? []).map((item: any) => (
                    <div
                      key={item.id}
                      className="px-3 py-2 hover:bg-muted cursor-pointer flex justify-between items-center"
                      onClick={() => handleAddIngredient(item)}
                    >
                      <div>
                        <p className="text-sm font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatUnitCost(Number(item.recipeUnitCost))} /{" "}
                          {item.recipeUnit}
                        </p>
                      </div>
                      <Plus className="h-4 w-4 text-muted-foreground" />
                    </div>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <AnimatePresence>
            {ingredients.map((ing) => (
              <motion.div
                key={ing._tempId}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-card rounded-lg border shadow-sm group"
              >
                <div className="flex gap-3 items-center p-3">
                  <div className="w-[200px] truncate font-medium text-sm">
                    {ing.name}
                  </div>
                  <div className="flex-1 flex gap-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={ing.quantity}
                      onChange={(e) =>
                        updateIngredient(
                          ing._tempId,
                          "quantity",
                          Number(e.target.value),
                        )
                      }
                      className="w-20 h-8 text-sm"
                    />
                    <Input
                      value={ing.unit}
                      onChange={(e) =>
                        updateIngredient(ing._tempId, "unit", e.target.value)
                      }
                      className="w-24 h-8 text-sm"
                    />
                  </div>
                  <div className="w-24 text-right text-sm font-medium tabular-nums shrink-0">
                    {formatCurrency(ing.quantity * ing.recipeUnitCost)}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeIngredient(ing._tempId)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {ingredients.length === 0 && (
            <div className="text-center p-8 border border-dashed rounded-lg text-muted-foreground text-sm">
              No ingredients added yet. Search and add ingredients above.
            </div>
          )}
        </div>
      </div>

      {/* Method (locked until generated) */}
      <div className="space-y-4 pt-4 border-t border-border">
        <div className="flex justify-between items-center">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            Method
            {!hasGenerated && <Lock className="h-3 w-3" />}
          </Label>
          {hasGenerated && (
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={addMethodBlock}
            >
              <Plus className="mr-2 h-3 w-3" /> Add Block
            </Button>
          )}
        </div>

        {!hasGenerated && (
          <div className="text-center p-8 border border-dashed rounded-lg text-muted-foreground text-sm italic">
            Method will be written by AI
          </div>
        )}

        {hasGenerated && (
          <div className="space-y-2">
            {method.map((block, idx) => (
              <div
                key={block._tempId}
                className="flex gap-2 items-start bg-card p-3 rounded-lg border shadow-sm"
              >
                <div className="flex flex-col gap-1 shrink-0 mt-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => moveMethodBlock(idx, -1)}
                    disabled={idx === 0}
                  >
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => moveMethodBlock(idx, 1)}
                    disabled={idx === method.length - 1}
                  >
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                </div>

                <Select
                  value={block.type}
                  onValueChange={(val: MethodBlockType) =>
                    updateMethodBlock(block._tempId, "type", val)
                  }
                >
                  <SelectTrigger className="w-[140px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="header">Header</SelectItem>
                    <SelectItem value="numbered">Step</SelectItem>
                    <SelectItem value="subinstruction">Sub-step</SelectItem>
                    <SelectItem value="text">Note</SelectItem>
                  </SelectContent>
                </Select>

                <Input
                  value={block.content}
                  onChange={(e) =>
                    updateMethodBlock(block._tempId, "content", e.target.value)
                  }
                  className={`flex-1 h-9 ${block.type === "header" ? "font-bold" : ""}`}
                  placeholder={
                    block.type === "header"
                      ? "Section title..."
                      : "Instruction..."
                  }
                />

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-destructive"
                  onClick={() => removeMethodBlock(block._tempId)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Allergens, Dietary tags & custom tags — BELOW ingredients/method */}
      <div className="space-y-6 pt-4 border-t border-border">
        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 block">
            Allergens
          </Label>
          <div className="flex flex-wrap gap-2">
            {COMMON_ALLERGENS.map((allergen) => {
              const isActive = allergens.includes(allergen);
              return (
                <Badge
                  key={allergen}
                  variant={isActive ? "default" : "outline"}
                  className={`cursor-pointer transition-colors ${
                    isActive
                      ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                      : ""
                  }`}
                  onClick={() => toggle(allergens, allergen, setAllergens)}
                >
                  {isActive && <Check className="mr-1 h-3 w-3" />}
                  {allergen}
                </Badge>
              );
            })}
          </div>
        </div>

        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 block">
            Dietary
          </Label>
          <div className="flex flex-wrap gap-2">
            {DIETARY_TAGS.map((d) => {
              const isActive = dietary.includes(d);
              return (
                <Badge
                  key={d}
                  variant={isActive ? "default" : "outline"}
                  className={`cursor-pointer transition-colors ${
                    isActive
                      ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                      : ""
                  }`}
                  onClick={() => toggle(dietary, d, setDietary)}
                  data-testid={`chip-dietary-${d.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {isActive && <Check className="mr-1 h-3 w-3" />}
                  {d}
                </Badge>
              );
            })}
          </div>
        </div>

        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 block flex items-center gap-1">
            <TagsIcon className="h-3 w-3" /> Tags
          </Label>
          <div className="flex flex-wrap gap-2 mb-2">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="pl-2 pr-1 py-1">
                {tag}
                <div
                  className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5 cursor-pointer"
                  onClick={() => removeTag(tag)}
                >
                  <Trash2 className="h-3 w-3" />
                </div>
              </Badge>
            ))}
          </div>
          <Input
            placeholder="Type tag and press enter..."
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            className="max-w-xs h-9"
          />
        </div>
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
          <span className="font-semibold text-sm">Recipe Generator</span>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm">
              <Eye className="h-4 w-4 mr-1" /> Preview
            </Button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="w-full sm:max-w-2xl p-0 overflow-y-auto"
          >
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
