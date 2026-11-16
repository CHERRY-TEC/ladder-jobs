# Ladder — jobs at every level

A job board that covers the full range of work: internships, household and daily-wage jobs,
delivery gigs, skilled trades, office roles, and professional jobs like HR — with the
education requirement shown up front on every listing.

## Features

- **Staircase filter** — pick your education rung (No degree / Diploma / Graduate / Any)
  right in the hero to narrow the board.
- **Search + filters** — keyword, location, category, job type, education, and sorting
  (newest, pay, title). Filter state lives in the URL, so links are shareable.
- **Job detail page** — full description, duties, who can apply, and how to apply
  (call / email / link buttons).
- **Post a job form** — anyone can publish a listing; it is saved in your browser
  (localStorage) and marked "Posted by you".
- **Saved listings** — bookmark anything; saved jobs persist across visits.
- 38 seeded sample listings spanning household work to senior HR.

## Run it

```bash
cd ladder-jobs
npm install
npm run dev
```

Open http://localhost:5173

Production build: `npm run build` (output in `dist/`), preview with `npm run preview`.

## Structure

```
src/
  data/seed.js        # categories, education levels, 38 sample listings
  lib/store.jsx       # React context: jobs, favorites, toast notifications
  lib/format.js       # relative time, filter matching, contact link helpers
  components/         # Header, Footer, JobRow, FilterPanel, StairNav, SaveButton…
  pages/              # Home, JobDetail, PostJob, Saved, NotFound
```

## Notes

- Listings and contact numbers are **sample data** for demonstration.
- New listings and favorites are stored per-browser in localStorage — no backend yet.
  To make postings public later, swap `lib/store.jsx` for an API or database
  (e.g., Supabase) — the components will not need to change.
