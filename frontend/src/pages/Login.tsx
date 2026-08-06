import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn } from "lucide-react";
import { login } from "../lib/api";
import { useAuth } from "../lib/auth";

export default function Login() {
  const { setAuth } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await login(email, password);
      setAuth(res.token, res.user);
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 sm:px-6 py-8">
      <div className="w-full max-w-md border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory)] p-8">
        <h2 className="font-display text-2xl text-[var(--color-charcoal)] text-center flex items-center justify-center gap-2 mb-6">
          <LogIn className="w-6 h-6 text-[var(--color-crimson)]" />
          Se connecter
        </h2>

        {error && (
          <div className="border border-[var(--color-border-subtle)] border-l-4 border-l-[var(--color-crimson)] rounded bg-[var(--color-ivory-dim)] p-3 mb-4">
            <span className="font-sans text-sm text-[var(--color-charcoal)]">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="form-control">
            <label className="label">
              <span className="label-academic">Email</span>
            </label>
            <input
              type="email"
              className="input input-bordered font-sans bg-base-100 border-[var(--color-border-subtle)] w-full rounded"
              placeholder="email@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-academic">Mot de passe</span>
            </label>
            <input
              type="password"
              className="input input-bordered font-sans bg-base-100 border-[var(--color-border-subtle)] w-full rounded"
              placeholder="********"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className={`btn btn-primary font-sans font-semibold w-full mt-2 rounded ${loading ? "loading" : ""}`}
            disabled={loading}
          >
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>
      </div>
    </div>
  );
}
