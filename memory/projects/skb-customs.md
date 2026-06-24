# SKB Customs — Client Spec

## Status: Awaiting Confirmation — Jon checking if partnership with Chicago Pontoon Parts is still active

## Client Info
- **Business:** SKB Customs — custom pontoon boat restoration, customization, and upgrades
- **Location:** Mineral, VA (appointments only)
- **Phone:** 540.513.8578
- **Current Site:** https://www.skbcustoms.com/ (Webflow, 4 pages, no ecommerce)
- **Reseller Partner:** Chicago Pontoon Parts (https://chicagopontoonparts.com/) — Magento-based parts catalog, 300+ products

## Current SKB Site (skbcustoms.com)
- 4 pages: Home, About Us, Services, Contact
- Clean black/white branding with topographic map texture, bear logo
- Simple contact form (Name, Email, Message, Terms checkbox)
- Social: Facebook, Instagram
- No ecommerce, no product catalog, no booking system
- Professional but minimal — service business brochure site

## Reseller Partner Site (chicagopontoonparts.com)
- **Platform:** Magento (likely Magento 1 — end-of-life since June 2020)
- **Catalog:** 300+ products across 12 top-level categories
  - OEM Parts, Boat Parts, Boats for Sale, Docks/Dock Parts, Electrical, Furniture, Hull Kits, Motors/Parts, Projects to Finish, Trailers/Parts, Recycled Parts, Ski/Wake Boat Parts
- **Subcategories:** Bar Tops, Captain Seats, CPP Pontoon Seats, DIY Furniture, Fishing Seats, Floor Covering, Furniture Parts/Accessories, OEM Pontoon Interiors, Vinyl Materials, etc.
- **Features:** Wishlist, Compare, Account system, Cart, Checkout, Search, Layered navigation, Grid/List view, Pagination
- **Issues:** Broken/missing product images, several category pages 404, dated design, not mobile-optimized, Magento 1 EOL security risk
- **Pricing:** Products range from $69 (crossmembers) to $1,200+ (splash guard kits)

## Proposed Architecture: Strapi + Next.js + Stripe

### Strapi Content Types
```
products
├── name, slug, sku
├── price, salePrice, costPrice
├── description, specs (rich text)
├── images (multiple)
├── category → categories
├── subcategory → subcategories
├── variants (size, color, material)
├── compatibility (which pontoon models)
├── inStock, stockCount
├── isFeatured, isSale
└── seo (metaTitle, metaDescription, ogImage)

categories
├── name, slug, description
├── parentCategory (self-relation for subcategories)
└── image

services
├── name, slug, description
├── price (or "Contact for Quote")
├── images (before/after portfolio)
└── serviceType (restoration, custom-build, upgrade)

portfolio-projects
├── name, slug, description
├── beforeImages, afterImages
├── serviceType
├── clientTestimonial
└── completionDate

testimonials
├── clientName, location
├── quote, rating
└── project (relation to portfolio-projects)

consultation-requests
├── name, email, phone
├── pontoonType, projectDescription
├── budgetRange, preferredContactMethod
└── status (new, contacted, quoted, closed)
```

### Next.js Frontend Pages
- `/` — Homepage (hero, services CTA, featured parts, portfolio highlights)
- `/parts` — Full product catalog with category filters, search, pagination
- `/parts/[category]` — Category listing (e.g., /parts/furniture)
- `/parts/[category]/[slug]` — Product detail page
- `/services` — SKB customization services overview
- `/services/[slug]` — Individual service detail
- `/portfolio` — Before/after project gallery
- `/portfolio/[slug]` — Individual project showcase
- `/cart` — Shopping cart
- `/checkout` — Stripe checkout
- `/contact` — Consultation request form
- `/about` — SKB story

### Stripe Integration
- Product checkout for parts (standard Stripe checkout)
- Deposit payments for custom work ($500 deposit, remainder on completion)
- Invoice generation for service quotes
- Webhooks back to Strapi for order tracking
- SKB resells at markup over Chicago Pontoon Parts wholesale pricing

### Product Data Migration
- Scrape/sync 300+ products from Chicago Pontoon Parts catalog
- Add SKB markup pricing
- Map to Strapi categories
- Product images need re-acquisition (current site has broken images)
- Consider CSV import or API sync if Chicago Pontoon Parts provides a feed

## Build Scope & Pricing
- **Build:** $3,000-5,000 (catalog migration, custom design, Stripe integration, service booking)
- **Monthly hosting:** $50-75 on JK Web Team AX52 platform
- **Transaction fees:** Stripe processing only (2.9% + 30¢)

## Two Customer Paths
1. **"I need parts"** → Browse catalog → Add to cart → Stripe checkout → Ship from SKB/Chicago Pontoon
2. **"I want my pontoon customized"** → Consultation form → SKB contacts → Quote → Deposit → Project management

## Key Decisions (Pending Jon)
- Is the Chicago Pontoon Parts partnership still active?
- Does SKB get wholesale pricing or a commission/referral model?
- Will SKB hold inventory or drop-ship from Chicago?
- Does SKB want to sell the full 300+ product catalog or a curated subset?
- Product images — will Chicago Pontoon Parts provide them, or do we need to source new ones?
- Does SKB want appointment booking with deposit, or just a contact form?
- Brand direction — keep current black/white topographic design or refresh?