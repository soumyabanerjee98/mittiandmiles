# Design Philosophy — Figma & Cursor

**Product:** Indian Local Experiences Marketplace  
**Document purpose:** Shared visual, UX, and implementation direction for Figma design work and Cursor-assisted development.  
**Status:** Working design system; validate unresolved product decisions before production.

---

## 1. Product vision

Build a trustworthy marketplace connecting Indian and international travellers with local hosts and professional guides for authentic experiences beyond the standard tourist itinerary.

**Positioning:** *Meet the people who know a city beyond its tourist map.*

The product should feel like a modern, minimal, photography-led travel booking app: calm, intuitive, contemporary and easy to scan. It should communicate human connection, local knowledge, confidence, and care. It must work across multiple Indian cities, for both domestic and international travellers.

### Experience principles

1. **Human before transactional.** Lead with the host, the story, and what makes an experience distinct. Price and booking details remain easy to find.
2. **Curated, not cluttered.** Use confident typography, generous spacing, restrained colour, and strong photography. Avoid dense grids and excessive badges.
3. **Trust is part of the interface.** Explain what verification means; show clear inclusions, exclusions, cancellation terms, meeting guidance, and support access.
4. **Local, not stereotyped.** Represent places and people accurately. Avoid generic “exotic India” motifs, token cultural decoration, and misleading imagery.
5. **Clear actions, calm feedback.** Every screen should have one obvious primary action. Make loading, unavailable inventory, errors, and confirmations explicit.
6. **One app, role-aware.** Traveller, host and admin experiences all live inside the Flutter mobile app. Admin workflows prioritise mobile scanability, safe actions, auditability and efficient case handling—not desktop dashboard density.
7. **Accessible by default.** Maintain readable contrast, scalable text, touch-friendly targets, screen-reader labels, and plain language.

Do not copy another marketplace's proprietary UI, assets, text, or exact interface. Use original components and brand expression.

---

## 2. Brand direction — modern minimal travel app

Follow the visual language of the user-provided Dribbble reference (https://dribbble.com/shots/26984485-Travel-Booking-App): modern, minimal, image-led travel UI, restrained colour, crisp hierarchy, clean cards and confident spacing. Treat it as inspiration, not something to copy pixel-for-pixel. Do not use scrapbook/journal styling, paper textures, vintage travel ephemera, linen/terracotta palettes or rustic decorative motifs.

### Colour palette

Use a contemporary neutral base with restrained green and blue accents. Create semantic tokens and check contrast in light and dark image contexts.

| Token | Value | Use |
|---|---|---|
| Ink / deep charcoal | `#090F0A` | Primary text, high-contrast surfaces |
| Neutral grey | `#DFDFDF` | Neutral surfaces, dividers where contrast permits |
| Leaf green | `#74A028` | Primary accent, selected states and key actions after contrast validation |
| Teal-grey | `#374849` | Secondary dark surface and supporting UI |
| Blue-grey | `#B6C4D1` | Muted surface and secondary information |
| Soft blue | `#99B1CD` | Supporting accent and selected neutral-blue surfaces |
| Blue | `#5197DC` | Links and informational accent after contrast validation |
| Deep blue | `#3664A1` | Secondary action / strong blue accent after contrast validation |
| White | `#FFFFFF` | Main light surface where appropriate |
| Error | `#B33B35` | Errors and destructive actions; pair with text/icon |
| Warning | `#A76521` | Pending/caution states; pair with text/icon |
| Success | `#287548` | Confirmed/success states; pair with text/icon |

Implementation notes:
- Define semantic tokens such as `color.text.primary`, `color.surface.canvas`, `color.action.primary`, and `color.status.error`; avoid scattering raw hex values through code.
- The palette values are brand-direction tokens, not a guarantee that every foreground/background pairing passes WCAG. Validate every actual pairing and adjust semantic variants when needed.
- Status must never be communicated by colour alone; pair it with a label and, where useful, an icon.

### Typography

**Preferred direction:** a clean modern sans-serif for the entire product UI. Use the platform-compatible sans-serif already supported by Flutter or a carefully chosen neutral sans-serif; do not use a decorative/editorial serif as the core brand typeface.

Suggested type scale:

| Style | Size / line height | Use |
|---|---|---|
| Display | 36 / 42 | Landing or city editorial headline |
| H1 | 30 / 36 | Screen headline |
| H2 | 24 / 30 | Section heading |
| H3 | 20 / 26 | Card/detail heading |
| Body Large | 17 / 25 | Intro copy, important explanatory text |
| Body | 15 / 22 | Standard interface copy |
| Body Small | 13 / 18 | Supporting information |
| Label | 12 / 16, medium | Form labels, metadata |
| Button | 15 / 20, semibold | Actions |

Avoid all-caps for long labels. Use sentence case and concise, human copy. Do not use the display serif for dense data tables or form controls.

### Spacing, shape, and elevation

Use a 4-point base spacing system: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64`.

- Small controls: 8–12 px radius.
- Cards and image containers: 16 px radius.
- Sheets and larger panels: 20–24 px radius where platform conventions allow.
- Buttons: 12 px radius or a consistent capsule shape; choose one primary convention and use it consistently.
- Prefer subtle borders and minimal shadows. Elevation should clarify layering, not decorate every card.
- Minimum touch target: approximately 44 × 44 points on mobile; use larger targets for primary actions when possible.

### Photography and illustration

- Prioritise documentary-style, locally grounded photography: people hosting, food being prepared, streets, craft, landscapes, and moments of interaction.
- Prefer natural light, honest context, and images that show what a traveller can genuinely expect.
- Keep card image ratios consistent within each list. Use portrait imagery for experience cards where it supports the editorial feel; use wide images for city headers and galleries.
- Avoid overlaid text on busy photos unless contrast is guaranteed.
- Provide meaningful alt text. Decorative images should not create redundant screen-reader announcements.
- Do not use generated imagery to imply a real host, venue, or experience that has not been verified.

### Iconography

Use one consistent line-icon family, such as Lucide, with consistent stroke weight and sizing. Icons support labels rather than replace essential text. Avoid mixing emoji, filled icons, and multiple icon styles in navigation.

---

## 3. Information architecture

### Traveller mobile app

Primary navigation should remain simple. Recommended starting structure:

- **Explore** — city discovery, search, curated categories, featured experiences.
- **Saved** — saved experiences and hosts.
- **Bookings** — upcoming, past, cancelled, and disputed bookings.
- **Inbox** — conversations and structured offers.
- **Profile** — account, preferences, support, legal and privacy settings.

If usability testing shows five destinations are too crowded, combine Saved into Explore/Profile rather than shrinking labels or touch targets.

### Host mobile app

Host mode can be a role-aware area of the same app or a separate app if product architecture later requires it. Do not assume a separate app before the decision is made.

Core host areas:
- **Overview** — today’s schedule, new requests, actions requiring attention.
- **Experiences** — create, edit, preview, pause, and archive listings.
- **Bookings** — confirmed and historical bookings, attendee details, check-in/completion.
- **Inbox** — traveller conversations and structured offers.
- **Earnings** — gross bookings, commission, adjustments, payout and reconciliation status.
- **Profile** — public profile, verification progress, languages, support.

### Admin area inside the same mobile app

Admin screens are part of the same Flutter app. Do not design or build a separate website, desktop dashboard or Next.js admin application for the MVP. The app may expose a protected Admin entry point for authorised staff after authentication; it must not offer public admin sign-up or self-service role elevation. Backend permissions remain authoritative.

Core admin areas (show only those allowed for the current staff account):
- **Overview** — counts and urgent queues, not decorative analytics.
- **Host verification** — review submissions, credentials and missing information.
- **Experience moderation** — preview, approve, request edits, reject, pause or archive.
- **Bookings and disputes** — case timeline, booking state and relevant actions.
- **Reports and support** — triage, assign, resolve and escalate.
- **Finance** — restricted payment/refund/payout/reconciliation tools.
- **Cities and categories** — manage approved catalogue configuration.
- **Audit and staff access** — restricted to authorised roles.

Use mobile-friendly queue cards/list rows, search/filter chips, paginated results and dedicated detail screens rather than wide desktop tables. Keep high-risk actions explicit and auditable.

---

## Admin security boundary

Admin capability is assigned through controlled staff provisioning and returned by the backend as part of the authenticated account/session model. The Flutter app may use that information to decide which navigation entry to display, but every admin endpoint and sensitive object read must enforce action-level permission server-side. Use least privilege for operations, support, finance and super-admin functions. Never rely on client-side role flags, hidden buttons or route guards for security. Audit sensitive actions with actor, target, action, reason, timestamp and outcome.

---

## 4. Traveller screens — design requirements

### A. Welcome and account access

- Brand-led but brief introduction; do not force a long onboarding carousel.
- Sign up, sign in, password recovery, and supported authentication methods.
- Ask for permissions (location, notifications) only when context makes the benefit clear.
- Support international phone formats and country selection where phone authentication is used.
- Show validation inline and preserve entered values when safe to do so.

### B. Explore / city discovery

- City selector and search should be easy to reach.
- Use a strong editorial city feature with a concise description and relevant imagery.
- Categories may include food, neighbourhood walks, culture, crafts, photography, outdoors, and other approved types.
- Experience cards should prioritise image, title, location/city, duration, starting price, language availability, and a meaningful host/trust cue.
- Do not show fabricated ratings, scarcity, “best seller” labels, or availability.
- If no city is active, explain that the marketplace is expanding and offer a notification/waitlist option only if supported.

### C. Search and filters

- Search by city and relevant terms.
- Filters: dates, category, language, price, duration, group size, and host verification where appropriate.
- Show active filters as removable chips and provide a clear reset action.
- Keep sort choices understandable; do not imply ranking methodology that does not exist.
- Provide loading skeletons, useful empty states, retry states, and pagination/infinite-scroll behaviour that preserves scroll position.

### D. Experience detail

Recommended content order:
1. Image gallery / hero image.
2. Experience title, city/area, duration, price, and availability cue.
3. Host preview with profile link and accurate verification label.
4. A short “What makes this special” story.
5. Itinerary or what guests will do.
6. Inclusions and exclusions.
7. Languages, group size, accessibility notes, and suitability.
8. Safety notes and meeting area/details appropriate to the booking stage.
9. Cancellation policy.
10. Reviews from eligible bookings only.
11. Sticky bottom booking action with price context.

Never expose private meeting addresses publicly if doing so creates safety or privacy risk. Show exact meeting details only at the appropriate stage under product policy.

### E. Booking and checkout

- Make date, time, party size, price breakdown, cancellation terms, and included items clear before payment.
- Show fees and currency before the user commits.
- Explain when a slot is temporarily held and when that hold expires.
- Payment state must come from verified server-side provider confirmation. A client redirect alone must not display “Paid” or “Confirmed”.
- Provide distinct pending, successful, failed, cancelled, and unknown/reconciling states.
- Never ask users to submit card details into a custom form unless the approved provider explicitly supports that secure flow.

### F. Custom request and structured offer

- Request fields: city, preferred date/time window, party size, budget, interests, language, and relevant accessibility needs.
- Hosts reply with a structured offer containing price/currency, proposed time, duration, inclusions, exclusions, expiry, and cancellation terms.
- Present offer comparisons clearly and make the acceptance action explicit.
- Explain that accepting an offer is not the same as payment confirmation.
- Expired or withdrawn offers must be visibly unavailable and cannot proceed to checkout.

### G. Inbox and support

- Show conversation context, experience/request reference, and booking status.
- Keep structured offer cards visually distinct from ordinary messages.
- Make reporting, blocking where supported, and support escalation accessible without dominating the interface.
- Moderation controls should be proportionate and transparent. Avoid invasive monitoring or opaque punitive messaging.

### H. Bookings and fulfilment

- Group bookings by Upcoming, Past, and Cancelled where useful.
- Booking detail should show status, date/time with timezone clarity, host, meeting guidance, attendee count, payment receipt, cancellation terms, and support options.
- Check-in and completion states should be explicit. A completion action must not silently bypass dispute or payout checks.
- Provide clear no-show, cancellation, refund, and dispute journeys.
- Review entry points appear only when the booking qualifies under policy.

### I. Profile and preferences

- Profile details, languages, saved items, notification preferences, accessibility preferences, help, privacy, legal, and account closure.
- Explain what profile information is public versus private.
- Account closure should include confirmation and explain any records retained for legal or financial reasons.

---

## 5. Host screens — design requirements

### A. Host onboarding and verification

- Use a progress checklist: profile, identity, relevant credentials (if required), payout setup, and first experience.
- Explain why each sensitive item is needed and who can access it.
- Statuses: Draft, Pending review, Needs more information, Approved, Rejected, Restricted.
- Provide a reason and next step for rejected or incomplete submissions, plus an appeal/contact route where policy allows.
- Store identity documents in private storage and do not render them in public profiles or unrestricted admin views.
- Do not imply every host is a licensed guide. Credential requirements depend on the category and applicable rules.

### B. Host profile

- Public-facing name, biography, city/area, languages, interests/specialities, experience listings, and approved trust information.
- Keep personal contact details private unless a defined stage and policy permits disclosure.
- Avoid unverified superlatives and unverifiable claims.

### C. Create/edit experience

Use a step-by-step form with a visible progress indicator and autosave where feasible:
1. Basics: title, category, city/area, description.
2. Itinerary and duration.
3. Photos and captions.
4. Languages, capacity, accessibility and suitability.
5. Inclusions, exclusions and safety notes.
6. Pricing and currency.
7. Availability, capacity and blackout dates.
8. Meeting area and meeting instructions.
9. Cancellation policy.
10. Preview and submit for review.

Clearly distinguish Draft, Pending review, Published, Rejected, Paused, and Archived. Validation should explain exactly what is missing. Avoid losing long descriptions or uploaded media after a recoverable error.

### D. Requests, offers, and bookings

- Overview cards: new requests, upcoming bookings, outstanding actions, and payout status.
- Requests should show relevant dates, party size, budget, interests, and response deadline.
- Offer creation must include every required commercial term before sending.
- Booking detail should include attendee count, meeting details, contact/reporting policy, and check-in/completion actions.
- Confirm before irreversible actions such as cancelling a confirmed booking.

### E. Earnings and payout status

- Show gross booking value, platform commission, adjustments/refunds, and expected/net amount as separate line items.
- Clearly distinguish Pending, Processing, Paid, Failed, and Reconciliation required.
- Explain that payout timing and settlement depend on the approved payment-provider arrangement and applicable rules.
- Do not imply the platform can hold or defer funds unless that approach has been confirmed with the provider and legal/compliance review.
- Financial records should be exportable only through authorised paths and must not expose unrelated personal data.

---

## 6. Mobile admin area — design requirements

### Layout

- Use standard mobile navigation patterns and a compact admin home; do not add a persistent desktop sidebar.
- Keep high-priority queues visible without turning the overview into a wall of charts.
- Use mobile-friendly list rows/cards with search, filter controls and pagination suitable for a phone.
- Preserve filters and list position when returning from a detail view where practical.
- Make timestamps, timezone context and currency formats explicit and consistent.
- Design for touch targets, accessibility, loading/empty/error/retry/offline states and narrow screens.

### Host verification queue

- Queue columns: host, submitted date, category, verification status, outstanding requirements, assigned reviewer.
- Detail view separates profile data from sensitive documents and shows only what the reviewer needs.
- Approve/reject/request-more-information actions require a reason or confirmation where appropriate.
- Record reviewer, timestamp, decision, and reason in the audit log.

### Experience moderation

- Preview the public listing as the traveller would see it.
- Show policy flags and missing fields separately from the host’s original content.
- Allow approve, reject with reason, request edits, pause, and archive based on permissions.
- Avoid destructive edits without an audit trail.

### Booking, disputes, and support

- Provide a timeline of booking state changes, payment-provider events, communications relevant to the case, cancellations, refunds, and dispute status.
- Mask sensitive personal details by default and reveal only when needed for the case and authorised.
- Use consistent severity and status labels.
- Actions should be idempotent where applicable and display pending provider responses rather than assuming success.

### Finance and reconciliation

- Restricted finance area with ledger entries, payment attempts, provider references, refunds, payout allocations, and reconciliation exceptions.
- Separate “request refund” from “refund confirmed” and “payout initiated” from “payout settled”.
- Require appropriate confirmation/approval for consequential financial actions.
- Never allow the client UI alone to set a financial state.

### Permissions and auditability

- Role-based access for operations, support, finance, and super-admin functions.
- Enforce permissions on the server, not only by hiding UI controls.
- Audit sensitive reads and changes where required by policy.
- Do not expose unrestricted conversations or identity documents to finance staff by default.

---

## 7. Shared component library

Create reusable components before building many screens. Suggested component inventory:

### Foundations
- Colour and semantic tokens
- Type styles
- Spacing and layout tokens
- Radius and elevation tokens
- Icon set and sizing
- Breakpoints and responsive rules

### Inputs and actions
- Primary, secondary, tertiary, and destructive buttons
- Icon button with accessible label
- Text input, password input, search input
- Text area with character guidance where needed
- Select, multi-select, date picker, time picker, and party-size selector
- Checkbox, radio group, toggle
- Filter chip and removable selection chip
- Upload field with progress, retry, and removal
- Inline validation and field-level help

### Content and navigation
- Experience card (list and grid variants)
- Host identity/profile card
- Price breakdown
- Rating/review summary (only where real data exists)
- Verification badge with explanatory text
- Status pill with text and semantic icon
- Offer summary card
- Booking summary card
- Conversation message and structured offer message
- Empty state, error state, loading skeleton
- Toast/snackbar, inline alert, confirmation dialog, bottom sheet
- Tabs, segmented control, breadcrumb, pagination

### Component behaviour

Every interactive component should define:
- Default, hover (web), focused, pressed, disabled, loading, success, and error states where relevant.
- Keyboard and screen-reader behaviour.
- Validation and error copy.
- Responsive behaviour.
- Analytics event requirements only where product-approved and privacy-conscious.

Avoid building one-off visual variants unless there is a real use case. Keep components configurable through typed props rather than duplicated markup.

---

## 8. Content and microcopy

Tone: warm, direct, specific, respectful, and calm. The product can be charming, but it should not sound childish or overly sales-driven.

Prefer:
- “Meet your host” over “Service provider details”.
- “What’s included” and “What to bring” over vague promotional headings.
- “Your payment is still being confirmed” over a false success message.
- “This offer expired. Ask the host for an updated offer.” over a generic failure.
- “No experiences match these filters yet” plus a useful reset/edit action.

Avoid:
- Fake urgency (“Only 1 left!”) unless inventory supports it and the statement is accurate.
- Unsupported superlatives (“best”, “safest”, “number one”).
- Unclear payment status or unexplained fees.
- Blaming users for system errors.
- Cultural clichés and assumptions about travellers or hosts.

All important states should answer three questions: **What happened? What does it mean? What can I do next?**

---

## 9. States, edge cases, and accessibility

Design all major screens for more than the ideal path.

### Required states
- Initial loading and refresh
- Empty catalogue / no results
- Offline or weak connection
- API failure with retry
- Expired session and re-authentication
- Permission denied
- Missing or invalid form fields
- Upload in progress, failed upload, retry, and removal
- Slot no longer available / capacity changed
- Offer expired or withdrawn
- Payment pending, failed, cancelled, unknown, and confirmed
- Duplicate submission or webhook-safe state
- Cancellation requested, accepted, rejected, or pending
- Refund pending, processed, failed, or under review
- Payout pending, processing, failed, and reconciliation required
- Account restricted or verification incomplete

### Accessibility and localisation
- Support dynamic text scaling without clipped buttons or inaccessible scrolling.
- Provide visible focus states on web and logical keyboard navigation.
- Give form fields persistent labels; do not rely on placeholders alone.
- Announce validation and asynchronous status changes to assistive technology.
- Use accessible contrast and non-colour status cues.
- Keep touch targets generous and avoid tightly packed controls.
- Plan for localisation: longer translated strings, date/time formats, currency display, and language metadata.
- Use the experience/city timezone for displayed schedules and UTC instants for storage; make timezone context clear when relevant.

---

## 10. Figma file structure and handoff

Recommended Figma pages:

1. **00 — Cover & Principles**: product summary, design principles, status, owners, and links.
2. **01 — Foundations**: colour, type, spacing, radii, elevation, icons, breakpoints.
3. **02 — Components**: variants, states, and usage guidance.
4. **03 — Traveller App**: onboarding, explore, search, detail, checkout, bookings, inbox, profile.
5. **04 — Host App**: onboarding, listing editor, requests, offers, bookings, earnings, profile.
6. **05 — Mobile Admin**: queues, detail views, moderation, disputes, restricted finance, audit and settings inside the Flutter app.
7. **06 — Prototypes**: primary end-to-end flows and critical edge cases.
8. **07 — Handoff & Decisions**: specs, unresolved questions, implementation notes, and change log.

### Figma conventions

- Use Auto Layout for reusable components and responsive screen sections.
- Use variables for colour, spacing, radius, and semantic tokens where supported.
- Use component variants for states instead of detached duplicates.
- Name layers and components semantically (`ExperienceCard/Compact`, `Button/Primary/Loading`).
- Mark fixed, sticky, and scrollable regions explicitly.
- Annotate validation, permissions, loading, empty, and error states.
- Include realistic content lengths; avoid designing only around short placeholder text.
- Prototype the main traveller booking flow, host offer flow, and admin review flow.
- Document what is intentionally not included in the MVP.

### Figma AI prompt

> Design an original, mobile-first local experiences marketplace for India, connecting travellers with local hosts and professional guides. Follow the user-provided Dribbble reference as visual inspiration: modern, minimal, photography-led travel booking UI, clean hierarchy, crisp spacing, contemporary sans-serif typography and restrained colour. Use this palette: `#090F0A`, `#DFDFDF`, `#74A028`, `#374849`, `#B6C4D1`, `#99B1CD`, `#5197DC`, `#3664A1`. Do not use scrapbook/journal styling, paper textures, vintage travel ephemera, rustic decoration, linen surfaces or terracotta accents. Build a reusable design system with semantic colour and spacing tokens, accessible components, and default/focus/pressed/disabled/loading/error states. Design traveller flows for city discovery, search and filters, experience details, host profile, availability, checkout, bookings, inbox, structured offers and support. Design host flows for verification, experience creation/editing, requests, offers, booking fulfilment and earnings. Design a protected mobile admin area inside the same Flutter app for host verification, listing moderation, booking disputes, restricted finance reconciliation, city configuration and audit logs; do not design a separate admin website. Keep trust, transparent pricing, safety notes, cancellation policies and accurate payment states visible. Include realistic empty, loading, error, offline and pending states. Avoid fake ratings, fake scarcity, overdecorated cards and copying existing products. Prioritise accessibility, Auto Layout, reusable variants and clear developer handoff annotations.

---

## 11. Cursor implementation guidance

Use this document as visual and interaction guidance, not as permission to invent backend behaviour. Cursor should inspect the existing repository and project instructions before changing code.

### Recommended implementation approach

1. Read `AGENTS.md`, `PROJECT_CONTEXT.md`, product requirements, architecture decisions, and the existing app structure.
2. The chosen client stack is Flutter. Inspect the repository structure and follow the mobile-only architecture; do not introduce a separate web/admin stack.
3. Implement foundations and shared components first, then one vertical flow at a time.
4. Reuse existing design tokens, routing, state management, API clients, and error handling where they exist.
5. Use typed models and API-backed data. Do not hardcode fake success states or production data.
6. Add loading, empty, error, retry, and permission states as part of the feature—not as later polish.
7. Keep business rules and permissions on the server. UI checks improve usability but are not security controls.
8. Test responsive layouts, accessibility, validation, and critical state transitions.
9. Keep changes scoped, review diffs, run checks, and document any unresolved product decisions.

### Possible Flutter organisation

Adapt this to the repository rather than forcing a restructure:

```text
lib/
  app/
    app.dart
    router.dart
    theme/
      app_colors.dart
      app_typography.dart
      app_spacing.dart
      app_theme.dart
  core/
    components/
    errors/
    networking/
    accessibility/
    formatting/
  features/
    auth/
    explore/
    search/
    experiences/
    bookings/
    requests/
    inbox/
    profile/
    host/
```

Use the project’s established state-management and dependency-injection patterns. Keep API, repository, state, and presentation responsibilities separate where that matches the codebase.

### Mobile admin implementation notes

- Use a consistent mobile shell with admin navigation, clear page title, filters, queue list and dedicated detail view.
- Lists should support loading skeletons, empty states, error/retry, pagination and preserved filters.
- Use server-enforced role permissions; never rely on hidden buttons alone.
- Financial and moderation actions should show a confirmation summary and final server result.
- Do not render identity documents or private conversation content to roles without a clear permission need.

### Copy-paste Cursor prompt

> Read `AGENTS.md`, `PROJECT_CONTEXT.md`, the product requirements, and this design philosophy document before making changes. Inspect the existing repository and report the current framework, architecture, design tokens, routing, state management, and relevant feature structure. Then implement only the specific screen or flow I request. Follow the modern, minimal, photography-led travel app direction from the referenced Dribbble shot, using the specified charcoal/grey/green/blue palette, clean sans-serif typography, purposeful spacing, restrained radii, subtle borders and accessible contrast. Admin screens must live in the Flutter app, not a separate website. Reuse existing shared components and tokens; do not introduce duplicate styling systems. Implement loading, empty, error, retry, offline, validation, and disabled states appropriate to the feature. Use real typed API-backed state and existing repository patterns; do not invent endpoints, fabricate data, or simulate successful payments. Keep permissions and business rules server-enforced. Preserve unrelated code, explain assumptions, and finish with a summary of changed files and tests/checks run. If a critical product or API decision is unresolved, ask before implementing behaviour that depends on it.

---

## 12. Definition of done

A screen or flow is not complete until:

- It follows the shared design tokens and component conventions.
- Primary and secondary actions are visually clear and named consistently.
- Loading, empty, error, retry, and disabled states are handled where applicable.
- Forms have persistent labels, validation, and understandable error messages.
- Mobile layouts work with text scaling and realistic content lengths.
- Accessibility labels, focus order, contrast, and touch targets are checked.
- Payment, booking, verification, and financial statuses reflect authoritative API state.
- Permissions are enforced server-side and sensitive data is not exposed unnecessarily.
- Tests and relevant lint/type/build checks pass, or failures are documented.
- Any unresolved product decision is recorded rather than silently guessed.

---

## 13. Product decisions to confirm

These decisions should remain explicit and configurable until the product owner confirms them:

- Final brand name, logo, and production font licensing.
- Whether host mode lives in the traveller app or a separate host app.
- Initial activated cities and city-launch readiness criteria.
- Payment provider, marketplace eligibility, settlement model, refund rules, and payout timing.
- Commission percentage and policy versioning (15% is only an example in planning material, not a confirmed rate).
- Exact verification requirements by host and experience category.
- Cancellation, no-show, dispute, and review eligibility policies.
- Languages and currencies supported at launch.
- Data retention, moderation, privacy, and appeal procedures.

Do not hardcode unresolved commercial, legal, or operational decisions into the visual layer.

---

**End of document**
