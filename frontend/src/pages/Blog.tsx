import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getBlogPosts } from "../lib/api";
import type { BlogPost } from "../lib/types";

const categoryBadgeStyles: Record<string, string> = {
  Guide: "bg-[var(--color-crimson)] text-white",
  Analyse: "bg-[var(--color-gold)] text-white",
  Décryptage: "bg-[var(--color-charcoal)] text-white",
};

export default function Blog() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBlogPosts()
      .then((res) => setPosts(res.posts))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <span className="loading loading-spinner loading-lg text-[var(--color-crimson)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="rounded border border-[var(--color-border)] bg-[var(--color-ivory-dim)] p-4 font-sans text-[var(--color-crimson)]">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8" style={{ backgroundColor: "var(--color-ivory)" }}>
      <div className="text-center mb-12">
        <h1 className="font-display text-4xl font-bold text-[var(--color-charcoal)] mb-4">
          Blog
        </h1>
        <p className="font-sans text-lg text-[var(--color-slate)]">
          Guides pratiques, conseils et actualités sur les marchés publics
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {posts.map((post) => (
          <div
            key={post.slug}
            className="rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory-dim)] flex flex-col"
          >
            <div className="p-6 flex flex-col flex-1">
              <div>
                <span
                  className={`inline-block px-2.5 py-0.5 rounded text-xs font-sans font-semibold uppercase tracking-wide ${
                    categoryBadgeStyles[post.category] || "bg-[var(--color-ivory-deep)] text-[var(--color-charcoal)]"
                  }`}
                >
                  {post.category}
                </span>
              </div>
              <h2 className="font-display text-xl font-bold text-[var(--color-charcoal)] mt-3">
                {post.title}
              </h2>
              <p className="font-sans text-[var(--color-slate)] mt-2 flex-1">
                {post.summary}
              </p>
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--color-border-subtle)]">
                <span className="font-sans text-sm text-[var(--color-slate)]">
                  {post.date}
                </span>
                <Link
                  to={`/blog/${post.slug}`}
                  className="font-sans text-sm font-semibold text-[var(--color-crimson)] hover:underline"
                >
                  Lire la suite
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {posts.length === 0 && (
        <p className="text-center font-sans text-[var(--color-slate)] mt-8">
          Aucun article pour le moment.
        </p>
      )}
    </div>
  );
}
