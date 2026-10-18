# New Hot Design — MP Maroc design language

The north-star look, extracted from the **Guide page** (`frontend/src/pages/Guide.tsx`) plus the
current **Navbar** (`frontend/src/components/Navbar.tsx`) and **Footer**
(`frontend/src/components/Footer.tsx`). Use this to reskin every page to the same vibe.

Everything here is grounded in tokens that already exist in `frontend/src/index.css` (Tailwind v4
`@theme` + daisyUI `academic` theme). Prefer these tokens over raw hex.

---

## 1. The vibe (what makes it feel good)

1. **Framed surfaces.** Content lives inside big, softly-rounded bordered cards on a near-white
   blue-tinted canvas — calm, editorial, "product", not "brochure".
2. **Borders as structure, not shadows.** Sections are split by hairline borders in a grid
   (`border-t` / `md:border-l`), giving a crisp, engineered feel. Shadow is used sparingly for lift.
3. **One big confident headline** with **keyword highlight pills** in periwinkle.
4. **Navy + gold, on white.** Navy (`primary`) is the brand; gold/amber (`warning`) is the single
   accent "spark" — used on one icon or one arrow, never as a fill.
5. **Soft decorative geometry.** Gradient panels, dashed rings, floating dots and a gently floating
   icon tile — playful but restrained, always `aria-hidden`.
6. **Quiet motion.** 200ms transitions, tiny hover lifts (`-translate-y-0.5`), a slow 6s float.
   Everything degrades under `motion-reduce` / `data-motion="off"`.

---

## 2. Foundations

### 2.1 Color tokens
Use CSS var tokens or their Tailwind v4 utility equivalents (`bg-primary`, `text-warning`, …).

| Role | Token | Hex | Notes |
|---|---|---|---|
| Brand | `--color-primary` | `#00236f` | navy; primary buttons, links, active state |
| Brand strong | `--color-primary-strong` | `#1e3a8a` | hover of primary |
| Brand soft | `--color-primary-soft` | `#dce1ff` | **highlight pills**, soft chips, decorative dots |
| Accent | `--color-warning` | `#f59e0b` | the gold "spark": one icon/arrow, focus rings |
| Accent soft | `--color-warning-soft` | `#fff2d8` | decorative gradient stop only |
| Ink | `--color-ink` | `#151c27` | headings, high-emphasis text (also `neutral`) |
| Muted | `--color-muted` | `#444651` | body copy |
| Muted light | `--color-muted-light` | `#757682` | captions, eyebrow-secondary, placeholder |
| Surface | `--color-surface` | `#ffffff` | cards |
| Surface muted | `--color-surface-muted` | `#f0f3ff` | hover fills, decorative blocks |
| App bg | `--color-app-bg` | `#f9f9ff` | page canvas (behind the frames) |
| Border | `--color-border` | `#c5c5d3` | stronger dividers, icon-tile borders |
| Border subtle | `--color-border-subtle` | `#dce2f3` | **default** hairline borders/dividers |
| On-primary | `--color-on-primary` | `#ffffff` | text/icons on navy |

Status: `--color-success #16803a` / `-soft #dff7e8`, `--color-danger #ba1a1a` / `-soft #ffdad6`.

**Rules**
- Text on white: ink → muted → muted-light (three tiers, in that order of emphasis).
- Gold is a garnish. If two golds are visible in one component, remove one.
- Card frame border = `border-[color-mix(in_srgb,var(--color-border-subtle)_80%,transparent)]`.

### 2.2 Typography
- Family: **Inter** everywhere (`--font-display` / `--font-sans`).
- **Hero headline:** `text-[clamp(1.7rem,3.4vw,3rem)] font-semibold leading-[1.12] tracking-[0] text-[var(--color-ink)]`. Keep the max ≈ `3rem` so heroes fit one viewport.
- **Section heading (h2):** `text-base font-bold text-[var(--color-ink)]` (compact) up to `text-2xl`/`text-3xl font-semibold` for standalone section titles.
- **Body / lead:** `text-base leading-7 text-[var(--color-muted)]` (lead can be `max-w-[39rem]`).
- **Eyebrow / label:** `text-xs font-semibold uppercase tracking-[0.08em]` (primary or muted-light).
- **Card kicker title:** `text-sm font-black uppercase tracking-[0.06em] text-[var(--color-ink)]`.

**Highlight pill** (the signature headline treatment):
```html
<span class="rounded-[1.15rem] bg-[var(--color-primary-soft)] px-3 py-0.5
             [box-decoration-break:clone] [-webkit-box-decoration-break:clone]">préparer</span>
```

### 2.3 Radii
Prefer the largest that fits the element.
- Outer frames: `rounded-[1.75rem]` (page/hero card), `rounded-[2rem]` (footer CTA / illustration).
- Inner cards / tiles: `rounded-xl` (icon tiles, step cards), `rounded-2xl` (menus/popovers).
- Pills, buttons, inputs, dock, dots: `rounded-full`.
- Highlight pill: `rounded-[1.15rem]`.

### 2.4 Shadows
Only three, from `index.css`. Cards are mostly flat; shadow = intentional lift.
- `shadow-card` — resting card.
- `shadow-card-hover` — hovered card.
- `shadow-pop` — popovers/menus.
- **Button glow** (navy long-throw): `shadow-[0_16px_36px_-24px_rgba(0,35,111,0.82)]` (or `-24px…0.8` for smaller).
- **Glass dock**: `shadow-[…,inset_0_1px_0_rgba(255,255,255,0.25)]` inset top highlight.

### 2.5 Motion
- Standard: `transition-colors` or `transition-transform duration-200`.
- Hover lift: `hover:-translate-y-0.5` (buttons), arrow nudge `group-hover:translate-x-1`.
- Ambient float: add class `float-soft` (6s ease-in-out loop) to decorative tiles.
- **Always** pair transforms/animation with `motion-reduce:transition-none` (and `motion-reduce:transform-none` where a transform persists). Decorative motion is also killed by `[data-motion="off"]`.

### 2.6 Icons
- Library: **lucide-react**. Inline sizes: `14` (in-text/eyebrow), `16–18` (buttons/nav), `22` (tile), `40` (feature).
- Always `aria-hidden="true"` on decorative icons.
- The **one gold icon** rule: a single `text-[var(--color-warning)]` icon per surface for accent.

### 2.7 Focus (accessibility)
Standard visible focus ring, gold on light surfaces:
```
focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-warning)]
```
Inside bordered grids use `focus-visible:outline-offset-[-2px]` and `outline-[var(--color-primary)]`.

---

## 3. Signature patterns (reuse these first)

### 3.1 The framed card
The default container for any major block.
```html
<section class="mx-auto overflow-hidden rounded-[1.75rem]
  border border-[color-mix(in_srgb,var(--color-border-subtle)_80%,transparent)]
  bg-[var(--color-surface)] shadow-card">…</section>
```

### 3.2 Border-grid sections (dividers, not gaps)
Split a row into a label cell + N equal cells, separated by hairlines that flip top→left at `md`:
```html
<div class="grid border-t border-[var(--color-border-subtle)]
            md:grid-cols-[minmax(15rem,0.75fr)_repeat(3,minmax(0,1fr))]">
  <div class="… px-5 py-5 sm:px-8">…</div>
  <a class="… border-t border-[var(--color-border-subtle)] md:border-l md:border-t-0 …">…</a>
</div>
```

### 3.3 Decorative illustration panel
Soft gradient + dashed rings + floating dots + a floating icon tile. Always `aria-hidden`.
```html
<div class="relative overflow-hidden
  bg-[linear-gradient(135deg,var(--color-primary-soft),var(--color-warning-soft),var(--color-surface))]">
  <!-- pointer-events-none absolute layer: dashed rings + dots -->
  <span class="absolute … h-8 w-8 rounded-full bg-[var(--color-primary-soft)] shadow-card"></span>
  <span class="absolute … h-6 w-6 rounded-full bg-[var(--color-warning)] shadow-card"></span>
  <div class="… rounded-[1rem] bg-[var(--color-primary-soft)] p-2 text-[var(--color-primary)] shadow-card float-soft">
    <Icon size={40} aria-hidden="true" />
  </div>
</div>
```
(`PartsMap` in `Guide.tsx` is the elaborate version; a few rings + 3 dots is the minimal one.)

### 3.4 Eyebrow badge
```html
<div class="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-subtle)]
  px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-primary)]">
  <Sparkles size={14} aria-hidden="true" /> Préparation des candidatures
</div>
```

---

## 4. Components

### 4.1 Navbar — floating glass dock
`Navbar.tsx`. A translucent, blurred pill that floats over the page; not a solid bar.
- Container: `sticky top-0 z-50 bg-transparent`.
- Dock: `rounded-full border border-white/15 bg-primary/10 p-1.5 backdrop-blur-xl shadow-[…,inset_0_1px_0_rgba(255,255,255,0.25)]`.
- Tab: `h-10 rounded-full px-4 text-sm font-semibold text-[var(--color-neutral)] transition-colors`.
  - Active: `bg-white/30` + icon `text-[var(--color-warning)]`.
  - Idle: icon `text-primary/80`, hover `bg-white/15`.
- Right side: circular avatar/menu buttons (`h-11 w-11 rounded-full border bg-surface shadow-card`), primary pill for "Se connecter".
- Menus: `rounded-2xl border bg-surface shadow-pop`.

### 4.2 Footer — CTA card + newsletter volet
`Footer.tsx`. Same framed-card DNA (`rounded-[2rem]`), split two-up:
- **Left volet:** eyebrow → big headline → primary pill CTA (`Suivre les consultations`, gold `ArrowUpRight`).
- **Right volet:** the **decorative gradient panel** (3.3) holding a real newsletter form — heading + copy + rounded-full email input with a **circle submit button** (`grid h-12 w-12 rounded-full bg-primary`). Panel stacks under the left on mobile (`border-t` → `lg:border-l lg:border-t-0`).
- Below the card: brand + link columns (`sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_repeat(2,minmax(0,1fr))]`) and a bottom bar (`border-t … pt-6`, © + legal links).

### 4.3 Hero — framed full-height card
`Guide.tsx` `#parcours`. The template for a page hero / homepage top.
- Frame (3.1) wrapping `flex min-h-[calc(100svh-6.5rem)] flex-col`.
- Content grid: `grid min-h-0 flex-1 items-center gap-6 px-5 py-6 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:py-8`.
  - Left: eyebrow (optional) → headline w/ highlight pills → lead paragraph.
  - Right (`hidden lg:flex`): decorative illustration panel, capped (`max-w-[22rem]`) so the hero fits one screen.
- Bottom: **border-grid tools row** (3.2) — a "Démarrer" pill cell + 3 link cards.
- **Fit-one-screen rule:** keep headline ≤ `3rem`, cap the illustration, use `py-6/py-8` not `py-12/py-14`, and compact rows (`min-h-[6.5rem]`).

### 4.4 Buttons
- **Primary pill:** `inline-flex h-12 items-center gap-2 rounded-full bg-[var(--color-primary)] px-6 text-sm font-semibold text-[var(--color-on-primary)] shadow-[0_16px_36px_-24px_rgba(0,35,111,0.82)] transition-transform hover:-translate-y-0.5 hover:bg-[var(--color-primary-strong)]` + focus ring + `motion-reduce:transition-none`. Optional trailing gold icon.
- **Neutral pill:** daisyUI `btn btn-neutral … rounded-full normal-case` (or bordered surface pill).
- **Circle icon button:** `grid h-12 w-12 place-items-center rounded-full bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-[0_14px_34px_-24px_rgba(0,35,111,0.8)]` + hover lift.

### 4.5 Link / tool card
```html
<a class="group flex min-h-[6.5rem] gap-4 px-5 py-5 no-underline transition-colors
          hover:bg-[var(--color-surface-muted)] …focus ring…">
  <span class="mt-1 grid h-12 w-12 shrink-0 place-items-center rounded-xl
               border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)]">
    <Icon size={22} /></span>
  <span class="min-w-0">
    <span class="flex items-center gap-2 text-sm font-black uppercase tracking-[0.06em] text-[var(--color-ink)]">
      Title <ArrowRight size={17} class="transition-transform group-hover:translate-x-1"/></span>
    <span class="mt-2 block text-sm leading-6 text-[var(--color-muted)]">Description</span>
  </span>
</a>
```

### 4.6 Content / step card
```html
<article class="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5 shadow-card">
  <span class="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-primary)]
               text-sm font-bold text-[var(--color-on-primary)]">1</span>
  <h2 class="mt-4 text-base font-bold text-[var(--color-ink)]">…</h2>
  <p class="mt-2 text-sm leading-6 text-[var(--color-muted)]">…</p>
</article>
```

### 4.7 Form input (rounded-full with leading icon + circle submit)
```html
<div class="relative flex items-center gap-2">
  <div class="relative flex-1">
    <Mail size={16} class="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-muted-light)]"/>
    <input class="h-12 w-full rounded-full border border-[var(--color-border-subtle)]
      bg-[var(--color-surface)] pl-10 pr-4 text-sm text-[var(--color-ink)] outline-none
      transition-colors placeholder:text-[var(--color-muted-light)] focus:border-[var(--color-primary)]"/>
  </div>
  <button class="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--color-primary)] …">
    <ArrowRight size={18}/></button>
</div>
```

---

## 5. Reskin playbook

To bring an existing page up to this language:

1. **Wrap the page top in a framed card** (3.1). Kill full-bleed colored hero bands.
2. **Rebuild the headline** with `clamp(1.7rem,3.4vw,3rem)` + 1–2 highlight pills (3, 2.2).
3. **Convert stacked sections into border-grid rows** (3.2) where it's a set of peers (features, tools, stats). Replace `gap-*` separations with hairline borders.
4. **Replace ad-hoc accent colors** with the token palette (2.1). Exactly one gold accent per surface.
5. **Restyle buttons** to the pill + long-throw shadow (4.4). Inputs → rounded-full + circle submit (4.7).
6. **Add one restrained decorative panel** (3.3) on wide layouts only (`hidden lg:flex`), capped in size.
7. **Normalize radii/shadows** to §2.3 / §2.4. Cards flat by default; `shadow-card` only for real lift.
8. **Motion & a11y pass:** 200ms transitions, `motion-reduce:*`, gold focus rings, `aria-hidden` on decor.
9. **Fit check:** heroes should sit in ~one viewport (§4.3 fit-one-screen rule).

**Reskin checklist (per page)**
- [ ] Content in framed card(s), border-subtle @80%, `shadow-card`
- [ ] Headline uses clamp scale + highlight pill(s)
- [ ] Peer groups use border-grid, not gaps
- [ ] Palette = tokens only; ≤ 1 gold accent per surface
- [ ] Pills + long-throw shadow buttons; rounded-full inputs
- [ ] Optional decorative panel, `hidden lg:flex`, size-capped, `aria-hidden`
- [ ] Radii per scale; flat cards; shadow only for lift
- [ ] Focus rings + `motion-reduce` on every interactive/animated element
- [ ] Text tiers: ink → muted → muted-light

---

## 6. Don'ts
- ❌ Solid full-width colored hero bands (use framed cards on the canvas).
- ❌ Gold as a background/fill, or more than one gold accent per surface.
- ❌ Separating peer blocks with big gaps instead of hairline borders.
- ❌ Drop shadows everywhere — it flattens the "engineered" feel.
- ❌ Raw hex in components — use the tokens.
- ❌ Decorative motion/illustration without `aria-hidden` + `motion-reduce` fallbacks.
- ❌ Headlines that push the hero past one viewport.

---

## 7. Reference implementations
- Hero + tools row + illustration: `frontend/src/pages/Guide.tsx`
- Glass dock navbar: `frontend/src/components/Navbar.tsx`
- CTA card + newsletter volet + border-grid footer: `frontend/src/components/Footer.tsx`
- Tokens, shadows, radii, motion utilities: `frontend/src/index.css`
