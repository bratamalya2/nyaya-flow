---
name: Executive Juris
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#44474e'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#74777e'
  outline-variant: '#c4c6ce'
  surface-tint: '#4b5f80'
  primary: '#000b1f'
  on-primary: '#ffffff'
  primary-container: '#0b2240'
  on-primary-container: '#768aad'
  inverse-primary: '#b3c7ee'
  secondary: '#006876'
  on-secondary: '#ffffff'
  secondary-container: '#a0efff'
  on-secondary-container: '#0d6e7d'
  tertiary: '#170700'
  on-tertiary: '#ffffff'
  tertiary-container: '#381a00'
  on-tertiary-container: '#cf7100'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d5e3ff'
  primary-fixed-dim: '#b3c7ee'
  on-primary-fixed: '#031b39'
  on-primary-fixed-variant: '#334767'
  secondary-fixed: '#a0efff'
  secondary-fixed-dim: '#84d2e2'
  on-secondary-fixed: '#001f25'
  on-secondary-fixed-variant: '#004e59'
  tertiary-fixed: '#ffdcc3'
  tertiary-fixed-dim: '#ffb77d'
  on-tertiary-fixed: '#2f1500'
  on-tertiary-fixed-variant: '#6e3900'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
  surface-canvas: '#F8FAFC'
  surface-card: '#FFFFFF'
  surface-subtle: '#F1F5F9'
  border-subtle: '#E2E8F0'
  border-strong: '#CBD5E1'
  text-primary: '#0F172A'
  text-secondary: '#475569'
  text-muted: '#94A3B8'
  status-verified-text: '#065F46'
  status-verified-bg: '#ECFDF5'
  status-verified-border: '#A7F3D0'
  status-stale-text: '#92400E'
  status-stale-bg: '#FFFBEB'
  status-stale-border: '#FDE68A'
  status-conflict-text: '#991B1B'
  status-conflict-bg: '#FEF2F2'
  status-conflict-border: '#FECACA'
  status-manual-text: '#334155'
  status-manual-bg: '#F8FAFC'
  status-manual-border: '#E2E8F0'
  brand-accent-amber: '#D8892A'
  midnight-dark-base: '#020617'
  midnight-dark-surface: '#0B1528'
  midnight-dark-border: '#1E293B'
typography:
  display-lg:
    fontFamily: Domine
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  display-md:
    fontFamily: Domine
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 34px
    letterSpacing: -0.015em
  headline-statutory:
    fontFamily: Domine
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  headline-ui:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  title-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 20px
  title-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
  body-legal:
    fontFamily: Domine
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 26px
  body-default:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
  body-dense:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-strong:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-code:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.04em
  caption:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 14px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1.25rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 2rem
---

## Brand & Style

This design system establishes an authoritative, high-precision visual language tailored for advocates, designated senior counsel, judicial clerks, and enterprise legal teams operating across Indian courts and tribunals. It bridges classical constitutional gravitas with real-time operational speed.

### Design Principles
- **Evidentiary Precision:** Legal practitioners cannot tolerate ambiguity. The UI prioritizes explicit source attribution, data freshness indicators, and granular metadata over decorative embellishment.
- **Architectural Calm:** Litigators operate in high-stress, time-critical environments. The visual language uses disciplined structural lines, deep executive tones, and restrained warmth to instill absolute trust and command.
- **High-Density Ergonomics:** Cause lists, CNR filings, statutory mappings (such as IPC to BNS/BNSS/BSA), and multi-party hearing timelines require dense, scan-optimized information layouts with minimal unnecessary scrolling.
- **Sovereign Trust & Compliance:** Visual treatments reflect enterprise-grade governance, strict privilege boundaries, and Indian Bar Council ethical dignity.

## Colors

The palette directly draws from the brand mark: deep sovereign midnight navy (`#0B2240`) forms the foundation of power and primary action, paired with an analytical deep teal (`#006A78`) denoting intelligence, research, and flow. A vibrant saffron amber (`#D97706` / `#D8892A`) provides intentional focal emphasis for critical alerts, hearing items, and active callouts without appearing loud or commercial.

### Semantic Status Colors
Legal operations require clear, non-negotiable status communication across court feeds, cause lists, and verification states:
- **Verified (Court Confirmed):** Emergent emerald (`#065F46` on `#ECFDF5`) with `#A7F3D0` outline. Used when automated scraper/API sync confirms an active listing or official order.
- **Stale (Needs Re-sync):** Amber ochre (`#92400E` on `#FFFBEB`) with `#FDE68A` outline. Used for cause lists un-synced for >12 hours or orders awaiting certified copy upload.
- **Conflict (Hearing Clash / Overruled Precedent):** Deep crimson (`#991B1B` on `#FEF2F2`) with `#FECACA` outline. Applied to simultaneous court listings across different benches and bad precedent alerts.
- **Manual (User-Supplied / Unverified):** Slate neutral (`#334155` on `#F8FAFC`) with `#E2E8F0` outline. Used for custom notes, unsanctioned proxy assignments, and unverified client docs.

### Dark & Reader Modes
- **Executive Light (Default):** Canvas `#F8FAFC`, pristine white card surfaces `#FFFFFF`, and low-fatigue slate typography.
- **Midnight Dark:** Rich `#020617` base with `#0B1528` elevated panels and glowing teal accents for night-time brief preparation.
- **Reader Mode:** Warm ivory-tinted neutral surface (`#FAF8F5`) pairing ink black (`#1A1A1A`) with serif body typography for continuous judgment digestion.

## Typography

The typographical pairing unites **Domine** (for statutory headers, act titles, judgment citations, and long-form judicial text) with **Inter** (for operational dashboard workflows, data tables, metrics, and navigation).

### Typographic Roles
- **Domine:** Evokes authoritative judicial gazettes and law reports (SCC, AIR). It is reserved for case names (*e.g., K.S. Puttaswamy v. Union of India*), statutory section titles, legal brief reading canvases, and executive display counters.
- **Inter:** Provides utilitarian precision across tabular records, CNR tags, cause list item numbers, workflow breadcrumbs, and dense sidebar navigation.
- **Tabular Numerals:** All numeric displays (matter identifiers, item numbers, rupee values, timestamps, and statutory years) enforce `font-feature-settings: 'tnum' 1` to guarantee vertical column alignment across court registries.

## Layout & Spacing

NyayaFlow employs a dense, structured desktop-first layout designed for legal practitioners operating with multiple side-by-side documents, active court dockets, and timeline panels.

### Structural Framework
- **Master Shell:** 
  - **Left Rail (64px collapsed, 240px expanded):** Multi-tenant firm switcher, matter vault, cause lists, research graph, filings, and billing.
  - **Context Bar (48px height):** Global matter selector, CNR search input, sync status badge, and advocate quick-status.
  - **Primary Workspace Canvas:** Responsive multi-pane layout featuring an expandable three-column configuration (Matter Index / Working Docket / Evidence Inspector).
- **Grid Hierarchy:**
  - **Desktop (>=1280px):** 12-column layout with 16px (`1rem`) gutters and 20px outer margin. Supports side-by-side dual-code view (CrPC vs BNSS).
  - **Tablet (768px - 1279px):** 8-column layout with collapsable context drawer for courtrooms and hearings on iPad/tablets.
  - **Mobile (<768px):** Single-column stacked stream with fixed bottom navigation for "Today’s Cause List" and "Urgent Conflicts".

## Elevation & Depth

To avoid visual noise and ensure legibility across high-density tables and document split-screens, this design system rejects heavy, blurry drop shadows in favor of **structural containment with crisp 1px borders** and low-opacity ambient anchoring.

### Elevation Levels
- **Layer 0 (Canvas):** Pure `#F8FAFC`. Base backdrop across which dockets and panels sit.
- **Layer 1 (Card & Docket Surface):** Pure `#FFFFFF` enclosed in a single 1px solid `#E2E8F0` border. No shadow or a microscopic `0 1px 2px 0 rgba(11, 34, 64, 0.04)`.
- **Layer 2 (Dropdowns, Tenant Switchers, Context Menus):** `#FFFFFF` with 1px solid `#CBD5E1` and ambient shadow `0 4px 12px -2px rgba(11, 34, 64, 0.08), 0 2px 4px -1px rgba(11, 34, 64, 0.04)`.
- **Layer 3 (Modals, Conflict Alerts, Document Lightbox):** Elevated sheet with `0 20px 25px -5px rgba(11, 34, 64, 0.12), 0 8px 10px -6px rgba(11, 34, 64, 0.06)`, framed by a `#0B2240` tinted border.
- **Sticky Elements (Court Room Display Boards, Cause List Item Numbers):** Glassmorphic backdrops (`rgba(255, 255, 255, 0.92)` with `backdrop-filter: blur(8px)`) bounded by a subtle bottom divider `#E2E8F0`.

## Shapes

The system uses a **Soft (level 1)** shape geometry (`roundedness: 1`). Litigators require an interface that communicates structure, precision, and formality. Circular or overly bubbly shapes detract from legal seriousness.

### Shape Geometry Application
- **Buttons, Form Inputs, Docket Cards, Tabs:** `4px` (`0.25rem` / `rounded-sm` to `rounded-md`) for crisp borders and compact density.
- **Status Tags, Verification Pills, Item Numbers:** `4px` with tight internal padding (`2px 6px`) to ensure tabular fit.
- **Document Previews & Modals:** `8px` (`0.5rem` / `rounded-lg`) to soften larger container surfaces without losing institutional weight.
- **Tenant Switcher Avatar / Court Seals:** Subtle rounded squares (`6px`) with 1px inset ring.

## Components

### Buttons & Interactive Controls
- **Primary Action (Navy):** Solid background `#0B2240`, white text, 1px solid `#0B2240`. Hover transitions to `#163259`. Focus ring: 2px offset `#006A78`.
- **Secondary / Analytical Action (Teal):** Background `#006A78`, white text. Used for "Run Legal Research", "Extract Citations", and "Auto-Index Document". Hover: `#005460`.
- **Accent Action (Amber):** Solid `#D97706` with white text. Reserved for time-sensitive court tasks, "Confirm Filing", or "Resolve Conflict".
- **Outline Action:** `#FFFFFF` background with 1px solid `#E2E8F0` and `#0F172A` text. Hover: `#F1F5F9`.

### Status Badges & Pills
Badges are compact (height: 20px, font: 11px uppercase `font-bold`), structured with matching border and light surface:
- **Verified:** `#ECFDF5` background, `#065F46` text, `#A7F3D0` 1px border. Icon: shield check.
- **Stale:** `#FFFBEB` background, `#92400E` text, `#FDE68A` 1px border. Icon: clock refresh.
- **Conflict:** `#FEF2F2` background, `#991B1B` text, `#FECACA` 1px border. Icon: alert octagon.
- **Manual:** `#F8FAFC` background, `#334155` text, `#E2E8F0` 1px border. Icon: edit pen.

### Cause List Hearing Cards
- **Structure:** Clean 3-column card:
  1. *Left:* Item number block (navy badge, bold 14px mono) and Court Hall ID.
  2. *Center:* Case title in Domine 14px bold, CNR reference chip, bench name, and advocate role (Petitioner/Respondent).
  3. *Right:* Real-time live status indicator (e.g., "Item 14 running / Hearing est. 11:30 AM") with sync freshness timestamp ("Synced 4m ago").

### Statutory Transition Matrix (IPC to BNS/BNSS/BSA)
- **Split Comparative View:** Dual-pane comparative container with synchronized scrolling.
  - Left pane: Legacy Code (e.g., Section 420 IPC) with strike-through tags.
  - Right pane: Modern Sanhita (e.g., Section 318 BNS) with highlighted statutory revisions and key change notes.
  - Middle: One-click "Replace in Petition" button styled in deep teal.

### Multi-Tenant Law Firm Switcher
- Compact breadcrumb component in the top navigation featuring law firm brand avatar, chamber selector (e.g., "Supreme Court Chamber 402" vs "Bangalore Office"), user role indicator ("Senior Partner"), and DPDP secure session badge.

### Data Tables & Docket Grids
- **Header:** Background `#F8FAFC`, uppercase 11px slate typography with subtle `#E2E8F0` bottom border.
- **Row:** Height 38px (compact mode) or 48px (standard mode). Zebra striping avoided; 1px horizontal dividers used instead. Hover highlights with `#F1F5F9`.
- **Text Alignment:** Case titles left-aligned, status badges centered, financial values and dates right-aligned with tabular numerals.