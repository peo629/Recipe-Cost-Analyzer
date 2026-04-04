import { useState } from "react";
import { useListIngredients, useCreateIngredient, useUpdateIngredient, useDeleteIngredient, getListIngredientsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/use-debounce";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Search, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { Ingredient } from "@workspace/api-client-react";

const ingredientSchema = z.object({
  name: z.string().min(1, "Name is required"),
  supplier: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  purchaseUnit: z.string().min(1, "Purchase unit is required"),
  purchaseUnitSize: z.coerce.number().min(0.001, "Must be > 0"),
  purchaseCost: z.coerce.number().min(0, "Must be >= 0"),
  recipeUnit: z.string().min(1, "Recipe unit is required"),
});

type IngredientFormValues = z.infer<typeof ingredientSchema>;

const SUPPLIERS = [
  "Woolworths",
  "Coles",
  "HOLCO",
  "PFD",
  "CLAMMS Seafood",
  "Seafood Store",
  "Chefs Pantry",
  "Game Keepers",
  "Delica Meats",
  "Top Cut",
  "5ways",
  "Superfoods",
  "Hudsons",
  "Angelika Bros",
  "Specialty",
];

const ALL_SUPPLIERS_VALUE = "__all__";

const SUPPLIER_FILTER_OPTIONS = [
  { label: "All Suppliers", value: ALL_SUPPLIERS_VALUE },
  { label: "Supermarket", value: "__group_supermarket__", disabled: true },
  { label: "Woolworths", value: "Woolworths" },
  { label: "Coles", value: "Coles" },
  { label: "Seafood", value: "__group_seafood__", disabled: true },
  { label: "CLAMMS Seafood", value: "CLAMMS Seafood" },
  { label: "Seafood Store", value: "Seafood Store" },
  { label: "Meat & Game", value: "__group_meat__", disabled: true },
  { label: "HOLCO", value: "HOLCO" },
  { label: "Top Cut", value: "Top Cut" },
  { label: "Game Keepers", value: "Game Keepers" },
  { label: "Delica Meats", value: "Delica Meats" },
  { label: "Hudsons", value: "Hudsons" },
  { label: "Produce & Specialty", value: "__group_produce__", disabled: true },
  { label: "5ways", value: "5ways" },
  { label: "Superfoods", value: "Superfoods" },
  { label: "Angelika Bros", value: "Angelika Bros" },
  { label: "Pantry & Broadline", value: "__group_pantry__", disabled: true },
  { label: "PFD", value: "PFD" },
  { label: "Chefs Pantry", value: "Chefs Pantry" },
  { label: "Specialty", value: "Specialty" },
];

export default function Ingredients() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [supplierFilter, setSupplierFilter] = useState(ALL_SUPPLIERS_VALUE);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);

  const queryClient = useQueryClient();

  const activeSupplier = supplierFilter === ALL_SUPPLIERS_VALUE ? undefined : supplierFilter;
  const listParams = { search: debouncedSearch || undefined, supplier: activeSupplier };

  const { data: ingredients, isLoading } = useListIngredients(
    listParams,
    { query: { queryKey: getListIngredientsQueryKey(listParams) } }
  );

  const createMutation = useCreateIngredient({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListIngredientsQueryKey() });
        setIsModalOpen(false);
        toast.success("Ingredient created successfully");
      },
      onError: () => toast.error("Failed to create ingredient")
    }
  });

  const updateMutation = useUpdateIngredient({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListIngredientsQueryKey() });
        setIsModalOpen(false);
        toast.success("Ingredient updated successfully");
      },
      onError: () => toast.error("Failed to update ingredient")
    }
  });

  const deleteMutation = useDeleteIngredient({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListIngredientsQueryKey() });
        toast.success("Ingredient deleted");
      },
      onError: () => toast.error("Failed to delete ingredient")
    }
  });

  const form = useForm<IngredientFormValues>({
    resolver: zodResolver(ingredientSchema),
    defaultValues: {
      name: "",
      supplier: "",
      category: "",
      purchaseUnit: "",
      purchaseUnitSize: 1,
      purchaseCost: 0,
      recipeUnit: "",
    }
  });

  const handleOpenCreate = () => {
    setEditingIngredient(null);
    form.reset({
      name: "",
      supplier: "",
      category: "",
      purchaseUnit: "",
      purchaseUnitSize: 1,
      purchaseCost: 0,
      recipeUnit: "",
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (ingredient: Ingredient) => {
    setEditingIngredient(ingredient);
    form.reset({
      name: ingredient.name,
      supplier: ingredient.supplier || "",
      category: ingredient.category || "",
      purchaseUnit: ingredient.purchaseUnit,
      purchaseUnitSize: ingredient.purchaseUnitSize,
      purchaseCost: ingredient.purchaseCost,
      recipeUnit: ingredient.recipeUnit,
    });
    setIsModalOpen(true);
  };

  const onSubmit = (data: IngredientFormValues) => {
    if (editingIngredient) {
      updateMutation.mutate({ id: editingIngredient.id, data });
    } else {
      createMutation.mutate({ data });
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ingredient Library</h1>
          <p className="text-muted-foreground mt-1">Manage your pantry, units, and costs.</p>
        </div>
        <Button onClick={handleOpenCreate} data-testid="button-add-ingredient">
          <Plus className="mr-2 h-4 w-4" />
          Add Ingredient
        </Button>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b bg-muted/20 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 max-w-md min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search ingredients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background"
              data-testid="input-search-ingredients"
            />
          </div>
          <Select value={supplierFilter} onValueChange={setSupplierFilter}>
            <SelectTrigger className="w-[200px] bg-background">
              <SelectValue placeholder="All Suppliers" />
            </SelectTrigger>
            <SelectContent>
              {SUPPLIER_FILTER_OPTIONS.map(({ label, value, disabled }) =>
                disabled ? (
                  <div key={value} className="px-2 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                    {label}
                  </div>
                ) : (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">Purchase Unit</TableHead>
                <TableHead className="text-right">Purchase Cost</TableHead>
                <TableHead className="text-right">Recipe Unit</TableHead>
                <TableHead className="text-right border-l border-border/50 bg-primary/5">Unit Cost</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : ingredients?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    No ingredients found.
                  </TableCell>
                </TableRow>
              ) : (
                ingredients?.map((ing) => (
                  <TableRow key={ing.id} data-testid={`row-ingredient-${ing.id}`}>
                    <TableCell className="font-medium">{ing.name}</TableCell>
                    <TableCell>
                      {ing.category ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground">
                          {ing.category}
                        </span>
                      ) : <span className="text-muted-foreground/50">-</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{ing.supplier || "-"}</TableCell>
                    <TableCell className="text-right">{ing.purchaseUnitSize} {ing.purchaseUnit}</TableCell>
                    <TableCell className="text-right font-medium">${ing.purchaseCost.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{ing.recipeUnit}</TableCell>
                    <TableCell className="text-right border-l border-border/50 bg-primary/5 font-bold text-primary">
                      ${ing.recipeUnitCost.toFixed(4)} <span className="text-xs font-normal text-muted-foreground">/ {ing.recipeUnit}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEdit(ing)} data-testid={`btn-edit-${ing.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" data-testid={`btn-delete-${ing.id}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Ingredient</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete {ing.name}? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => deleteMutation.mutate({ id: ing.id })}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingIngredient ? "Edit Ingredient" : "Add Ingredient"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl><Input {...field} placeholder="e.g. All Purpose Flour" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl><Input {...field} value={field.value || ""} placeholder="e.g. Dry Goods" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="supplier" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} placeholder="Select or type supplier" list="supplier-datalist" />
                    </FormControl>
                    <datalist id="supplier-datalist">
                      {SUPPLIERS.map(s => <option key={s} value={s} />)}
                    </datalist>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="p-4 bg-muted/30 rounded-lg border border-border space-y-4">
                <h4 className="text-sm font-semibold mb-2">Purchase Details</h4>
                <div className="grid grid-cols-3 gap-4">
                  <FormField control={form.control} name="purchaseUnitSize" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Size *</FormLabel>
                      <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="purchaseUnit" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit *</FormLabel>
                      <FormControl><Input {...field} placeholder="kg, L, pack" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="purchaseCost" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cost ($) *</FormLabel>
                      <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>

              <div className="p-4 bg-primary/5 rounded-lg border border-primary/20 space-y-4">
                <h4 className="text-sm font-semibold mb-2 text-primary">Recipe Usage Details</h4>
                <FormField control={form.control} name="recipeUnit" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recipe Unit *</FormLabel>
                    <FormControl><Input {...field} placeholder="g, ml, each" /></FormControl>
                    <p className="text-xs text-muted-foreground mt-1">
                      The unit you typically measure this with in recipes. Cost per unit will be automatically calculated.
                    </p>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingIngredient ? "Save Changes" : "Add Ingredient"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
