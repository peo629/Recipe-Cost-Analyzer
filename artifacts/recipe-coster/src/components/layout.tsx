import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { ChefHat, BookOpen, Apple, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);

  const navItems = [
    { href: "/", label: "Dashboard", icon: ChefHat },
    { href: "/recipes/new", label: "New Recipe", icon: BookOpen },
    { href: "/ingredients", label: "Ingredients", icon: Apple },
  ];

  const NavList = () => (
    <nav className="px-4 pb-6 space-y-1">
      {navItems.map((item) => {
        const isActive =
          location === item.href ||
          (item.href !== "/" && location.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent/10 hover:text-sidebar-accent"
            }`}
            data-testid={`nav-${item.label.toLowerCase().replace(" ", "-")}`}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

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

  return (
    <div className="flex min-h-screen bg-background text-foreground flex-col">
      {/* Top app bar with hamburger trigger */}
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
            className="p-0 w-72 max-w-[85vw] bg-sidebar border-sidebar-border"
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
