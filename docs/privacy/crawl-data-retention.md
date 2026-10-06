# Crawl Data Retention & Ethics Policy

## 1. Overview
Reigel operates an automated technical SEO crawler designed to analyze website architectures, page semantics, and Core Web Vitals telemetry. This document outlines crawler ethics, respect for website owner directives, and crawl data retention boundaries.

---

## 2. Crawler Ethics & Politeness Protocols

1. **User-Agent Identification**:
   - The crawler declares a distinct and transparent User-Agent string:
     `ReigelBot/1.0 (+https://reigel.ai/bot; support@reigel.ai)`.
2. **Robots.txt & Sitemap Adherence**:
   - The crawler parses `robots.txt` before fetching page contents.
   - Any paths disassociated or disallowed via `Disallow` directives are respected and excluded from analysis.
   - Crawl-delay directives (`crawl-delay: X`) are honored to prevent server overload.
3. **Rate Limiting & Concurrency**:
   - Concurrent requests to a single hostname are strictly capped (default: 2-5 concurrent workers).
   - In the event of HTTP `429 Too Many Requests` or `503 Service Unavailable`, workers trigger exponential backoff.
4. **SSRF & Localhost Protection**:
   - Requests targeting private IP blocks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`), loopback addresses, or cloud metadata endpoints (`169.254.169.254`) are blocked at URL resolution to prevent Server-Side Request Forgery.

---

## 3. Data Retention Lifecycle

| Category | Storage Entity | Retention Window | Purge Trigger |
| :--- | :--- | :--- | :--- |
| **Raw HTML & DOM Snapshots** | Ephemeral / Parsed on-the-fly | Transient; discarded post-parsing | End of individual page analysis |
| **Page Metadata & Metrics** | `Page` table | Lifespan of the Project or Crawl Job | Project deletion, job rerun, or manual crawl wipe |
| **Identified Technical Issues** | `TechnicalIssue` table | Lifespan of the Project | Project deletion or issue resolution |
| **Worker Queue Metadata** | Redis (BullMQ) | 24 - 72 Hours | Automatic TTL eviction |

---

## 4. Crawl Data Minimization
- The crawler captures only public metadata necessary for technical SEO diagnostics:
  - `<title>`, `<meta name="description">`, `<link rel="canonical">`, Open Graph tags.
  - Headings structure (`h1` through `h6`).
  - Image `src` and `alt` tags.
  - Anchor `href` attributes for internal link topology.
  - Structured data (`<script type="application/ld+json">`).
- Passwords, credit cards, user-generated session forms, and private cookies are never requested or stored.
