import { useState, useMemo, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { 
  useGetRecipe, useCreateRecipe, useUpdateRecipe, 
  useListIngredients, getGetRecipeQueryKey, getListRecipesQueryKey, getListIngredientsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/use-debounce";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ArrowUp, ArrowDown, Check, Loader2, Save, Tags as TagsIcon, ChefHat, Calculator, Printer, Eye } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import type { MethodBlock, MethodBlockType, RecipeIngredientInput, RecipeIngredient } from "@workspace/api-client-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

// Known allergens
const COMMON_ALLERGENS = ["Gluten", "Dairy", "Eggs", "Nuts", "Peanuts", "Shellfish", "Fish", "Soy", "Sesame"];

interface BuilderIngredient extends RecipeIngredientInput {
  _tempId: string;
  name: string;
  recipeUnitCost: number;
  purchaseCost: number;
  purchaseUnitSize: number;
  purchaseUnit: string;
}

interface BuilderMethod extends MethodBlock {
  _tempId: string;
}

export default function RecipeBuilder() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const isEditing = params.id && params.id !== "new";
  const recipeId = isEditing ? parseInt(params.id as string, 10) : undefined;

  const { data: recipe, isLoading: isRecipeLoading } = useGetRecipe(recipeId!, { 
    query: { enabled: !!recipeId, queryKey: getGetRecipeQueryKey(recipeId!) } 
  });

  const createMutation = useCreateRecipe();
  const updateMutation = useUpdateRecipe();

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [servings, setServings] = useState(1);
  const [wastagePercent, setWastagePercent] = useState(10);
  const [foodCostPercent, setFoodCostPercent] = useState(30);
  const [authorName, setAuthorName] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [allergens, setAllergens] = useState<string[]>([]);
  const [ingredients, setIngredients] = useState<BuilderIngredient[]>([]);
  const [method, setMethod] = useState<BuilderMethod[]>([]);
  
  // Tag input state
  const [tagInput, setTagInput] = useState("");

  // Init from recipe
  const initialized = useState(false);
  useEffect(() => {
    if (recipe && !initialized[0]) {
      setTitle(recipe.title);
      setDescription(recipe.description || "");
      setServings(recipe.servings);
      setWastagePercent(recipe.wastagePercent);
      setFoodCostPercent(recipe.foodCostPercent);
      setAuthorName(recipe.authorName || "");
      setTags(recipe.tags || []);
      setAllergens(recipe.allergens || []);
      
      setIngredients(recipe.ingredients.map(i => ({
        _tempId: Math.random().toString(36).substr(2, 9),
        ingredientId: i.ingredientId,
        quantity: i.quantity,
        unit: i.unit,
        name: i.ingredientName,
        recipeUnitCost: i.recipeUnitCost,
        purchaseCost: i.purchaseCost,
        purchaseUnitSize: i.purchaseUnitSize,
        purchaseUnit: i.purchaseUnit
      })));
      
      setMethod(recipe.method.map(m => ({
        _tempId: Math.random().toString(36).substr(2, 9),
        ...m
      })));
      
      initialized[1](true);
    }
  }, [recipe, initialized]);

  // Ingredient search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [ingredientSearch, setIngredientSearch] = useState("");
  const debouncedSearch = useDebounce(ingredientSearch, 300);
  const { data: searchResults, isLoading: isSearchLoading } = useListIngredients(
    { search: debouncedSearch },
    { query: { enabled: searchOpen, queryKey: getListIngredientsQueryKey({ search: debouncedSearch }) } }
  );

  // Calculations
  const calculatedStats = useMemo(() => {
    let totalIngredientCost = 0;
    ingredients.forEach(i => {
      totalIngredientCost += i.quantity * i.recipeUnitCost;
    });

    const costPerPortion = servings > 0 ? totalIngredientCost / servings : 0;
    const wastageCost = totalIngredientCost * (wastagePercent / 100);
    const totalCostWithWastage = totalIngredientCost + wastageCost;
    const costPerPortionWithWastage = servings > 0 ? totalCostWithWastage / servings : 0;
    const recommendedSalePrice = foodCostPercent > 0 ? costPerPortionWithWastage / (foodCostPercent / 100) : 0;

    return {
      totalIngredientCost,
      costPerPortion,
      wastageCost,
      totalCostWithWastage,
      costPerPortionWithWastage,
      recommendedSalePrice
    };
  }, [ingredients, servings, wastagePercent, foodCostPercent]);

  // Handlers
  const handleSave = () => {
    if (!title.trim()) {
      toast.error("Recipe title is required");
      return;
    }
    
    const payload = {
      title,
      description: description || null,
      servings,
      wastagePercent,
      foodCostPercent,
      authorName: authorName || null,
      tags,
      allergens,
      ingredients: ingredients.map(i => ({
        ingredientId: i.ingredientId,
        quantity: i.quantity,
        unit: i.unit
      })),
      method: method.map((m, idx) => ({
        type: m.type,
        content: m.content,
        order: idx
      }))
    };

    if (isEditing && recipeId) {
      updateMutation.mutate(
        { id: recipeId, data: payload },
        {
          onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: getGetRecipeQueryKey(recipeId) });
            queryClient.invalidateQueries({ queryKey: getListRecipesQueryKey() });
            toast.success("Recipe updated");
          },
          onError: () => toast.error("Failed to update recipe")
        }
      );
    } else {
      createMutation.mutate(
        { data: payload },
        {
          onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: getListRecipesQueryKey() });
            toast.success("Recipe created");
            setLocation(`/recipes/${data.id}`);
          },
          onError: () => toast.error("Failed to create recipe")
        }
      );
    }
  };

  const handleAddIngredient = (item: any) => {
    setIngredients(prev => [...prev, {
      _tempId: Math.random().toString(36).substr(2, 9),
      ingredientId: item.id,
      quantity: 1,
      unit: item.recipeUnit,
      name: item.name,
      recipeUnitCost: item.recipeUnitCost,
      purchaseCost: item.purchaseCost,
      purchaseUnitSize: item.purchaseUnitSize,
      purchaseUnit: item.purchaseUnit
    }]);
    setSearchOpen(false);
    setIngredientSearch("");
  };

  const removeIngredient = (tempId: string) => {
    setIngredients(prev => prev.filter(i => i._tempId !== tempId));
  };

  const updateIngredient = (tempId: string, field: string, value: any) => {
    setIngredients(prev => prev.map(i => i._tempId === tempId ? { ...i, [field]: value } : i));
  };

  const addMethodBlock = () => {
    setMethod(prev => [...prev, {
      _tempId: Math.random().toString(36).substr(2, 9),
      type: "text",
      content: "",
      order: prev.length
    }]);
  };

  const updateMethodBlock = (tempId: string, field: keyof MethodBlock, value: any) => {
    setMethod(prev => prev.map(m => m._tempId === tempId ? { ...m, [field]: value } : m));
  };

  const removeMethodBlock = (tempId: string) => {
    setMethod(prev => prev.filter(m => m._tempId !== tempId));
  };

  const moveMethodBlock = (index: number, dir: 1 | -1) => {
    if (index + dir < 0 || index + dir >= method.length) return;
    const newMethod = [...method];
    const temp = newMethod[index];
    newMethod[index] = newMethod[index + dir];
    newMethod[index + dir] = temp;
    setMethod(newMethod);
  };

  const toggleAllergen = (allergen: string) => {
    setAllergens(prev => 
      prev.includes(allergen) ? prev.filter(a => a !== allergen) : [...prev, allergen]
    );
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const newTag = tagInput.trim().toLowerCase();
      if (newTag && !tags.includes(newTag)) {
        setTags([...tags, newTag]);
      }
      setTagInput("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  if (isEditing && isRecipeLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  const [previewOpen, setPreviewOpen] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const previewContent = (
    <PreviewContent
      title={title}
      description={description}
      servings={servings}
      ingredients={ingredients}
      method={method}
      allergens={allergens}
      tags={tags}
      authorName={authorName}
      wastagePercent={wastagePercent}
      foodCostPercent={foodCostPercent}
      calculatedStats={calculatedStats}
      onPrint={handlePrint}
    />
  );

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-[calc(100vh-3.5rem)]">
      {/* LEFT PANEL: Editor */}
      <div className="w-full lg:w-[55%] lg:border-r border-border bg-background flex flex-col h-full overflow-hidden no-print">
        <div className="p-3 sm:p-4 border-b border-border bg-card flex flex-wrap gap-2 justify-between items-center shrink-0 shadow-sm z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="bg-primary/10 p-2 rounded-md shrink-0">
              <ChefHat className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-base sm:text-lg leading-tight truncate">{isEditing ? "Edit Recipe" : "New Recipe"}</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Kitchen precision tool</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* View Card button - visible on mobile/tablet only */}
            <Sheet open={previewOpen} onOpenChange={setPreviewOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="lg:hidden shadow-sm"
                  data-testid="button-view-card"
                >
                  <Eye className="mr-2 h-4 w-4" />
                  <span className="hidden xs:inline">View Card</span>
                  <span className="xs:hidden">View</span>
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="w-full sm:max-w-2xl p-0 overflow-y-auto bg-muted/30"
              >
                <SheetTitle className="sr-only">Recipe preview</SheetTitle>
                {previewContent}
              </SheetContent>
            </Sheet>
            <Button onClick={handleSave} disabled={isPending} size="sm" className="shadow-sm">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              <span className="hidden xs:inline">Save Recipe</span>
              <span className="xs:hidden">Save</span>
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-20">
          {/* Basic Info */}
          <div className="space-y-4 bg-card p-5 rounded-xl border shadow-sm">
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Recipe Title</Label>
              <Input 
                value={title} 
                onChange={e => setTitle(e.target.value)} 
                className="text-lg font-medium py-6"
                placeholder="e.g. Classic Beef Bourguignon" 
              />
            </div>
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Description</Label>
              <Textarea 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                placeholder="Brief description or notes..."
                className="resize-y"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Yield (Servings)</Label>
                <Input type="number" min="1" value={servings} onChange={e => setServings(Number(e.target.value) || 1)} />
              </div>
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Author (Optional)</Label>
                <Input value={authorName} onChange={e => setAuthorName(e.target.value)} placeholder="Chef name" />
              </div>
            </div>
          </div>

          {/* Cost Metrics */}
          <div className="space-y-6 bg-accent/5 p-5 rounded-xl border border-accent/20">
            <h3 className="text-sm font-bold uppercase tracking-wider text-accent flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Target Metrics
            </h3>
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label>Wastage Buffer</Label>
                  <span className="text-sm font-bold text-accent">{wastagePercent}%</span>
                </div>
                <Slider 
                  value={[wastagePercent]} 
                  onValueChange={v => setWastagePercent(v[0])} 
                  max={50} step={1}
                  className="[&_[role=slider]]:bg-accent"
                />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label>Target Food Cost</Label>
                  <span className="text-sm font-bold text-primary">{foodCostPercent}%</span>
                </div>
                <Slider 
                  value={[foodCostPercent]} 
                  onValueChange={v => setFoodCostPercent(v[0])} 
                  min={5} max={50} step={1} 
                />
              </div>
            </div>
          </div>

          {/* Ingredients */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ingredients List</Label>
              
              <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8">
                    <Plus className="mr-2 h-3 w-3" /> Add Ingredient
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="end">
                  <div className="p-2 border-b">
                    <Input 
                      placeholder="Search ingredients..." 
                      value={ingredientSearch}
                      onChange={e => setIngredientSearch(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    {isSearchLoading ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">Searching...</div>
                    ) : searchResults?.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">No ingredients found.</div>
                    ) : (
                      searchResults?.map(item => (
                        <div 
                          key={item.id} 
                          className="px-3 py-2 hover:bg-muted cursor-pointer flex justify-between items-center"
                          onClick={() => handleAddIngredient(item)}
                        >
                          <div>
                            <p className="text-sm font-medium">{item.name}</p>
                            <p className="text-xs text-muted-foreground">${item.recipeUnitCost.toFixed(4)} / {item.recipeUnit}</p>
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
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex gap-3 items-center bg-card p-3 rounded-lg border shadow-sm group"
                  >
                    <div className="w-[200px] truncate font-medium text-sm">{ing.name}</div>
                    <div className="flex-1 flex gap-2">
                      <Input 
                        type="number" 
                        min="0" step="0.01" 
                        value={ing.quantity} 
                        onChange={e => updateIngredient(ing._tempId, 'quantity', Number(e.target.value))}
                        className="w-20 h-8 text-sm"
                      />
                      <Input 
                        value={ing.unit} 
                        onChange={e => updateIngredient(ing._tempId, 'unit', e.target.value)}
                        className="w-24 h-8 text-sm"
                      />
                    </div>
                    <div className="w-24 text-right text-sm font-medium tabular-nums shrink-0">
                      ${(ing.quantity * ing.recipeUnitCost).toFixed(2)}
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeIngredient(ing._tempId)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
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

          {/* Method Editor */}
          <div className="space-y-4 pt-4 border-t border-border">
            <div className="flex justify-between items-center">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Method</Label>
            </div>
            
            <div className="space-y-2">
              {method.map((block, idx) => (
                <div key={block._tempId} className="flex gap-2 items-start bg-card p-3 rounded-lg border shadow-sm">
                  <div className="flex flex-col gap-1 shrink-0 mt-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveMethodBlock(idx, -1)} disabled={idx === 0}>
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveMethodBlock(idx, 1)} disabled={idx === method.length - 1}>
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                  </div>
                  
                  <Select value={block.type} onValueChange={(val: MethodBlockType) => updateMethodBlock(block._tempId, 'type', val)}>
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
                    onChange={e => updateMethodBlock(block._tempId, 'content', e.target.value)}
                    className={`flex-1 h-9 ${block.type === 'header' ? 'font-bold' : ''}`}
                    placeholder={block.type === 'header' ? 'Section title...' : 'Instruction...'}
                  />

                  <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => removeMethodBlock(block._tempId)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" className="w-full border-dashed" onClick={addMethodBlock}>
                <Plus className="mr-2 h-4 w-4" /> Add Block
              </Button>
            </div>
          </div>

          {/* Tags & Allergens */}
          <div className="space-y-6 pt-4 border-t border-border">
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 block">Allergens</Label>
              <div className="flex flex-wrap gap-2">
                {COMMON_ALLERGENS.map(allergen => {
                  const isActive = allergens.includes(allergen);
                  return (
                    <Badge 
                      key={allergen} 
                      variant={isActive ? "default" : "outline"}
                      className={`cursor-pointer transition-colors ${isActive ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' : ''}`}
                      onClick={() => toggleAllergen(allergen)}
                    >
                      {isActive && <Check className="mr-1 h-3 w-3" />}
                      {allergen}
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
                {tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="pl-2 pr-1 py-1">
                    {tag}
                    <div className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5 cursor-pointer" onClick={() => removeTag(tag)}>
                      <Trash2 className="h-3 w-3" />
                    </div>
                  </Badge>
                ))}
              </div>
              <Input 
                placeholder="Type tag and press enter..." 
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                className="max-w-xs h-9"
              />
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: Preview (desktop only - mobile/tablet uses the View Card sheet) */}
      <div className="hidden lg:flex w-[45%] bg-muted/30 flex-col h-full overflow-hidden border-l border-border shadow-inner no-print">
        {previewContent}
      </div>
    </div>
  );
}

function PreviewContent(props: {
  title: string;
  description: string;
  servings: number;
  ingredients: BuilderIngredient[];
  method: BuilderMethod[];
  allergens: string[];
  tags: string[];
  authorName: string;
  wastagePercent: number;
  foodCostPercent: number;
  calculatedStats: {
    totalIngredientCost: number;
    costPerPortion: number;
    wastageCost: number;
    totalCostWithWastage: number;
    costPerPortionWithWastage: number;
    recommendedSalePrice: number;
  };
  onPrint: () => void;
}) {
  const {
    title, description, servings, ingredients, method, allergens, tags,
    authorName, wastagePercent, foodCostPercent, calculatedStats, onPrint,
  } = props;
  return (
    <Tabs defaultValue="card" className="flex flex-col h-full w-full">
      <div className="no-print px-3 sm:px-6 pt-4 pb-0 bg-card border-b shrink-0 flex flex-wrap gap-2 justify-between items-end">
        <TabsList className="bg-transparent space-x-2">
          <TabsTrigger value="card" className="data-[state=active]:bg-muted/50 data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-3 sm:px-4 pb-2 pt-2 text-xs sm:text-sm">
            Recipe Card
          </TabsTrigger>
          <TabsTrigger value="costing" className="data-[state=active]:bg-muted/50 data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-3 sm:px-4 pb-2 pt-2 text-xs sm:text-sm">
            Cost Breakdown
          </TabsTrigger>
        </TabsList>
        <Button
          variant="outline"
          size="sm"
          onClick={onPrint}
          className="mb-2 shadow-sm"
          data-testid="button-print-recipe"
        >
          <Printer className="mr-2 h-4 w-4" />
          Print
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-6 print:p-0 print:overflow-visible">
        <TabsContent value="card" className="m-0 h-full print:m-0">
          <div className="printable-card bg-white text-black p-6 sm:p-8 shadow-xl max-w-2xl mx-auto rounded-md border min-h-[800px] flex flex-col print:shadow-none print:border-0 print:rounded-none print:max-w-none print:min-h-0 print:p-0">
                <div className="border-b-2 border-black pb-4 mb-6">
                  <h1 className="font-serif text-4xl font-bold mb-2">{title || "Untitled Recipe"}</h1>
                  <div className="flex justify-between items-end">
                    {description && <p className="text-gray-600 italic text-sm max-w-md">{description}</p>}
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-widest font-bold text-gray-500">Yield</p>
                      <p className="font-medium text-lg">{servings} Servings</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-8 flex-1">
                  {/* Ingredients Column */}
                  <div className="w-1/3">
                    <h3 className="font-bold uppercase tracking-widest text-xs border-b border-gray-300 pb-1 mb-3">Ingredients</h3>
                    <ul className="space-y-2 text-sm">
                      {ingredients.map(ing => (
                        <li key={ing._tempId} className="flex justify-between border-b border-gray-100 pb-1">
                          <span className="font-medium">{ing.quantity} {ing.unit}</span>
                          <span className="text-gray-600 ml-2">{ing.name}</span>
                        </li>
                      ))}
                      {ingredients.length === 0 && <li className="text-gray-400 italic">No ingredients</li>}
                    </ul>
                  </div>

                  {/* Method Column */}
                  <div className="w-2/3">
                    <h3 className="font-bold uppercase tracking-widest text-xs border-b border-gray-300 pb-1 mb-3">Method</h3>
                    <div className="space-y-3 text-sm">
                      {method.map((m, idx) => {
                        if (m.type === "header") {
                          return <h4 key={m._tempId} className="font-bold text-base mt-4 border-b border-gray-200 pb-1">{m.content}</h4>;
                        }
                        if (m.type === "numbered") {
                          return (
                            <div key={m._tempId} className="flex gap-3">
                              <span className="font-bold shrink-0">{idx + 1}.</span>
                              <p>{m.content}</p>
                            </div>
                          );
                        }
                        if (m.type === "subinstruction") {
                          return (
                            <div key={m._tempId} className="flex gap-3 pl-6 text-gray-600">
                              <span className="shrink-0">-</span>
                              <p>{m.content}</p>
                            </div>
                          );
                        }
                        // Text note
                        return <p key={m._tempId} className="italic text-gray-500">{m.content}</p>;
                      })}
                      {method.length === 0 && <p className="text-gray-400 italic">No method blocks added</p>}
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-4 border-t border-gray-200 text-xs text-gray-500 flex justify-between items-end">
                  <div className="space-y-2">
                    {allergens.length > 0 && (
                      <p><span className="font-bold uppercase tracking-wider text-black">Contains:</span> {allergens.join(", ")}</p>
                    )}
                    {tags.length > 0 && (
                      <p><span className="font-bold uppercase tracking-wider text-black">Tags:</span> {tags.join(", ")}</p>
                    )}
                  </div>
                  {authorName && <p className="italic">Recipe by {authorName}</p>}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="costing" className="m-0 space-y-6">
              {/* Summary Table */}
              <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
                <div className="bg-primary/5 px-4 py-3 border-b">
                  <h3 className="font-bold text-primary flex items-center gap-2">
                    <Calculator className="h-4 w-4" /> Cost Summary
                  </h3>
                </div>
                <div className="p-4 grid grid-cols-2 gap-x-8 gap-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-dashed">
                    <span className="text-muted-foreground text-sm">Raw Ingredient Cost</span>
                    <span className="font-medium tabular-nums">${calculatedStats.totalIngredientCost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-dashed">
                    <span className="text-muted-foreground text-sm">Wastage Buffer ({wastagePercent}%)</span>
                    <span className="font-medium tabular-nums text-destructive">+${calculatedStats.wastageCost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-dashed font-bold">
                    <span className="text-sm">Total Cost w/ Wastage</span>
                    <span className="tabular-nums">${calculatedStats.totalCostWithWastage.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-dashed font-bold">
                    <span className="text-sm">Cost Per Portion</span>
                    <span className="tabular-nums">${calculatedStats.costPerPortionWithWastage.toFixed(2)}</span>
                  </div>
                  <div className="col-span-2 mt-2 bg-primary/10 p-4 rounded-lg flex justify-between items-center border border-primary/20">
                    <div>
                      <span className="block text-xs font-bold uppercase tracking-wider text-primary">Recommended Price</span>
                      <span className="text-xs text-primary/80">Based on {foodCostPercent}% target food cost</span>
                    </div>
                    <span className="text-2xl font-bold text-primary tabular-nums">${calculatedStats.recommendedSalePrice.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Line items */}
              <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b bg-muted/20">
                  <h3 className="font-bold text-sm">Ingredient Line Costs</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/10 text-left text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="p-3 font-medium">Ingredient</th>
                        <th className="p-3 font-medium text-right">Qty</th>
                        <th className="p-3 font-medium text-right">Unit Cost</th>
                        <th className="p-3 font-medium text-right bg-primary/5">Line Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {ingredients.map(ing => (
                        <tr key={ing._tempId}>
                          <td className="p-3 font-medium">{ing.name}</td>
                          <td className="p-3 text-right">{ing.quantity} {ing.unit}</td>
                          <td className="p-3 text-right text-muted-foreground">${ing.recipeUnitCost.toFixed(4)}</td>
                          <td className="p-3 text-right font-medium bg-primary/5 tabular-nums">
                            ${(ing.quantity * ing.recipeUnitCost).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                      {ingredients.length === 0 && (
                        <tr><td colSpan={4} className="p-6 text-center text-muted-foreground italic">No ingredients</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
  );
}
