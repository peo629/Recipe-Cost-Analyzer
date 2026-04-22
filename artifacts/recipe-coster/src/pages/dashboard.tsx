import { useGetRecipeStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { ChefHat, ListCollapse, Calculator, DollarSign, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { data: stats, isLoading, isError } = useGetRecipeStats();

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <div className="p-8 text-center text-destructive">
        <p>Failed to load dashboard statistics. Please try again later.</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Kitchen Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of your recipe costs and margins.</p>
        </div>
        <Link href="/recipes/new">
          <Button data-testid="button-create-recipe">
            <Plus className="mr-2 h-4 w-4" />
            New Recipe
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Recipes</CardTitle>
            <ChefHat className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="stat-total-recipes">{stats.totalRecipes}</div>
          </CardContent>
        </Card>
        
        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ingredients in Library</CardTitle>
            <ListCollapse className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="stat-total-ingredients">{stats.totalIngredients}</div>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Cost / Portion</CardTitle>
            <Calculator className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="stat-avg-cost">${stats.avgCostPerPortion.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-primary">Avg Suggested Price</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary" data-testid="stat-avg-price">${stats.avgRecommendedSalePrice.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Recent Recipes</h2>
          <Link href="/menu-development/recipe-library">
            <Button variant="outline" size="sm" data-testid="button-view-library">
              View Library
            </Button>
          </Link>
        </div>
        {stats.recentRecipes.length === 0 ? (
          <div className="bg-muted/30 border border-dashed rounded-xl p-12 text-center">
            <ChefHat className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-foreground">No recipes yet</h3>
            <p className="text-muted-foreground mt-2 max-w-sm mx-auto">Get started by building your first recipe. Track your costs and set profitable prices.</p>
            <Link href="/recipes/new" className="mt-6 inline-block">
              <Button variant="outline">Create Recipe</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stats.recentRecipes.map(recipe => (
              <Link key={recipe.id} href={`/recipes/${recipe.id}`}>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer group h-full flex flex-col" data-testid={`card-recipe-${recipe.id}`}>
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg group-hover:text-primary transition-colors">{recipe.title}</CardTitle>
                    </div>
                    {recipe.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-2">{recipe.description}</p>
                    )}
                  </CardHeader>
                  <CardContent className="mt-auto">
                    <div className="flex justify-between items-end pt-4 border-t border-border/50">
                      <div>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Cost</p>
                        <p className="font-semibold">${recipe.costPerPortion.toFixed(2)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-primary font-medium uppercase tracking-wider">Sell At</p>
                        <p className="font-bold text-primary">${recipe.recommendedSalePrice.toFixed(2)}</p>
                      </div>
                    </div>
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
