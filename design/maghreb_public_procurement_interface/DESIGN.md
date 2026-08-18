---
name: Maghreb Public Procurement Interface
colors:
  surface: '#f9f9ff'
  surface-dim: '#d3daea'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f3ff'
  surface-container: '#e7eefe'
  surface-container-high: '#e2e8f8'
  surface-container-highest: '#dce2f3'
  on-surface: '#151c27'
  on-surface-variant: '#444651'
  inverse-surface: '#2a313d'
  inverse-on-surface: '#ebf1ff'
  outline: '#757682'
  outline-variant: '#c5c5d3'
  surface-tint: '#4059aa'
  primary: '#00236f'
  on-primary: '#ffffff'
  primary-container: '#1e3a8a'
  on-primary-container: '#90a8ff'
  inverse-primary: '#b6c4ff'
  secondary: '#5c5f60'
  on-secondary: '#ffffff'
  secondary-container: '#dee0e2'
  on-secondary-container: '#606365'
  tertiary: '#3e2400'
  on-tertiary: '#ffffff'
  tertiary-container: '#5c3800'
  on-tertiary-container: '#ef9900'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dce1ff'
  primary-fixed-dim: '#b6c4ff'
  on-primary-fixed: '#00164e'
  on-primary-fixed-variant: '#264191'
  secondary-fixed: '#e1e2e4'
  secondary-fixed-dim: '#c5c6c8'
  on-secondary-fixed: '#191c1e'
  on-secondary-fixed-variant: '#444749'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#f9f9ff'
  on-background: '#151c27'
  surface-variant: '#dce2f3'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  container-padding: 24px
  gutter: 16px
  element-gap-sm: 8px
  element-gap-md: 16px
  section-margin: 32px
---

## Brand & Style
The design system is engineered for high-stakes public sector administration, specifically tailored for the Moroccan public tender landscape. The brand personality is **authoritative, transparent, and efficient**. It aims to evoke a sense of institutional stability and meticulous organization, essential for managing large-scale government contracts.

The design style is **Corporate Modern**, prioritizing information density and clarity over decorative elements. It utilizes a structured layout with subtle borders and clear compartmentalization to handle complex data sets. The aesthetic remains professional and "official," using a clean white and light-grey foundation to ensure that critical status indicators and deadlines remain the primary focus.

## Colors
The palette is rooted in a deep **Primary Dark Blue (#1E3A8A)**, representing the authority of the state and professional reliability. This is used for navigation, primary actions, and brand-critical headers.

**Secondary Light Grey (#F3F4F6)** serves as the canvas for the entire application, providing a soft background that reduces eye strain during long periods of data entry and review. 

The **Amber Accent (#F59E0B)** is reserved strictly for time-sensitive information, such as submission deadlines, pending approvals, and urgent notifications. This high-contrast pairing against the blue and grey ensures that no critical date is overlooked.

Neutral greys are used for borders and secondary text to maintain a sophisticated, low-distraction environment.

## Typography
This design system employs **Inter** for all roles to achieve a systematic and utilitarian feel. The typeface was chosen for its exceptional legibility at small sizes, which is critical for dense data tables and complex forms.

- **Headlines:** Use tighter letter-spacing and heavier weights to establish a clear information hierarchy.
- **Body:** Set at 14px for the standard density, allowing for significant content visibility without sacrificing readability.
- **Labels:** Small, uppercase labels are used for metadata and table headers to distinguish them from actionable data.
- **Numerical Data:** Since this is a procurement platform, ensure tabular figures (monospaced numbers) are utilized in data grids to allow for easy vertical scanning of currency and quantities.

## Layout & Spacing
The layout follows a **Fixed Grid** approach for the main content area (max-width: 1440px) to ensure consistency in data visualization, while the side navigation remains fixed. 

- **Desktop:** 12-column grid with 16px gutters. Heavy use of whitespace is avoided in favor of a "compact" density that allows administrators to see more information at once.
- **Tablet:** 8-column grid with 16px margins. Content stacks logically, with data tables becoming horizontally scrollable.
- **Mobile:** 4-column grid with 16px margins. Complex tables are transformed into card-based summaries.

The spacing rhythm is based on a **4px baseline**, ensuring that all elements align perfectly within the structured grid.

## Elevation & Depth
In alignment with the "Institutional" feel, this design system avoids heavy shadows. Depth is communicated through **Tonal Layers** and **Low-Contrast Outlines**.

- **Level 0 (Background):** Secondary Light Grey (#F3F4F6).
- **Level 1 (Cards/Surface):** Pure White (#FFFFFF) with a 1px solid border (#E5E7EB).
- **Level 2 (Modals/Popovers):** Pure White with a very subtle, diffused shadow (0px 4px 6px rgba(0,0,0,0.05)) to separate it from the main interface.
- **Dividers:** 1px hairline strokes in #E5E7EB are used to separate rows in tables and sections in forms, maintaining structure without adding visual noise.

## Shapes
The shape language is **Soft** (roundedness: 1), using a 0.25rem (4px) base radius. This provides a modern touch while maintaining a disciplined, professional appearance. 

- **Buttons & Inputs:** 4px border radius.
- **Cards & Containers:** 8px border radius (rounded-lg) for clear containment.
- **Status Badges:** Fully rounded (pill-shaped) to distinguish them from interactive buttons.

## Components
- **Buttons:** Primary buttons are Solid Dark Blue (#1E3A8A) with white text. Secondary buttons use a light grey ghost style with a subtle border.
- **Inputs:** High-contrast fields with a white background and 1px grey border. On focus, the border shifts to Primary Blue with a subtle 2px outer glow.
- **Data Tables:** The core of the platform. Use a zebra-striping pattern (White and #F9FAFB) for long rows. Headers must be "Sticky" and use the uppercase `label-md` typography.
- **Status Chips:** Use specific semantic colors: 
    - *Open:* Green tint.
    - *Closed:* Grey tint.
    - *Urgent/Deadline:* Amber (#F59E0B) with dark text.
- **Cards:** Used for high-level dashboard metrics (e.g., "Total Active Tenders"). They feature a white background, 1px border, and a 4px accent line on the left using the Primary or Amber color to denote category or urgency.
- **Progress Steppers:** Essential for the multi-stage procurement process. Horizontal on desktop, vertical on mobile, using the Primary Blue to indicate completion.