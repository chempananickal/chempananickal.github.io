# chempananickal.github.io

Personal hobby projects site by R C James — a bioinformatician and dual student at Sanofi with a background in R, Python, and chemoinformatics (RDKit).

The site contains a blog plus a small set of interactive tools.

Live at: [chempananickal.github.io](https://chempananickal.github.io)

---

## Blog Setup

The blog uses [**Eleventy (11ty)**](https://www.11ty.dev/) so posts can be written in Markdown and built into static HTML.

### Blog authoring

Write posts as Markdown files in `blog/posts/`.

Example front matter:

```md
---
title: My New Post
description: Short summary for the blog index.
date: 2026-03-11
---

## Hello

This is a post.
```

### Commands

```bash
npm install
npm run dev
npm run build
npm run watch
```

Eleventy outputs the built site to `_site/`.

### Local preview

- Use `npm run dev` for the normal Eleventy workflow. This serves the built site and rebuilds automatically.
- If you want to keep using VS Code Live Server, run `npm run watch` in one terminal and let Live Server serve `_site`.
- Tool links on the homepage are generated automatically from files that follow `tools/tool-name/tool-name.html`.

---

## Projects

### 🌳 Trie Hard — Suffix Trie Explainer

**Path:** [`tools/trie-hard/trie-hard.html`](tools/trie-hard/trie-hard.html)

A step-by-step animated explainer for the uncompressed suffix trie — the conceptual precursor to the DAWG.

**What it teaches:**

- How every suffix of a word is inserted into a trie, character by character
- When an edge already exists (shared prefix) vs. when a new node must be created
- How to perform substring search in O(|pattern|) time by walking from the root
- Why the O(n²) node count of a suffix trie motivated compressed data structures like the DAWG

**Features:**

- DFS-based tree layout (leaves get unique vertical slots; internal nodes centre between their children) — always looks like a proper tree regardless of input
- Leaf nodes rendered with a double circle
- Substring search visualisation — shows each edge followed or the dead-end when the pattern is absent
- Light/dark mode toggle (shared `localStorage` key with Yo DAWG)
- Keyboard navigation and touch support

**Algorithm complexity:** O(n²) nodes, O(n²) construction time, O(|pattern|) search time.

---

### 🐕 Yo DAWG — Suffix Automaton Explainer

**Path:** [`tools/yo-dawg/yo-dawg.html`](tools/yo-dawg/yo-dawg.html)

A step-by-step animated explainer for the Directed Acyclic Word Graph (suffix automaton).

**What it teaches:**

- How the `sa_extend` algorithm adds one character at a time to build the DAWG
- What states, transitions, suffix links, and `len` values mean
- How to find the Longest Common Substring (LCS) between two strings in O(|query|) time by traversing the completed automaton

**Features:**

- Pre-computed step snapshots — walk forward and back through every algorithm operation
- SVG graph with a `len`-based hierarchical layout (transitions flow left→right, suffix links arc right→left)
- Parallel-edge fan-out so overlapping edges are separated
- Full pseudocode reference (collapsible)
- Light/dark mode toggle (persists via `localStorage`, respects `prefers-color-scheme` as default)
- Keyboard navigation (← / →)
- Touch-friendly, mobile-responsive

**Algorithm complexity:** O(n) states (at most 2n − 1), O(n) construction time.

---

## Tech Stack

- Vanilla HTML5, CSS3, JavaScript (ES6+, `"use strict"`) for the interactive pages
- Eleventy for the markdown blog and reusable `idiot` theme
- SVG rendered as inline strings from JavaScript
- CSS custom properties for theming; `prefers-color-scheme` + manual `localStorage` toggle
- Win95-style bevelled buttons, Comic Neue headings, `prefers-reduced-motion` support

## Repo Structure

```text
index.html          — homepage (Eleventy/Nunjucks)
feed.njk            — Atom RSS feed (builds to /feed.xml)
_data/
    site.js         — global site config (title, author, URL)
    tools.js        — tool list data
_includes/
    layouts/
        idiot-base.njk  — base HTML layout
        idiot-post.njk  — blog post layout
idiot/
    assets/
        idiot.css   — theme styles
        idiot.js    — theme scripts (theme toggle, etc.)
blog/
    index.njk       — blog archive page
    posts/
        posts.11tydata.js  — directory-level frontmatter defaults
        *.md               — blog posts
tools/
    yo-dawg/
        yo-dawg.html
        yo-dawg.css
        yo-dawg.js
    trie-hard/
        trie-hard.html
        trie-hard.css
        trie-hard.js
fonts/              — Comic Neue font files
```
