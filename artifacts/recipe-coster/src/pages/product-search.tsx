import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useListIngredients, getListIngredientsQueryKey } from "@workspace/api-client-react";
import { useDebounce } from "@/hooks/use-debounce";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, PackageSearch, Loader2, X, ExternalLink } from "lucide-react";

const ALL = "__all__";

export default function ProductSearch() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [supplier, setSupplier] = useState(ALL);
  const [category, setCategory] = useState(ALL);
  const [sortKey, setSortKey] = useState<"name" | "supplier" | "category" | "recipeUnitCost">("name");

  const listParams = {
    search: debouncedSearch || undefined,
    supplier: supplier === ALL ? undefined : supplier,
  };

  const { data: items, isLoading } = useListIngredients(listParams, {
    query: { queryKey: getListIngredientsQueryKey(listParams) },
  });

  const suppliers = useMemo(() => {
    const set = new Set<string>();
    items?.forEach((i) => i.supplier && set.add(i.supplier));
    return Array.from(set).sort();
  }, [items]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    items?.forEach((i) => i.category && set.add(i.category));
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(() => {
    if (!items) return [];
    const c = category === ALL ? null : category;
    const list = c ? items.filter((i) => i.category === c) : items.slice();
    list.sort((a, b) => {
      const av = (a as any)[sortKey];
      const bv = (b as any)[sortKey];
      if (typeof av === "number" && typeof bv === "number") return av - bv;
      return String(av ?? "").localeCompare(String(bv ?? ""));
    });
    return list;
  }, [items, category, sortKey]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const i of filtered) {
      const key = i.supplier || "(No supplier)";
      const arr = map.get(key) ?? [];
      arr.push(i);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const clearAll = () => {
    setSearch("");
    setSupplier(ALL);
    setCategory(ALL);
  };

  const hasFilters = !!search || supplier !== ALL || category !== ALL;

  return (
    <div className="p-8 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <PackageSearch className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Product Search</h1>
            <p className="text-muted-foreground mt-1">Look up products and supplier pricing across the inventory.</p>
          </div>
        </div>
        <Link href="/ingredients">
          <Button variant="outline" data-testid="button-manage-products">
            <ExternalLink className="mr-2 h-4 w-4" />
            Manage Products
          </Button>
        </Link>
      </div>

      <div className="bg-card border rounded-xl p-4 shadow-sm mb-6">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="relative flex-1 min-w-[240px]">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Search</label>
            <Search className="absolute left-3 top-[calc(50%+10px)] -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by product name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background uppercase placeholder:normal-case"
              data-testid="input-product-search"
            />
          </div>
          <div className="min-w-[200px]">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Supplier</label>
            <Select value={supplier} onValueChange={setSupplier}>
              <SelectTrigger className="bg-background" data-testid="select-supplier"><SelectValue placeholder="All suppliers" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All suppliers</SelectItem>
                {suppliers.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[200px]">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Category</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="bg-background" data-testid="select-category"><SelectValue placeholder="All categories" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All categories</SelectItem>
                {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[180px]">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Sort By</label>
            <Select value={sortKey} onValueChange={(v) => setSortKey(v as typeof sortKey)}>
              <SelectTrigger className="bg-background" data-testid="select-sort"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name (A–Z)</SelectItem>
                <SelectItem value="supplier">Supplier</SelectItem>
                <SelectItem value="category">Category</SelectItem>
                <SelectItem value="recipeUnitCost">Cost / unit</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {hasFilters && (
            <Button variant="ghost" onClick={clearAll} data-testid="button-clear-filters">
              <X className="mr-1 h-4 w-4" />Clear
            </Button>
          )}
        </div>
      </div>

      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        {isLoading ? "Loading..." : `${filtered.length} product${filtered.length === 1 ? "" : "s"} found`}
      </div>

      {isLoading ? (
        <div className="bg-card border rounded-xl p-12 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-muted/30 border border-dashed rounded-xl p-12 text-center">
          <PackageSearch className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-foreground">No matching products</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {hasFilters
              ? "Try clearing some filters or broadening your search."
              : "Your product database is empty. Add or import products to get started."}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Link href="/ingredients">
              <Button variant="outline" size="sm">Manage Products</Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([supplierName, rows]) => (
            <div key={supplierName} className="bg-card border rounded-xl overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
                <h2 className="font-semibold text-sm uppercase tracking-wide">{supplierName}</h2>
                <span className="text-xs text-muted-foreground">{rows.length} product{rows.length === 1 ? "" : "s"}</span>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/10 hover:bg-muted/10">
                      <TableHead>Product</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Pack Size</TableHead>
                      <TableHead className="text-right">Pack Cost</TableHead>
                      <TableHead className="text-right border-l border-border/50 bg-primary/5">Cost / Unit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((p) => (
                      <TableRow key={p.id} data-testid={`row-product-${p.id}`}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell>
                          {p.category ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground">
                              {p.category}
                            </span>
                          ) : <span className="text-muted-foreground/50">-</span>}
                        </TableCell>
                        <TableCell className="text-right">{p.purchaseUnitSize} {p.purchaseUnit}</TableCell>
                        <TableCell className="text-right font-medium">${p.purchaseCost.toFixed(2)}</TableCell>
                        <TableCell className="text-right border-l border-border/50 bg-primary/5 font-bold text-primary">
                          ${p.recipeUnitCost.toFixed(4)} <span className="text-xs font-normal text-muted-foreground">/ {p.recipeUnit}</span>
                        </TableCell>
                      </TableRow>
                    ))}
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
