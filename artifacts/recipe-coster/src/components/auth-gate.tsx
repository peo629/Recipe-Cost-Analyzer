import { useState, type FormEvent, type ReactNode } from "react";
import { ApiError } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/theme-toggle";

type Mode = "login" | "signup";

interface ApiErrorBody {
  error?: string;
  code?: string;
  reasons?: string[];
}

function readApiError(err: unknown): {
  message: string;
  reasons: string[];
} {
  if (err instanceof ApiError) {
    const data = err.data as ApiErrorBody | null;
    return {
      message: data?.error ?? err.message,
      reasons: data?.reasons ?? [],
    };
  }
  if (err instanceof Error) {
    return { message: err.message, reasons: [] };
  }
  return { message: "Something went wrong. Please try again.", reasons: [] };
}

function GoogleButton() {
  const { loginWithGoogle, googleAvailable } = useAuth();
  if (!googleAvailable) return null;
  return (
    <>
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">
            Or continue with
          </span>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => loginWithGoogle()}
        data-testid="button-google-signin"
      >
        <svg
          className="mr-2 h-4 w-4"
          aria-hidden
          viewBox="0 0 48 48"
          fill="none"
        >
          <path
            d="M44.5 20H24v8.5h11.8C34.7 33.4 30 36.5 24 36.5c-6.9 0-12.5-5.6-12.5-12.5S17.1 11.5 24 11.5c3.2 0 6.1 1.2 8.3 3.2l6.4-6.4C34.6 4.6 29.6 2.5 24 2.5 12.1 2.5 2.5 12.1 2.5 24S12.1 45.5 24 45.5c11 0 20.5-8 20.5-21.5 0-1.4-.1-2.7-.5-4z"
            fill="#FFC107"
          />
          <path
            d="M6.3 14.7l7 5.1C15.2 16 19.2 13.5 24 13.5c3.2 0 6.1 1.2 8.3 3.2l6.4-6.4C34.6 6.6 29.6 4.5 24 4.5 16.2 4.5 9.4 8.6 6.3 14.7z"
            fill="#FF3D00"
          />
          <path
            d="M24 45.5c5.5 0 10.4-2 14-5.4l-6.4-5.4c-2 1.5-4.6 2.4-7.6 2.4-5.9 0-11-4-12.7-9.5l-7 5.4C7.6 40.6 15.1 45.5 24 45.5z"
            fill="#4CAF50"
          />
          <path
            d="M44.5 20H24v8.5h11.8c-.8 2.5-2.5 4.6-4.6 6l6.4 5.4C42.1 36.5 45.5 30.7 45.5 24c0-1.4-.1-2.7-1-4z"
            fill="#1976D2"
          />
        </svg>
        Continue with Google
      </Button>
    </>
  );
}

function LoginForm() {
  const { loginAsync } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await loginAsync({ email, password });
    } catch (err) {
      setError(readApiError(err).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" data-testid="form-login">
      <div className="space-y-2">
        <Label htmlFor="login-email">Email</Label>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          data-testid="input-login-email"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="login-password">Password</Label>
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          data-testid="input-login-password"
        />
      </div>
      {error && (
        <Alert variant="destructive" data-testid="alert-login-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button
        type="submit"
        className="w-full"
        disabled={submitting}
        data-testid="button-login-submit"
      >
        {submitting ? "Signing in…" : "Sign in"}
      </Button>
      <GoogleButton />
    </form>
  );
}

function SignupForm() {
  const { signupAsync } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setReasons([]);
    setSubmitting(true);
    try {
      await signupAsync({
        email,
        password,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
      });
    } catch (err) {
      const parsed = readApiError(err);
      setError(parsed.message);
      setReasons(parsed.reasons);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" data-testid="form-signup">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="signup-first-name">First name</Label>
          <Input
            id="signup-first-name"
            type="text"
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            data-testid="input-signup-first-name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="signup-last-name">Last name</Label>
          <Input
            id="signup-last-name"
            type="text"
            autoComplete="family-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            data-testid="input-signup-last-name"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-email">Email</Label>
        <Input
          id="signup-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          data-testid="input-signup-email"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-password">Password</Label>
        <Input
          id="signup-password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          data-testid="input-signup-password"
        />
        <p className="text-xs text-muted-foreground">
          At least 12 characters with an upper-case letter, lower-case letter,
          digit and special character.
        </p>
      </div>
      {error && (
        <Alert variant="destructive" data-testid="alert-signup-error">
          <AlertTitle>{error}</AlertTitle>
          {reasons.length > 0 && (
            <AlertDescription>
              <ul className="list-disc pl-5 space-y-1 mt-1">
                {reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </AlertDescription>
          )}
        </Alert>
      )}
      <Button
        type="submit"
        className="w-full"
        disabled={submitting}
        data-testid="button-signup-submit"
      >
        {submitting ? "Creating account…" : "Create account"}
      </Button>
      <GoogleButton />
    </form>
  );
}

function AuthScreen({ defaultMode = "login" }: { defaultMode?: Mode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="h-5 w-5 shrink-0 rounded-sm border border-dashed border-border"
          />
          <span className="font-bold tracking-tight">Le Repertoire</span>
        </div>
        <ThemeToggle />
      </header>
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Welcome</CardTitle>
            <CardDescription>
              Sign in to your Le Repertoire workspace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue={defaultMode} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="login" data-testid="tab-login">
                  Sign in
                </TabsTrigger>
                <TabsTrigger value="signup" data-testid="tab-signup">
                  Create account
                </TabsTrigger>
              </TabsList>
              <TabsContent value="login">
                <LoginForm />
              </TabsContent>
              <TabsContent value="signup">
                <SignupForm />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  return <>{children}</>;
}
