import { ReactNode, useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import {
  ChefHat,
  Home,
  Search,
  Users,
  UtensilsCrossed,
  Boxes,
  UserPlus,
  Menu,
  ChevronDown,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type Leaf = { href: string; label: string };
type Group = { id: string; label: string; icon: React.ComponentType<{ className?: string }>; children: Leaf[] };
type TopLink = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };
type NavEntry = TopLink | Group;

const isGroup = (e: NavEntry): e is Group => "children" in e;

const NAV: NavEntry[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/search", label: "Search", icon: Search },
  {
    id: "staff",
    label: "Staff Management",
    icon: Users,
    children: [
      { href: "/staff/directory", label: "Directory" },
      { href: "/staff/rostering", label: "Rostering" },
      { href: "/staff/payroll", label: "Payroll" },
    ],
  },
  {
    id: "menu-development",
    label: "Menu Development",
    icon: UtensilsCrossed,
    children: [
      { href: "/menu-development/recipe-coster", label: "Recipe Coster" },
      { href: "/menu-development/recipe-library", label: "Recipe Library" },
      { href: "/menu-development/menus", label: "Menus" },
      { href: "/menu-development/recipe-generator", label: "Recipe Generator" },
    ],
  },
  {
    id: "inventory",
    label: "Inventory",
    icon: Boxes,
    children: [
      { href: "/inventory/product-search", label: "Product Search" },
      { href: "/inventory/suppliers", label: "Suppliers" },
      { href: "/inventory/ordering", label: "Ordering" },
      { href: "/inventory/stocktake", label: "Stocktake" },
    ],
  },
  {
    id: "onboarding",
    label: "Onboarding",
    icon: UserPlus,
    children: [
      { href: "/onboarding/people", label: "People" },
      { href: "/onboarding/venues", label: "Venues" },
      { href: "/onboarding/companies", label: "Companies" },
    ],
  },
];

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  // Auto-expand the group that contains the current route
  const defaultOpenGroup = useMemo(() => {
    for (const entry of NAV) {
      if (isGroup(entry)) {
        if (entry.children.some((c) => location.startsWith(c.href))) {
          return entry.id;
        }
      }
    }
    return undefined;
  }, [location]);

  const linkClass = (active: boolean) =>
    `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      active
        ? "bg-primary text-primary-foreground"
        : "text-sidebar-foreground hover:bg-sidebar-accent/10 hover:text-sidebar-accent"
    }`;

  const Brand = () => (
    <div className="p-6">
      <h1 className="text-xl font-bold text-sidebar-foreground tracking-tight flex items-center gap-2">
        <ChefHat className="h-6 w-6 text-primary" />
        Recipe Coster
      </h1>
      <p className="text-xs text-sidebar-foreground/60 mt-1 uppercase tracking-wider font-semibold">
        Precision Kitchen Tool
      </p>
    </div>
  );

  const NavList = () => (
    <nav className="px-3 pb-6">
      <Accordion
        type="single"
        collapsible
        defaultValue={defaultOpenGroup}
        className="w-full"
      >
        {NAV.map((entry) => {
          if (!isGroup(entry)) {
            const isActive = location === entry.href;
            return (
              <Link
                key={entry.href}
                href={entry.href}
                onClick={close}
                className={linkClass(isActive) + " mb-1"}
                data-testid={`nav-${entry.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <entry.icon className="h-4 w-4 shrink-0" />
                {entry.label}
              </Link>
            );
          }

          const groupActive = entry.children.some((c) =>
            location.startsWith(c.href),
          );

          return (
            <AccordionItem
              key={entry.id}
              value={entry.id}
              className="border-b-0"
            >
              <AccordionTrigger
                className={`px-3 py-2 rounded-md text-sm font-medium hover:no-underline ${
                  groupActive
                    ? "text-sidebar-accent"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/10 hover:text-sidebar-accent"
                }`}
                data-testid={`nav-group-${entry.id}`}
              >
                <span className="flex items-center gap-3">
                  <entry.icon className="h-4 w-4 shrink-0" />
                  {entry.label}
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-1 pt-1">
                <div className="ml-4 pl-4 border-l border-sidebar-border space-y-1">
                  {entry.children.map((child) => {
                    const active = location === child.href;
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={close}
                        className={linkClass(active)}
                        data-testid={`nav-${child.href.replace(/\//g, "-").slice(1)}`}
                      >
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-background text-foreground flex-col">
      <header className="no-print sticky top-0 z-40 flex items-center gap-2 border-b border-border bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60 px-3 sm:px-4 h-14 shrink-0">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Open menu"
              data-testid="button-menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="p-0 w-80 max-w-[85vw] bg-sidebar border-sidebar-border overflow-y-auto"
          >
            <SheetTitle className="sr-only">Navigation menu</SheetTitle>
            <Brand />
            <NavList />
          </SheetContent>
        </Sheet>

        <Link href="/" className="flex items-center gap-2 min-w-0">
          <ChefHat className="h-5 w-5 text-primary shrink-0" />
          <span className="font-bold tracking-tight truncate">Recipe Coster</span>
        </Link>
      </header>

      <main className="flex-1 overflow-auto bg-background">{children}</main>
    </div>
  );
}
