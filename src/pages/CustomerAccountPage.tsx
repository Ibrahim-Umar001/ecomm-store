import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ApiError, apiRequest } from "../api/client";
import { usePageMetadata } from "../hooks/usePageMetadata";

interface Customer {
  name: string;
  email: string;
}

type AccountMode = "login" | "register";

export default function CustomerAccountPage() {
  const [mode, setMode] = useState<AccountMode>("login");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  usePageMetadata(
    "Your account — goodthings",
    "Sign in or create a goodthings customer account.",
  );

  useEffect(() => {
    const controller = new AbortController();
    void apiRequest<{ customer: Customer }>("/customer/me", { signal: controller.signal })
      .then((result) => {
        setCustomer(result.customer);
        setError("");
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        if (cause instanceof ApiError && cause.status === 401) return;
        setError(cause instanceof Error ? cause.message : "Your account could not be loaded.");
      })
      .finally(() => setIsChecking(false));
    return () => controller.abort();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const endpoint = mode === "register" ? "/customer/register" : "/customer/login";
      const result = await apiRequest<{ customer: Customer }>(endpoint, {
        method: "POST",
        body: JSON.stringify({
          ...(mode === "register" ? { name: form.get("name") } : {}),
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      setCustomer(result.customer);
      setMessage(mode === "register" ? "Your account is ready." : "You’re signed in.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We couldn’t complete that request.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function logout() {
    setIsSubmitting(true);
    setError("");
    setMessage("");
    try {
      await apiRequest<void>("/customer/logout", { method: "POST" });
      setCustomer(null);
      setMode("login");
      setMessage("You’ve signed out.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "You couldn’t be signed out.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="page-shell account-page">
      <div className="account-card">
        <p className="eyebrow">YOUR GOODTHINGS ACCOUNT</p>
        {isChecking ? (
          <p role="status">Checking your account…</p>
        ) : customer ? (
          <div className="account-welcome">
            <h1>Welcome, {customer.name}.</h1>
            <p>You’re signed in as <strong>{customer.email}</strong>.</p>
            <Link className="button button-dark" to="/">Keep exploring <span aria-hidden="true">→</span></Link>
            <button className="button button-light account-logout" type="button" disabled={isSubmitting} onClick={() => void logout()}>
              {isSubmitting ? "Signing out…" : "Sign out"}
            </button>
          </div>
        ) : (
          <>
            <h1>{mode === "login" ? "Welcome back." : "Make yourself at home."}</h1>
            <p className="account-intro">
              {mode === "login"
                ? "Sign in to your goodthings account."
                : "Create an account to make your next visit feel a little easier."}
            </p>
            <div className="account-tabs" role="tablist" aria-label="Customer account">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "login"}
                className={mode === "login" ? "active" : ""}
                onClick={() => {
                  setMode("login");
                  setError("");
                  setMessage("");
                }}
              >
                Sign in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "register"}
                className={mode === "register" ? "active" : ""}
                onClick={() => {
                  setMode("register");
                  setError("");
                  setMessage("");
                }}
              >
                Create account
              </button>
            </div>
            <form className="account-form" onSubmit={(event) => void submit(event)}>
              {mode === "register" && (
                <>
                  <label className="field-label" htmlFor="customer-name">Full name</label>
                  <input
                    className="form-control"
                    id="customer-name"
                    name="name"
                    autoComplete="name"
                    required
                    minLength={2}
                    maxLength={120}
                  />
                </>
              )}
              <label className="field-label" htmlFor="customer-email">Email</label>
              <input
                className="form-control"
                id="customer-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
              />
              <label className="field-label" htmlFor="customer-password">Password</label>
              <input
                className="form-control"
                id="customer-password"
                name="password"
                type="password"
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                required
                minLength={mode === "register" ? 8 : undefined}
                maxLength={72}
              />
              {mode === "register" && (
                <p className="account-password-hint">Use at least 8 characters.</p>
              )}
              {error && <p className="form-error" role="alert">{error}</p>}
              {message && <p className="shipping-note" role="status">{message}</p>}
              <button className="button button-dark" type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? mode === "register" ? "Creating account…" : "Signing in…"
                  : mode === "register" ? "Create account" : "Sign in"}
                <span aria-hidden="true">→</span>
              </button>
            </form>
          </>
        )}
        {error && customer && <p className="form-error" role="alert">{error}</p>}
        {message && customer && <p className="shipping-note" role="status">{message}</p>}
        <Link className="account-back-link" to="/">Back to storefront</Link>
      </div>
    </section>
  );
}
