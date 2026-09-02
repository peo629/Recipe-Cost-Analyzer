import { useState, useMemo, useRef, useEffect } from "react";
import { Link } from "wouter";
import {
  useListRecipes,
  getListRecipesQueryKey,
  type RecipeSummary,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Library,
  Search as SearchIcon,
  Filter,
  X,
  ChefHat,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/i18n";

type LibraryScope = "my" | "venue" | "global";

interface RecipeWithScope extends RecipeSummary {
  scope: LibraryScope;
}

/**
 * Permissions / scope mapping.
 * Until multi-tenant data exists, all stored recipes are treated as the
 * current user's "My Recipes". Venue and Global tabs render empty.
 * The 3 tabs and the library checkbox filter are wired to operate on this
 * `scope` field so the UI is ready for venue/global data once available.
 */
function deriveScope(_r: RecipeSummary): LibraryScope {
  return "my";
}

/** Parse a comma-separated input string into trimmed lowercased tokens. */
function parseTokens(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Auto-uppercase wrapper for a controlled text input.  Stores upper-cased
 *  string in state so the visible value is always uppercase, while filtering
 *  uses lowercased copies for case-insensitive comparison. */
function useUpperState(initial = "") {
  const [value, setValue] = useState(initial);
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setValue(e.target.value.toUpperCase());
  return [value, onChange, setValue] as const;
}

export default function RecipeLibrary() {
  const { data: recipes, isLoading } = useListRecipes(undefined, {
    query: { queryKey: getListRecipesQueryKey() },
  });

  const recipesWithScope: RecipeWithScope[] = useMemo(
    () => (recipes ?? []).map((r) => ({ ...r, scope: deriveScope(r) })),
    [recipes],
  );

  // Active tab (also doubles as a quick-pick library filter)
  const [tab, setTab] = useState<LibraryScope>("my");

  // Filters
  const [search, onSearch, setSearch] = useUpperState("");
  const [tagFilter, onTagFilter, setTagFilter] = useUpperState("");
  const [dietaryFilter, onDietary, setDietary] = useUpperState("");
  const [typeFilter, onType, setType] = useUpperState("");
  const [ingredientFilter, onIngredient, setIngredient] = useUpperState("");
  const [libraryScopes, setLibraryScopes] = useState<
    Record<LibraryScope, boolean>
  >({
    my: true,
    venue: true,
    global: true,
  });

  const toggleScope = (s: LibraryScope) =>
    setLibraryScopes((prev) => ({ ...prev, [s]: !prev[s] }));

  const clearFilters = () => {
    setSearch("");
    setTagFilter("");
    setDietary("");
    setType("");
    setIngredient("");
    setLibraryScopes({ my: true, venue: true, global: true });
  };

  // Autocomplete suggestions for the main search bar (recipe titles)
  const [showSuggest, setShowSuggest] = useState(false);
  const suggestRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (
        suggestRef.current &&
        !suggestRef.current.contains(e.target as Node)
      ) {
        setShowSuggest(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const suggestions = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return (recipes ?? [])
      .filter((r) => r.title.toLowerCase().includes(q))
      .slice(0, 6);
  }, [search, recipes]);

  // Apply filters
  const filtered = useMemo(() => {
    const tagTokens = parseTokens(tagFilter);
    const dietaryTokens = parseTokens(dietaryFilter);
    const typeTokens = parseTokens(typeFilter);
    const ingredientTokens = parseTokens(ingredientFilter);
    const searchLower = search.trim().toLowerCase();

    return recipesWithScope.filter((r) => {
      // Tab filter (primary scope)
      if (r.scope !== tab) return false;

      // Library checkbox filter (additional gating)
      if (!libraryScopes[r.scope]) return false;

      // Search filter (title or description, case-insensitive)
      if (searchLower) {
        const hay = `${r.title} ${r.description ?? ""}`.toLowerCase();
        if (!hay.includes(searchLower)) return false;
      }

      const tagsLower = (r.tags ?? []).map((t) => t.toLowerCase());
      const allergensLower = (r.allergens ?? []).map((a) => a.toLowerCase());
      const ingsLower = (r.ingredientNames ?? []).map((n) => n.toLowerCase());

      // Tag filter — every token must match at least one tag (case-insensitive substring)
      if (tagTokens.length > 0) {
        const ok = tagTokens.every((tok) =>
          tagsLower.some((t) => t.includes(tok)),
        );
        if (!ok) return false;
      }

      // Dietary filter — match against tags or allergens
      if (dietaryTokens.length > 0) {
        const ok = dietaryTokens.every(
          (tok) =>
            tagsLower.some((t) => t.includes(tok)) ||
            allergensLower.some((a) => a.includes(tok)),
        );
        if (!ok) return false;
      }

      // Recipe type filter — match against tags
      if (typeTokens.length > 0) {
        const ok = typeTokens.every((tok) =>
          tagsLower.some((t) => t.includes(tok)),
        );
        if (!ok) return false;
      }

      // Ingredient filter — every token must match at least one ingredient
      if (ingredientTokens.length > 0) {
        const ok = ingredientTokens.every((tok) =>
          ingsLower.some((n) => n.includes(tok)),
        );
        if (!ok) return false;
      }

      return true;
    });
  }, [
    recipesWithScope,
    tab,
    libraryScopes,
    search,
    tagFilter,
    dietaryFilter,
    typeFilter,
    ingredientFilter,
  ]);

  const tabCounts = useMemo(() => {
    const counts = { my: 0, venue: 0, global: 0 };
    recipesWithScope.forEach((r) => (counts[r.scope] += 1));
    return counts;
  }, [recipesWithScope]);

  const upperInputClass =
    "uppercase placeholder:normal-case placeholder:text-muted-foreground/60";

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-md">
            <Library className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Recipe Library
            </h1>
            <p className="text-sm text-muted-foreground">
              Search, filter and open every saved recipe.
            </p>
          </div>
        </div>
        <Link href="/recipes/new">
          <Button data-testid="button-new-recipe">
            <ChefHat className="mr-2 h-4 w-4" />
            New Recipe
          </Button>
        </Link>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as LibraryScope)}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="my" data-testid="tab-my-recipes">
            My Recipes
            <Badge variant="secondary" className="ml-2 h-5 px-1.5">
              {tabCounts.my}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="venue" data-testid="tab-venue">
            Venue
            <Badge variant="secondary" className="ml-2 h-5 px-1.5">
              {tabCounts.venue}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="global" data-testid="tab-global">
            Global
            <Badge variant="secondary" className="ml-2 h-5 px-1.5">
              {tabCounts.global}
            </Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Search + filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Filter className="h-4 w-4" /> Search & Filters
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              data-testid="button-clear-filters"
            >
              <X className="mr-1.5 h-3.5 w-3.5" /> Clear
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Main search with autocomplete */}
          <div className="relative" ref={suggestRef}>
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
              Search
            </Label>
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={onSearch}
                onFocus={() => setShowSuggest(true)}
                placeholder="Type to search by title or description..."
                className={`pl-9 ${upperInputClass}`}
                data-testid="input-search"
                autoComplete="off"
              />
            </div>
            {showSuggest && suggestions.length > 0 && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg max-h-72 overflow-auto">
                {suggestions.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setSearch(r.title.toUpperCase());
                      setShowSuggest(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex justify-between items-center"
                    data-testid={`suggest-${r.id}`}
                  >
                    <span className="font-medium truncate">{r.title}</span>
                    <span className="text-xs text-muted-foreground ml-2 shrink-0">
                      {formatCurrency(r.costPerPortion)} / portion
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                Tag Filter
              </Label>
              <Input
                value={tagFilter}
                onChange={onTagFilter}
                placeholder="comma, separated, tags"
                className={upperInputClass}
                data-testid="input-tag-filter"
              />
            </div>

            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                Dietary Filter
              </Label>
              <Input
                value={dietaryFilter}
                onChange={onDietary}
                placeholder="e.g. vegan, gluten-free"
                className={upperInputClass}
                data-testid="input-dietary-filter"
              />
            </div>

            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                Recipe Type Filter
              </Label>
              <Input
                value={typeFilter}
                onChange={onType}
                placeholder="e.g. main, dessert, side"
                className={upperInputClass}
                data-testid="input-type-filter"
              />
            </div>

            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                Ingredient Filter
              </Label>
              <Input
                value={ingredientFilter}
                onChange={onIngredient}
                placeholder="e.g. beef, onion, thyme"
                className={upperInputClass}
                data-testid="input-ingredient-filter"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
              Library Filter
            </Label>
            <div className="flex flex-wrap gap-4">
              {(["my", "venue", "global"] as LibraryScope[]).map((s) => (
                <label
                  key={s}
                  className="flex items-center gap-2 cursor-pointer select-none"
                  data-testid={`checkbox-library-${s}`}
                >
                  <Checkbox
                    checked={libraryScopes[s]}
                    onCheckedChange={() => toggleScope(s)}
                  />
                  <span className="text-sm capitalize">
                    {s === "my" ? "My Recipes" : s}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            {isLoading
              ? "Loading..."
              : `${filtered.length} ${filtered.length === 1 ? "recipe" : "recipes"}`}
          </h2>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-muted/30 border border-dashed rounded-xl p-12 text-center">
            <Library className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium">No matching recipes</h3>
            <p className="text-muted-foreground mt-2 max-w-sm mx-auto text-sm">
              {tab !== "my"
                ? `${tab === "venue" ? "Venue" : "Global"} recipes will appear here once that scope is enabled.`
                : "Try clearing some filters or change the active tab."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((recipe) => (
              <Link key={recipe.id} href={`/recipes/${recipe.id}`}>
                <Card
                  className="hover:border-primary/50 transition-colors cursor-pointer h-full flex flex-col"
                  data-testid={`card-recipe-${recipe.id}`}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg leading-tight">
                      {recipe.title}
                    </CardTitle>
                    {recipe.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {recipe.description}
                      </p>
                    )}
                    {recipe.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {recipe.tags.slice(0, 4).map((t) => (
                          <Badge
                            key={t}
                            variant="secondary"
                            className="text-xs"
                          >
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="mt-auto">
                    <div className="flex justify-between items-end pt-3 border-t border-border/50">
                      <div>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                          Cost
                        </p>
                        <p className="font-semibold tabular-nums">
                          {formatCurrency(recipe.costPerPortion)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-primary font-medium uppercase tracking-wider">
                          Sell At
                        </p>
                        <p className="font-bold text-primary tabular-nums">
                          {formatCurrency(recipe.recommendedSalePrice)}
                        </p>
                      </div>
                    </div>
                    <p
                      className="text-[10px] text-muted-foreground/70 mt-2 tabular-nums"
                      data-testid={`recipe-updated-${recipe.id}`}
                    >
                      Updated {formatDate(recipe.updatedAt)}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
