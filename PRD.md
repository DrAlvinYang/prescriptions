# EMHub - Product Design Reference

## Overview

**EMHub** is a client-side web application for Emergency Department (ED) physicians to quickly generate discharge prescriptions. It provides a searchable database of ~400 curated ED prescriptions, a cart-based workflow, and PDF printing -- all running entirely in the browser with no backend.

**Live URL:** https://www.emhub.ca

---

## Hosting & Infrastructure

### Domain

- **Domain:** emhub.ca
- **Registrar:** Namecheap (namecheap.com)
- **DNS Records (Namecheap Advanced DNS):**

| Type | Host | Value |
|------|------|-------|
| A Record | @ | 216.24.57.1 |
| CNAME | www | prescriptions.onrender.com |

- `emhub.ca` redirects to `www.emhub.ca` (handled by Render)
- SSL certificates are issued automatically by Render (Let's Encrypt)

### Hosting

- **Platform:** Render.com (Static Site, free tier)
- **Site Name:** prescriptions
- **Render URL:** https://prescriptions.onrender.com
- **Branch:** main
- **Build Command:** (none - plain static site)
- **Publish Directory:** `.` (root)
- **Auto-Deploy:** Yes, on push to `main`

### Source Control

- **GitHub Repo:** https://github.com/DrAlvinYang/prescriptions.git
- **GitHub Account:** dralvinyang@gmail.com (DrAlvinYang)
- **Branch:** `main`
- **Deployment Flow:** Push to `main` -> Render auto-deploys -> live at emhub.ca

---

## Architecture

Fully client-side SPA. No server, no backend, no API calls (except jsPDF loaded from CDN for printing). State is persisted in localStorage.

```
data/Prescriptions.xlsx  ---+
data/Locations.json      ---+-- tools/build.py --> js/*-data.js (base64-encoded)
data/AuthorizedProviders ---+

index.html + css/styles.css + js/01-04.js + js/*-data.js
                |
                +-- Runs entirely in the browser
                    localStorage for state persistence
                    jsPDF (CDN) for PDF generation
```

### Build Pipeline

After editing any data source in `data/`, run:

```bash
python tools/build.py
```

This converts Excel/JSON data files into base64-encoded JS constants (`js/*-data.js`) that are embedded directly in the page. Base64 encoding avoids CORS issues when running from `file://` and lightly obscures provider CPSO numbers.

---

## Project Structure

```
Prescriptions/
+-- index.html                    # Single-page application (sole HTML file)
+-- CLAUDE.md                     # AI assistant project rules
+-- PRD.md                        # This file
+-- .gitignore
+-- start_localhost.command       # macOS script to start local dev server
+-- css/
|   +-- styles.css                # All styling (~44KB), Nordic Minimalist theme
+-- js/
|   +-- prescription-data.js      # Auto-generated: base64 prescription DB
|   +-- location-data.js          # Auto-generated: base64 hospital locations
|   +-- provider-data.js          # Auto-generated: base64 authorized providers
|   +-- 01-core.js                # Config, state, utilities, medication logic
|   +-- 02-ui.js                  # DOM builders, renderers
|   +-- 03-controllers.js         # Business logic controllers
|   +-- 04-app.js                 # Application init and event wiring
+-- data/
|   +-- Prescriptions.xlsx        # Master prescription database (source of truth)
|   +-- Locations.json            # Ontario hospital names + addresses
|   +-- AuthorizedProviders.json  # Authorized physicians (name + CPSO)
+-- tools/
    +-- build.py                  # Data-to-JS build script
    +-- prescription_converter.py # Excel-to-JSON converter
    +-- test_converter.py         # Unit tests for converter
```

---

## Key Features

### Prescription Search
- Full-text multi-term search across medication names, brand names, indications, doses, routes, frequencies
- Supports route synonyms (e.g. "PO" matches "oral"), numeric range matching, frequency/duration parsing
- Keyboard navigation (arrow keys, Enter)

### Dashboard
- 3-column specialty folder grid (14 specialties: Anti-infective, Cardiac & Heme, Derm, ENT, Eye, GI & GU, etc.)
- Collapsible Adult/Pediatric sub-sections per specialty
- Responsive: 3 columns (wide) -> 2 columns (1050px) -> 1 column (700px)

### Cart & Printing
- Add medications to cart, edit dose/route/frequency/duration/dispense/refill/PRN/notes
- Undo support (Ctrl+Z, up to 20 steps)
- PDF generation via jsPDF (loaded lazily from CDN)
- Quick-print from search results (bypasses cart)
- Requires valid provider name + CPSO before printing

### Weight-Based Dosing
- Pediatric dose auto-calculation from patient weight (mg/kg)
- Max dose capping and smart rounding
- Weight input persists across prescription selections

### Provider System
- Authorized provider list: Alvin Yang, Priscilla Yung, Joshua Shapiro
- Provider name + CPSO stored in localStorage
- `isOwner()` gate: indication field only visible to authorized providers

### Location System
- Built-in Ontario hospital directory (100+ hospitals)
- Custom location support (stored in localStorage)
- Location shown on printed prescriptions

---

## Design

- **Style:** Nordic Minimalist (simple, elegant, unique)
- **Dark Mode:** Full support via CSS custom properties (`prefers-color-scheme: dark`)
- **Accent Color:** #007AFF (iOS-style blue)
- **Desktop Only:** Overlay blocks usage on screens narrower than ~800px
- **Medical Units:** Canadian standard

---

## Development Workflow

### Local Development

```bash
# Start local server (or just open index.html directly)
open start_localhost.command
```

The site works from `file://` thanks to base64-embedded data.

### Updating Prescriptions

1. Edit `data/Prescriptions.xlsx`
2. Run `python tools/build.py`
3. Test locally
4. Commit and push to `main`
5. Render auto-deploys

### Deploying Changes

```bash
git add <files>
git commit -m "Description of changes"
git push origin main
```

Render detects the push and redeploys automatically within a few minutes.

### Running Tests

```bash
python tools/test_converter.py
```

---

## Accounts & Access

| Service | Account | Purpose |
|---------|---------|---------|
| GitHub | dralvinyang@gmail.com (DrAlvinYang) | Source code hosting |
| Render | (linked to GitHub) | Static site hosting |
| Namecheap | (domain registrar account) | Domain registration & DNS |
