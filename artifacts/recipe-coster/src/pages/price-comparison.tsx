import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useListIngredients, getListIngredientsQueryKey, type Ingredient } from "@workspace/api-client-react";
import { useDebounce } from "@/hooks/use-debounce";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Scale, Loader2, X, Award, AlertTriangle, ExternalLink } from "lucide-react";

type Group = {
  key: string;
  displayName: string;
  items: Ingredient[];
  cheapest: Ingredient | null;
  mostExpensive: Ingredient | null;
  savingsPercent: number;
  unitMismatch: boolean;
};

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export default function PriceComparison() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [onlyMulti, setOnlyMulti] = useState(true);
  const [sortKey, setSortKey] = useState<"savings" | "name" | "suppliers">("savings");

  const { data: items, isLoading } = useListIngredients({}, {
    query: { queryKey: getListIngredientsQueryKey({}) },
  });

  const groups = useMemo<Group[]>(() => {
    if (!items) return [];
    const map = new Map<string, Ingredient[]>();
    for (const i of items) {
      const k = normalize(i.name);
      const arr = map.get(k) ?? [];
      arr.push(i);
      map.set(k, arr);
    }
    const result: Group[] = [];
    for (const [key, arr] of map.entries()) {
      const units = new Set(arr.map((i) => i.recipeUnit));
      const unitMismatch = units.size > 1;
      const sorted = arr.slice().sort((a, b) => a.recipeUnitCost - b.recipeUnitCost);
      const cheapest = sorted[0] ?? null;
      const mostExpensive = sorted[sorted.length - 1] ?? null;
      const savingsPercent =
        cheapest && mostExpensive && mostExpensive.recipeUnitCost > 0
          ? ((mostExpensive.recipeUnitCost - cheapest.recipeUnitCost) / mostExpensive.recipeUnitCost) * 100
          : 0;
      result.push({
        key,
        displayName: arr[0].name,
        items: sorted,
        cheapest,
        mostExpensive,
        savingsPercent,
        unitMismatch,
      });
    }
    return result;
  }, [items]);

  const filtered = useMemo(() => {
    let list = groups;
    if (onlyMulti) list = list.filter((g) => g.items.length >= 2);
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.trim().toLowerCase();
      list = list.filter((g) => g.displayName.toLowerCase().includes(q));
    }
    list = list.slice().sort((a, b) => {
      if (sortKey === "name") return a.displayName.localeCompare(b.displayName);
      if (sortKey === "suppliers") return b.items.length - a.items.length;
      return b.savingsPercent - a.savingsPercent;
    });
    return list;
  }, [groups, onlyMulti, debouncedSearch, sortKey]);

  const totalProducts = groups.length;
  const multiSupplierCount = groups.filter((g) => g.items.length >= 2).length;

  const clear = () => {
    setSearch("");
    setOnlyMulti(true);
    setSortKey("savings");
  };

  return (
    <div className="p-8 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Scale className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Price Comparison</h1>
            <p className="text-muted-foreground mt-1">Spot the cheapest source for each product across your suppliers.</p>
          </div>
        </div>
        <Link href="/inventory/product-search">
          <Button variant="outline" data-testid="button-product-search">
            <ExternalLink className="mr-2 h-4 w-4" />
            Product Search
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total Products" value={totalProducts} />
        <StatCard label="Multi-Supplier" value={multiSupplierCount} />
        <StatCard label="Single-Source" value={totalProducts - multiSupplierCount} />
        <StatCard
          label="Avg Savings"
          value={
            multiSupplierCount === 0
              ? "—"
              : `${(
                  groups
                    .filter((g) => g.items.length >= 2)
                    .reduce((s, g) => s + g.savingsPercent, 0) / multiSupplierCount
                ).toFixed(1)}%`
          }
        />
      </div>

      <div className="bg-card border rounded-xl p-4 shadow-sm mb-6">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="relative flex-1 min-w-[240px]">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Search</label>
            <Search className="absolute left-3 top-[calc(50%+10px)] -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filter by product name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background uppercase placeholder:normal-case"
              data-testid="input-comparison-search"
            />
          </div>
          <div className="min-w-[200px]">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Sort By</label>
            <Select value={sortKey} onValueChange={(v) => setSortKey(v as typeof sortKey)}>
              <SelectTrigger className="bg-background" data-testid="select-comparison-sort"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="savings">Biggest Savings</SelectItem>
                <SelectItem value="suppliers">Most Suppliers</SelectItem>
                <SelectItem value="name">Name (A–Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer pb-2.5">
            <Checkbox
              checked={onlyMulti}
              onCheckedChange={(c) => setOnlyMulti(!!c)}
              data-testid="checkbox-only-multi"
            />
            <span className="text-sm">Only multi-supplier products</span>
          </label>
          <Button variant="ghost" onClick={clear} className="pb-2" data-testid="button-clear-comparison">
            <X className="mr-1 h-4 w-4" />Reset
          </Button>
        </div>
      </div>

      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        {isLoading ? "Loading..." : `${filtered.length} product group${filtered.length === 1 ? "" : "s"}`}
      </div>

      {isLoading ? (
        <div className="bg-card border rounded-xl p-12 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-muted/30 border border-dashed rounded-xl p-12 text-center">
          <Scale className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-foreground">Nothing to compare yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Comparison works by grouping products that share the same name. Add the same item from two
            or more suppliers (e.g. "Atlantic Salmon Fillet" from Angelika Bros and Seafood Store) and
            they'll appear here side-by-side.
          </p>
          <div className="mt-4">
            <Link href="/ingredients">
              <Button variant="outline" size="sm">Manage Products</Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((g) => (
            <div key={g.key} className="bg-card border rounded-xl overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b bg-muted/30 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <h2 className="font-semibold">{g.displayName}</h2>
                  <span className="text-xs text-muted-foreground">
                    {g.items.length} supplier{g.items.length === 1 ? "" : "s"}
                  </span>
                  {g.unitMismatch && (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded px-2 py-0.5">
                      <AlertTriangle className="h-3 w-3" />
                      Mixed recipe units — comparison may be inaccurate
                    </span>
                  )}
                </div>
                {g.items.length >= 2 && g.savingsPercent > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded px-2 py-0.5">
                    Save up to {g.savingsPercent.toFixed(1)}%
                  </span>
                )}
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/10 hover:bg-muted/10">
                      <TableHead>Supplier</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Pack Size</TableHead>
                      <TableHead className="text-right">Pack Cost</TableHead>
                      <TableHead className="text-right border-l border-border/50 bg-primary/5">Cost / Unit</TableHead>
                      <TableHead className="text-right">vs Cheapest</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {g.items.map((p) => {
                      const isCheapest = g.cheapest?.id === p.id;
                      const cheapestCost = g.cheapest?.recipeUnitCost ?? p.recipeUnitCost;
                      const diffPct =
                        cheapestCost > 0 ? ((p.recipeUnitCost - cheapestCost) / cheapestCost) * 100 : 0;
                      return (
                        <TableRow
                          key={p.id}
                          className={isCheapest ? "bg-emerald-50/40 dark:bg-emerald-950/10 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/20" : ""}
                          data-testid={`row-comparison-${p.id}`}
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {isCheapest && g.items.length >= 2 && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-900 rounded px-1.5 py-0.5">
                                  <Award className="h-3 w-3" /> Best
                                </span>
                              )}
                              {p.supplier || <span className="text-muted-foreground">(No supplier)</span>}
                            </div>
                          </TableCell>
                          <TableCell>
                            {p.category ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground">
                                {p.category}
                              </span>
                            ) : <span className="text-muted-foreground/50">-</span>}
                          </TableCell>
                          <TableCell className="text-right">{p.purchaseUnitSize} {p.purchaseUnit}</TableCell>
                          <TableCell className="text-right">${p.purchaseCost.toFixed(2)}</TableCell>
                          <TableCell className={`text-right border-l border-border/50 bg-primary/5 font-bold ${isCheapest ? "text-emerald-700 dark:text-emerald-400" : "text-primary"}`}>
                            ${p.recipeUnitCost.toFixed(4)} <span className="text-xs font-normal text-muted-foreground">/ {p.recipeUnit}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            {isCheapest ? (
                              <span className="text-emerald-700 dark:text-emerald-400 font-semibold text-sm">cheapest</span>
                            ) : (
                              <span className="text-muted-foreground text-sm">+{diffPct.toFixed(1)}%</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-card border rounded-xl p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
