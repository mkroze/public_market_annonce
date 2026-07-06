import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { getBlogPost } from "../lib/api";
import type { BlogPost as BlogPostType } from "../lib/types";

const categoryBadgeStyles: Record<string, string> = {
  Guide: "bg-[var(--color-crimson)] text-white",
  Analyse: "bg-[var(--color-gold)] text-white",
  Décryptage: "bg-[var(--color-charcoal)] text-white",
};

function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  const htmlLines: string[] = [];
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Close list if we're no longer on a list item
    if (inList && !line.startsWith("- ")) {
      htmlLines.push("</ul>");
      inList = false;
    }

    // ### heading
    if (line.startsWith("### ")) {
      htmlLines.push(
        `<h3>${applyInline(line.slice(4))}</h3>`
      );
      continue;
    }

    // ## heading
    if (line.startsWith("## ")) {
      htmlLines.push(
        `<h2>${applyInline(line.slice(3))}</h2>`
      );
      continue;
    }

    // List item
    if (line.startsWith("- ")) {
      if (!inList) {
        htmlLines.push("<ul>");
        inList = true;
      }
      htmlLines.push(`<li>${applyInline(line.slice(2))}</li>`);
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      htmlLines.push("");
      continue;
    }

    // Regular paragraph
    htmlLines.push(`<p>${applyInline(line)}</p>`);
  }

  if (inList) {
    htmlLines.push("</ul>");
  }

  return htmlLines.join("\n");
}

function applyInline(text: string): string {
  // Bold: **text**
  return text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPostType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    getBlogPost(slug)
      .then(setPost)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <span className="loading loading-spinner loading-lg text-[var(--color-crimson)]" />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="rounded border border-[var(--color-border)] bg-[var(--color-ivory-dim)] p-4 font-sans text-[var(--color-crimson)]">
          {error || "Article introuvable"}
        </div>
        <Link
          to="/blog"
          className="inline-flex items-center gap-2 mt-4 font-sans text-sm text-[var(--color-crimson)] hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Retour au blog
        </Link>
      </div>
    );
  }

  const contentHtml = post.content ? markdownToHtml(post.content) : "";

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8" style={{ backgroundColor: "var(--color-ivory)" }}>
      <Link
        to="/blog"
        className="inline-flex items-center gap-2 mb-8 font-sans text-sm text-[var(--color-crimson)] hover:underline"
      >
        <ArrowLeft className="w-4 h-4" /> Retour au blog
      </Link>

      <div className="mb-4 flex items-center gap-3">
        <span
          className={`inline-block px-2.5 py-0.5 rounded text-xs font-sans font-semibold uppercase tracking-wide ${
            categoryBadgeStyles[post.category] || "bg-[var(--color-ivory-deep)] text-[var(--color-charcoal)]"
          }`}
        >
          {post.category}
        </span>
        <span className="font-sans text-sm text-[var(--color-slate)]">{post.date}</span>
      </div>

      <h1 className="font-display text-3xl font-bold text-[var(--color-charcoal)] mb-8">
        {post.title}
      </h1>

      <div
        className="prose-academic max-w-none"
        dangerouslySetInnerHTML={{ __html: contentHtml }}
      />
    </div>
  );
}
