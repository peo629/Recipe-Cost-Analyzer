import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import Ingredients from "@/pages/ingredients";
import RecipeBuilder from "@/pages/recipe-builder";
import NotFound from "@/pages/not-found";
import { makeStub } from "@/pages/stub";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        {/* Home */}
        <Route path="/" component={Dashboard} />

        {/* Search */}
        <Route path="/search" component={makeStub("Search", "Global")} />

        {/* Staff Management */}
        <Route path="/staff/directory" component={makeStub("Directory", "Staff Management")} />
        <Route path="/staff/rostering" component={makeStub("Rostering", "Staff Management")} />
        <Route path="/staff/payroll" component={makeStub("Payroll", "Staff Management")} />

        {/* Menu Development */}
        <Route path="/menu-development/recipe-coster" component={Dashboard} />
        <Route path="/menu-development/menus" component={makeStub("Menus", "Menu Development")} />
        <Route path="/menu-development/recipe-generator" component={makeStub("Recipe Generator", "Menu Development")} />

        {/* Inventory */}
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
