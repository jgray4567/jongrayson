# FAF Website — Build Spec

## Status: Awaiting HTML designs from Jon

## Source Documents
- **Architecture PDF:** `FAF-Website-Content-Architecture---3c8938d2-ee1e-4e9f-bc83-54a0b03531ff.pdf` — Full content architecture, Strapi model, Mailchimp integration, URL strategy
- **Local PoC:** `/Users/jsg/.openclaw/workspace/faf-site/` — Working Strapi v5 + Next.js demo (content seeded, APIs verified)

## Build Workflow
1. **Jon provides** pixel-perfect HTML files with CSS, optimized for mobile and desktop
2. **I convert** each HTML layout into Next.js components, preserving exact design fidelity
3. **I wire** each component to Strapi CMS so content editors can manage everything
4. **I build** the page builder (dynamic zones) so homepage and chapter pages compose from blocks
5. **I add** Mailchimp integration per Section 6 of the architecture PDF

## Critical Requirements
- **Mobile-first.** 65-80% of FAF's audience is mobile. Every page, every component, every interaction must work flawlessly on mobile. No broken layouts, no tiny tap targets, no horizontal scroll.
- **Pixel-perfect conversion.** Jon's HTML/CSS is the source of truth for design. I replicate it exactly in Next.js components.
- **Responsive breakpoints.** Mobile (320-480), tablet (481-1024), desktop (1025+). All must render correctly.
- **CSS preservation.** Jon's CSS stays intact — I extract into Tailwind utility classes or CSS modules as appropriate, but the visual output must match the original HTML exactly.

## Strapi Content Model (from Architecture PDF)

### Collection Types
| Type | Key Fields | Purpose |
|---|---|---|
| chapter | name, slug, stateAbbrev, hero, whyItMatters, issues (→topic), aboutBody, localContact, donateDesignationKey, mailchimpStateTag, pageBuilder | One per state chapter |
| content-item | title, slug, contentType (enum), summary, body, publishDate, author (→author), pdfFile, states (→chapter), topics (→topic), featuredImage, seo | Unified content type for all publications including blog/perspectives |
| topic | name, slug, description, icon, sharedAcrossStates | Taxonomy for issues/topics |
| author | name, title, photo, bio | Bylines |
| event | title, date, location, description, rsvpLink, states (→chapter) | Events filtered by state |
| page | title, slug, pageBuilder (dynamic zone), seo | Flexible static pages |

### Reusable Components
| Component | Fields | Used In |
|---|---|---|
| shared.hero | eyebrow, heading, subheading, backgroundImage, ctas | Homepage, Chapter pages, Our Work |
| shared.stat-block | items (label, value, sourceNote) | "Why It Matters", Homepage stats |
| shared.issue-tile | topic (relation), customBlurb, icon override | Chapter "Issues" grid |
| shared.cta-button | label, url/internal link, style (primary/secondary) | Everywhere |
| shared.section-header | eyebrow, title, alignment | Any content section |
| shared.seo | metaTitle, metaDescription, ogImage | Every page |
| forms.donate-options | designationOptions (label, key) | Donate page, chapter "How You Can Help" |
| forms.signup-fields | stateInterestOptions (label, mailchimpTag) | Sign Up page, sidebar |

### Dynamic Zone Blocks (Page Builder)
- Hero
- Stat Block ("Why It Matters" / "Key Stats")
- Issue Grid
- Latest Content Feed (auto-filtered by state/topic/content type)
- Rich Text
- Two-Column / Comparison Cards
- Chapter Card Grid (auto-pulls all chapters)
- Pull Quote
- CTA Band (donate / sign up / download)
- Section Divider

### Single Types
| Type | Purpose |
|---|---|
| homepage | National homepage — mission hero, Chapter Card Grid, Latest feed, Get Involved CTA |
| serving-new-england | Regional hub — renders Chapter Card Grid |
| global | Site-wide settings (logo, nav, footer, social, contact, Mailchimp ID) |

### Roles & Permissions
- **Super Admin** — full access (developer/agency)
- **National Editor** — create/edit/publish any content, page, or chapter
- **Chapter Editor** — create/edit content pre-tagged to their state only
- **Marketing/Email** — read access for content-items and Mailchimp sync

## URL Strategy (from PDF Section 7)
| Page | URL | Notes |
|---|---|---|
| Chapter pages | /vermont, /massachusetts, etc. | Flat slugs for SEO continuity |
| Serving New England hub | /serving-new-england | Chapter Card Grid |
| Our Work hub | /our-work?state=X&topic=Y | Filterable single hub |
| Content items | /our-work/[content-type]/[slug] | Matches current slug style; perspectives = blog |
| Blog (Perspectives) | /perspectives or /our-work/perspectives | Filterable blog feed; individual posts at /perspectives/[slug] |
| Get Involved | /donate, /sign-up-for-emails, /membership, /bequests, /stocks | Match current slugs |

## Mailchimp Integration (from PDF Section 6)
- Sign-up form → Strapi custom endpoint → Mailchimp API (upsert with State/Topic tags)
- Donation webhook → Strapi → Mailchimp (apply Donor: designation tag)
- Content publish webhook → Mailchimp (RSS-to-email or campaign draft)
- Tag structure mirrors Strapi taxonomy: State, Topic, Donor designation, Content digest

## Scalability Playbook (from PDF Section 9)
Launching a new state chapter = content task, not dev project:
1. Create chapter entry in Strapi
2. Add to global nav (auto-updates Chapter Card Grid)
3. Tag 2-3 seed content items
4. Add designation/signup options
5. Add Contact routing
6. Create matching Mailchimp tags

## Migration Notes (from PDF Section 10)
- Audit existing NationBuilder pages → tag by State/Topic/Content Type
- /serving-new-england and /vermont have no content — build first using Chapter Template
- Migrate footer/global settings to global single type
- Re-create existing PDFs/reports as content-items with pdfFile media fields
- Set up 301 redirects from NationBuilder URLs

## What We Already Have (PoC)
- Strapi v5.48.0 running locally with 5 content types and seeded data
- Next.js 16 frontend with 7 pages, API client, Tailwind CSS
- Public API access verified (no auth token needed)
- All APIs tested and rendering live content
- Handoff docs: README.md, SETUP.md, ARCHITECTURE.md

## What We Need from Jon
- [ ] Pixel-perfect HTML/CSS files for each page layout (mobile + desktop)
- [ ] Blog layout — featured/pinned posts + standard feed (perspectives content type)
- [ ] Confirm URL strategy matches PDF or adjust
- [ ] FAF brand assets (logo, colors, fonts, imagery)
- [ ] Mailchimp API key and audience ID
- [ ] Donation/payment provider details
- [ ] Access to current NationBuilder content for migration
- [ ] Confirm roles/permissions structure
- [ ] Which blog posts should be "featured" vs standard at launch