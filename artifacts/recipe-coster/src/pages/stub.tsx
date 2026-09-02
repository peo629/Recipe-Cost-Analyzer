import { Construction } from "lucide-react";

interface StubPageProps {
  title: string;
  group?: string;
  description?: string;
}

export function StubPage({ title, group, description }: StubPageProps) {
  return (
    <div className="p-6 sm:p-10 max-w-3xl mx-auto">
      <div className="bg-card border border-dashed rounded-2xl p-8 sm:p-12 text-center shadow-sm">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-6">
          <Construction className="h-8 w-8" />
        </div>
        {group && (
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
            {group}
          </p>
        )}
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-3">
          {title}
        </h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          {description ||
            "This area is being built. The page will be completed in due course."}
        </p>
      </div>
    </div>
  );
}

export const makeStub =
  (title: string, group?: string, description?: string) => () => (
    <StubPage title={title} group={group} description={description} />
  );
