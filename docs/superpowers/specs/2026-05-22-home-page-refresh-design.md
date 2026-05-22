# Home Page Full Creative Rebuild — Design Spec

## Overview

Full rewrite of the ADLA home page (`app/pages/index.vue`) with:
- All 6 theme bugs fixed (button contrast, footer blending, card definition, stepper colors)
- New visual identity: balanced professional tone with kente-inspired texture
- Restructured into 7 sections (down from 5, with interactive components replacing static content)
- Scroll-triggered animations, parallax effects, and interactive tabbed/accordion UI

## Design Decisions

**Visual tone**: Balanced professional — modern layout and typography with official government elements (Ghana national colors, institutional badges, coat of arms references). Trust through design quality, not formality.

**Color strategy**: Primary CTA uses Ghana Yellow (#FCD116) on green backgrounds for high contrast. "Learn More" uses semi-opaque white borders instead of outline variants that fail in non-light themes. All sections use semantic color tokens (`--color-primary`, `--color-muted`, etc.) for automatic theme adaptation.

**Kente pattern**: Pure CSS/SVG — no image assets. Repeating geometric pattern using Ghana's national colors at very low opacity (4-6%). Used in hero and as a subtle echo in dark-background sections. Renders crisply at any resolution.

**Animation approach**: Scroll-triggered via IntersectionObserver. Entrance animations (fade-in-up) for timeline steps and section headings. Parallax scroll on hero kente pattern for depth. Respect `prefers-reduced-motion` — disable all animations when set.

## Page Structure (7 Sections)

### Section 1: Sticky Navigation Bar

**Unchanged** from current implementation. Logo ("GH" badge + "Asset Declaration Portal" + "Audit Service" + "Republic of Ghana"), theme switcher button, "Sign in" link, "Create account" button.

Keep existing component. Only change: ensure nav links use semantic tokens so they adapt across all themes.

### Section 2: Hero (Split Layout with Kente Texture)

**Layout**: Two-column — text content left (~60%), decorative area right (~40%). On mobile (<768px), right panel hides and left content centers.

**Left column**:
- Institution badge pill: "REPUBLIC OF GHANA" in a rounded pill with Ghana Yellow border and text on translucent background
- Heading: "Asset Declaration System" — large, bold, white
- Subtext: "Online portal for public officials to submit their asset declarations as required under Article 286(5) of the 1992 Constitution of Ghana." — smaller, semi-opaque white
- Two CTAs side by side:
  - "Start Declaration" — Ghana Yellow (#FCD116) background, dark text. Links to `/auth/register`
  - "Learn More ↓" — semi-opaque white border (1.5px, 50% opacity), white text. Smooth-scrolls to #how-it-works

**Right column**:
- Large decorative emblem: concentric circles with Ghana Black Star at center, using Ghana Yellow at low opacity (20-25%)
- Small floating dots in national colors for subtle motion
- Parallax effect: emblem moves slightly on scroll

**Background**:
- Green gradient: `linear-gradient(160deg, hsl(var(--color-primary)), hsl(var(--color-primary) / 0.85), hsl(var(--color-primary) / 0.7))` — computed from the theme's primary color, not separate tokens
- Kente-inspired SVG pattern overlay at 6% opacity
- Parallax scroll on the pattern layer (CSS `transform: translateY()` driven by scroll position)

**Scroll indicator**: Mouse icon at bottom center, 40% opacity, subtle bounce animation

### Section 3: Trust Banner

**Layout**: Horizontal strip, centered flex with wrapping. 4 trust indicators.

**Background**: Subtle primary-tinted background (`bg-primary/5` or equivalent).

**Items** (each is icon + title + subtitle):
1. Shield icon → "Secure & Confidential" / "End-to-end encrypted"
2. Scale icon → "Constitutional Mandate" / "Article 286(5), 1992"
3. Landmark icon → "Ghana Audit Service" / "Official government portal"
4. ClipboardList icon → "Tracked & Auditable" / "Full declaration trail"

**Icons**: Lucide (`Shield`, `Scale`, `Landmark`, `ClipboardList`) in circular containers with `bg-primary/10` background, `text-primary` color.

**Responsive**: 4-across on desktop, 2×2 grid on tablet, single column on mobile.

### Section 4: How It Works — Visual Timeline

**Layout**: Horizontal 4-step timeline on desktop, vertical on mobile (<768px).

**Heading**: "How It Works" centered with subtitle "Complete your asset declaration in four simple steps".

**Step cards** (each):
- Rounded-square icon container (56px, border-radius 16px) with primary gradient background and box shadow
- Lucide icons: `UserPlus` (Register), `FileText` (Submit), `Search` (Review), `CheckCircle` (Receive)
- Step title (semibold) and description text below

**Connectors**: Horizontal gradient lines between steps (primary color) with small dot endpoints. On mobile, vertical lines connecting steps top-to-bottom.

**Animation**: Each step card fades in and slides up when scrolled into view (staggered 150ms delay per step). Uses IntersectionObserver with `threshold: 0.2`.

### Section 5: Who Must Declare — Interactive Explorer

**Layout**: Centered section with tabbed interface.

**Heading**: "Who Must Declare?" centered with subtitle referencing Article 286(5).

**Tabs** (shadcn-vue `Tabs` component): 6 tabs — Executive, Legislative, Judicial, Public Enterprises, Security, Others. Each tab has a Lucide icon prefix.

**Tab content**: 2-column grid of role cards. Each card is a flex row with:
- Icon container (36px rounded square, `bg-primary/10`)
- Role title (semibold, 13px)
- Light green-tinted background with subtle border

**Tab bar**: Scrolls horizontally on mobile (`overflow-x: auto`). Active tab has primary-colored bottom border.

**Data**: Same role lists as current page, reorganized into tab panels.

### Section 6: FAQ Accordion

**Layout**: Centered, narrow max-width (640px) for readability.

**Background**: Muted (`bg-muted/50`) to differentiate from section above.

**Heading**: "Frequently Asked Questions" centered with subtitle.

**Component**: shadcn-vue `Accordion` with `type="single"` (opening one closes others).

**Questions** (5 items):
1. "What documents do I need to register?" → Ghana Card images, email, phone number
2. "How long does the declaration process take?" → Varies by review workload; the portal tracks status at each stage so you always know where your declaration stands
3. "What happens after I submit my declaration?" → Review by Legal Unit and officers, receipt on approval
4. "What if I lose my declaration form?" → Reissue process through Legal Unit with Auditor General approval
5. "Is my declaration information confidential?" → Yes, per constitutional requirements, end-to-end encrypted

**Styling**: White card backgrounds with border, rounded corners. Chevron icon rotates on open/close.

### Section 7: Redesigned Footer

**Background**: Near-black (`bg-foreground` or `#0a0a0a` equivalent). Clear visual separation from content.

**Ghana tricolor accent**: 3px horizontal bar at top using `linear-gradient(to right, #006B3F, #FCD116, #CE1126)`.

**Layout**: 4-column grid:
1. **Organization** (1.5fr): Logo badge + "Asset Declaration Portal" + "Ghana Audit Service" + tagline
2. **Quick Links** (1fr): Start Declaration, How It Works, Who Must Declare, FAQ
3. **Legal** (1fr): Privacy Policy, Terms of Service, Data Protection, Accessibility
4. **Contact** (1fr): Email, phone, location, link to contact form

**Bottom bar**: Thin top border, copyright left, "Republic of Ghana" right.

**Responsive**: 4-column → 2×2 grid on tablet → single column on mobile.

## Theme Adaptation Strategy

All colors use semantic CSS custom property tokens. Theme-specific behavior:

| Element | Light | Dark | High Contrast | Sepia | Solarized |
|---------|-------|------|---------------|-------|-----------|
| Hero gradient | Green shades | Lighter green shades | Deep green | Brown shades | Blue shades |
| Hero CTA | Yellow bg | Yellow bg | Yellow bg, black border | Gold bg | Yellow bg |
| Trust banner bg | primary/5 | primary/10 | primary/5 + border | primary/5 | primary/5 |
| Timeline icons | Primary gradient | Primary gradient | Solid primary | Primary gradient | Primary gradient |
| Tab active border | Primary | Primary | Primary + thick | Primary | Primary |
| FAQ card bg | White | Card token | White + border | Card token | Card token |
| Footer bg | Near-black | Darker bg | Pure black | Dark brown | Dark blue-grey |
| Tricolor bar | Always Ghana colors (hardcoded, not themed) | Same | Same | Same | Same |

The Ghana tricolor bar in the footer is the one element that stays hardcoded across all themes — it's a national identity element, not a UI element.

## Cross-Cutting Concerns

### Accessibility
- All animations respect `prefers-reduced-motion: reduce` — instantly show final state without transitions
- Tab interface is keyboard-navigable (arrow keys between tabs, Enter/Space to activate)
- Accordion items are keyboard-accessible
- Sufficient color contrast ratios in all 6 themes (WCAG AA minimum)
- Scroll indicator has `aria-hidden="true"` (decorative)
- "Learn More ↓" smooth-scroll uses `scroll-behavior: smooth` with a fallback

### Performance
- Kente SVG pattern is inline (no network request), defined once in a `<defs>` block and referenced via `<use>`
- IntersectionObserver for scroll animations (no scroll event listeners)
- Parallax uses CSS transforms (GPU-composited, no layout thrashing)
- FAQ accordion and Tabs use shadcn-vue built-in lazy rendering

### Component Architecture

New/modified files:
- `app/pages/index.vue` — complete rewrite, orchestrates all sections
- `app/components/home/HomeHero.vue` — hero section with kente pattern + parallax
- `app/components/home/HomeTrustBanner.vue` — trust indicators strip
- `app/components/home/HomeTimeline.vue` — 4-step visual timeline with scroll animation
- `app/components/home/HomeDeclarers.vue` — tabbed "Who Must Declare" explorer
- `app/components/home/HomeFaq.vue` — FAQ accordion
- `app/components/home/HomeFooter.vue` — redesigned footer
- `app/components/home/KentePattern.vue` — reusable SVG pattern component

shadcn-vue components to add (if not already present):
- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`
- `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent`

### Mobile Breakpoints
- `< 640px` (sm): Single column everything. Hero right panel hidden. Steps vertical. Tabs scroll. Footer single column.
- `640px - 768px` (md): 2-column grids. Trust banner 2×2. Footer 2×2.
- `> 768px` (lg): Full desktop layout. 4-column grids where applicable.
