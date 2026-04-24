import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import Ingredients from "@/pages/ingredients";
import RecipeBuilder from "@/pages/recipe-builder";
import RecipeLibrary from "@/pages/recipe-library";
import ProductSearch from "@/pages/product-search";
import PriceComparison from "@/pages/price-comparison";
import RecipeGenerator from "@/pages/recipe-generator";
import NotFound from "@/pages/not-found";
import { makeStub } from "@/pages/stub";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        {/* Home */}
        <Route
          path="/"
          component={makeStub(
            "Welcome",
            "Home",
            "Open the menu to navigate to your workspace areas. The Recipe Coster lives under Menu Development.",
          )}
        />

        {/* Search */}
        <Route path="/search" component={makeStub("Search", "Global")} />

        {/* Staff Management */}
        <Route path="/staff/directory" component={makeStub("Directory", "Staff Management")} />
        <Route path="/staff/rostering" component={makeStub("Rostering", "Staff Management")} />
        <Route path="/staff/payroll" component={makeStub("Payroll", "Staff Management")} />

        {/* Menu Development */}
        <Route path="/menu-development/recipe-coster" component={Dashboard} />
        <Route path="/menu-development/recipe-library" component={RecipeLibrary} />
        <Route path="/menu-development/menus" component={makeStub("Menus", "Menu Development")} />
        <Route path="/menu-development/recipe-generator" component={RecipeGenerator} />

        {/* Inventory */}
        <Route path="/inventory/product-search" component={ProductSearch} />
        <Route path="/inventory/price-comparison" component={PriceComparison} />
        <Route path="/inventory/suppliers" component={makeStub("Suppliers", "Inventory")} />
        <Route path="/inventory/ordering" component={makeStub("Ordering", "Inventory")} />
        <Route path="/inventory/stocktake" component={makeStub("Stocktake", "Inventory")} />

        {/* Onboarding */}
        <Route path="/onboarding/people" component={makeStub("People", "Onboarding")} />
        <Route path="/onboarding/venues" component={makeStub("Venues", "Onboarding")} />
        <Route path="/onboarding/companies" component={makeStub("Companies", "Onboarding")} />

        {/* Existing recipe coster routes (kept for direct access) */}
        <Route path="/ingredients" component={Ingredients} />
        <Route path="/recipes/new" component={RecipeBuilder} />
        <Route path="/recipes/:id" component={RecipeBuilder} />

        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
