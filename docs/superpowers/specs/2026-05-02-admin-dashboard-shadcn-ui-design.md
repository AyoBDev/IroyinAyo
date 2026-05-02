# Admin Dashboard — shadcn/ui Design System Integration

## Overview

Refactor the Iroyinayo admin dashboard from raw Tailwind CSS utility classes to shadcn/ui as the component library and design system. Dark mode as the default theme. All 7 pages (Login, Dashboard, Students, Content, Quizzes, Markets, Rewards) will be refactored. No functionality changes — same API calls, auth flow, and CRUD operations. This is purely a UI layer swap.

## Tech Stack Additions

| Package | Purpose |
|---------|---------|
| shadcn/ui v2 | Component library (Tailwind v4 compatible) |
| @tanstack/react-table | DataTable with sorting, filtering, pagination |
| lucide-react | Icon set (replaces emoji icons) |
| @radix-ui/* | UI primitives (pulled in by shadcn components) |
| clsx | Conditional class names |
| tailwind-merge | Merge Tailwind classes without conflicts |
| class-variance-authority | Component variant definitions |

## Theming

- **Dark mode as default** via CSS class strategy on `<html>`
- **Base color:** Zinc
- **CSS variables** defined in `globals.css` for the dark palette (zinc-950/900 backgrounds, zinc-50/100 text, accent colors for interactive elements)
- **No light mode toggle** — dark only
- **Style:** default shadcn style

## File Structure

```
src/
├── components/
│   ├── ui/                    # shadcn/ui components (auto-generated)
│   │   ├── button.jsx
│   │   ├── card.jsx
│   │   ├── input.jsx
│   │   ├── label.jsx
│   │   ├── select.jsx
│   │   ├── textarea.jsx
│   │   ├── table.jsx
│   │   ├── dialog.jsx
│   │   ├── sheet.jsx
│   │   ├── badge.jsx
│   │   ├── dropdown-menu.jsx
│   │   ├── sidebar.jsx
│   │   └── separator.jsx
│   ├── data-table.jsx         # Reusable DataTable (tanstack + shadcn Table)
│   └── stat-card.jsx          # Dashboard stat card (wraps shadcn Card)
├── lib/
│   ├── utils.js               # cn() utility (tailwind-merge + clsx)
│   ├── api.js                 # Existing API client (unchanged)
│   └── auth.js                # Existing auth context (unchanged)
└── app/
    ├── globals.css            # Updated with shadcn CSS variables, dark theme
    ├── layout.js              # Updated: adds dark class to html
    ├── client-layout.js       # Refactored: shadcn Sidebar
    ├── page.js                # Dashboard: StatCards + simple Table
    ├── login/page.js          # Card + Input + Button
    ├── students/page.js       # DataTable + Sheet for details
    ├── content/page.js        # DataTable + Dialog for create/edit
    ├── quizzes/page.js        # DataTable + Dialog for create/edit
    ├── markets/page.js        # DataTable + Dialog + DropdownMenu
    └── rewards/page.js        # Two DataTables + Dialog
```

## Shared Components

### DataTable

Reusable component wrapping `@tanstack/react-table` and shadcn `Table`.

**Features:**
- Column definitions passed as prop
- Clickable column headers for sorting
- Search/filter text input at the top
- Pagination controls: previous/next buttons, page size selector (10, 25, 50)
- Optional row action column via `DropdownMenu`

**Used on:** Students, Content, Quizzes, Markets, Rewards

### StatCard

Wraps shadcn `Card` for dashboard metric display.

**Props:** title, value, optional subtitle/trend indicator

**Used on:** Dashboard page

## Layout & Navigation

### Sidebar

- shadcn `Sidebar` component replacing the current hand-built sidebar
- Dark background (zinc-950/900)
- Collapsible
- Navigation items using `SidebarMenu` with lucide-react icons:
  - LayoutDashboard → Dashboard
  - Users → Students
  - FileText → Content
  - Brain → Quizzes
  - TrendingUp → Markets
  - Gift → Rewards
- Active page highlighted with accent color
- Footer: admin name, role, sign-out button

### Header

Simple top bar showing the current page title. No breadcrumbs.

### Content Area

Clean padded container. Pages use shadcn `Card` where grouping makes sense.

## Page Designs

### Login (`/login`)

- Centered on screen, dark background
- shadcn `Card` containing:
  - Title: "Iroyinayo Admin"
  - `Label` + `Input` for email
  - `Label` + `Input` (type=password) for password
  - `Button` (default variant) for submit
  - Error message display below form

### Dashboard (`/`)

- Grid of `StatCard` components for key metrics (total students, active today, points issued, etc.)
- Leaderboard section: shadcn `Table` (simple, not DataTable) showing top students with rank, name, points
- All data fetched from existing `/admin/analytics` and `/gamification/leaderboard` endpoints

### Students (`/students`)

- `DataTable` with columns: name, phone, level, points, status
- Status column: `Badge` — green for active, red for banned
- Row actions via `DropdownMenu`: View Details, Ban/Unban
- View Details opens `Sheet` (slide-out panel) with:
  - Student info (name, phone, WhatsApp ID, level, department)
  - Points balance and history
  - Activity log
- Ban/Unban shows confirmation `Dialog`

### Content (`/content`)

- `DataTable` with columns: title, category, status, created date
- Category: `Badge` with category name
- Status: `Badge` — yellow for pending, blue for approved, green for published
- Row actions via `DropdownMenu`: Edit, Approve, Publish, Broadcast, Delete
- Create/Edit: `Dialog` with form fields:
  - `Input` for title
  - `Select` for category (scholarships, entertainment, tech, sports, campus_news, career, health, academic)
  - `Textarea` for body
  - AI generation controls: `Select` for category + `Button` to generate
- Delete/Approve/Publish: confirmation `Dialog`

### Quizzes (`/quizzes`)

- `DataTable` with columns: question (truncated), category, points reward, created date
- Row actions via `DropdownMenu`: Edit, Delete
- Create/Edit: `Dialog` with form fields:
  - `Textarea` for question
  - 4x `Input` for answer options
  - `Select` for correct answer (A/B/C/D)
  - `Select` for category
  - `Input` (number) for points reward

### Markets (`/markets`)

- `DataTable` with columns: question, status, probability, created date
- Status: `Badge` — yellow for pending, green for open, gray for closed, blue for resolved
- Row actions via `DropdownMenu`: Edit, Resolve, Close
- Create: `Dialog` with form fields:
  - `Textarea` for question
  - `Input` (number) for initial probability
  - `Input` (number) for sponsor bonus (optional)
- Resolve: confirmation `Dialog` with Yes/No outcome selection

### Rewards (`/rewards`)

- Two sections, each with its own `DataTable`:
  1. **Reward Options** — columns: name, type, points cost, active status
     - Row actions: Edit, Toggle Active
     - Create/Edit: `Dialog` with name, type (`Select`), points cost (`Input`), description (`Textarea`)
  2. **Pending Redemptions** — columns: student name, reward, points spent, requested date
     - Row action: Fulfill (confirmation `Dialog`)

## Component Variants & Styling

### Buttons
- `default` — primary actions (submit, create, save)
- `destructive` — ban, delete, reject
- `outline` — secondary actions (cancel, close)
- `ghost` — tertiary/subtle actions (sidebar nav items)

### Badges
- Default (zinc) — neutral/informational
- Green — active, published, resolved
- Yellow — pending
- Blue — approved, open
- Red — banned, rejected
- Custom badge variants defined via CVA if needed

## What Does NOT Change

- API client (`src/lib/api.js`) — same fetch wrapper, same endpoints
- Auth context (`src/lib/auth.js`) — same cookie-based auth, same role checking
- Business logic — same CRUD operations, same validation
- Routing — same Next.js App Router structure, same paths
- Environment config — same `.env.local` setup
