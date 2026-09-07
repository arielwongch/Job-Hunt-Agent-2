# Tailored CV Generator – Architecture

## 1. Overview

A simple, fully local application that lets you:

1. Manage experiences (and locked sections) in a local vector database
2. Edit / add experiences via a React UI
3. Trigger a ReAct-based CV tailoring process via API (user supplies a job description snippet → LLM searches the web → generates a filled LaTeX CV from your template → compiles to PDF)

Everything runs and stores data on your machine. No cloud database, no multi-user auth, no unnecessary services.

---

## 2. High-level Components

    ┌─────────────────┐          ┌──────────────────────┐
    │  React Frontend │◄────────►│  Express Backend     │
    │  (CRUD + search)│          │  (API + ReAct agent) │
    └─────────────────┘          └──────────┬───────────┘
                                            │
                                            ▼
                                 ┌──────────────────────┐
                                 │  LanceDB (local)     │
                                 │  + your .tex template│
                                 │  + /generated/ folder│
                                 └──────────────────────┘

- **Frontend**: React SPA – only responsible for viewing, searching, adding and editing database entries.
- **Backend**: Node.js + Express – exposes REST endpoints for the UI and the single “tailor CV” endpoint.
- **Database**: LanceDB (file-based, local). Stores both editable experiences and locked sections.
- **LLM**: OpenRouter (called from the backend).
- **Template**: Your existing `.tex` file (kept in the repo).
- **Output**: Generated CVs land in `/generated/YYYY-MM-DD_Company_JobTitle/`.

---

## 3. Data Model (LanceDB)

Single table/collection for everything.

| Field              | Type     | Notes                                      |
|--------------------|----------|--------------------------------------------|
| id                 | string   | UUID                                       |
| type               | string   | `work` / `education` / `project` / `skill` / `leadership` / `personal` / `certification` / `award` |
| title              | string   |                                            |
| company            | string   | organization / institution                 |
| start_date         | string   | ISO or free-text                           |
| end_date           | string   |                                            |
| description        | string[] | bullet points                              |
| skills             | string[] | technologies / keywords                    |
| location           | string   |                                            |
| locked             | boolean  | `true` = AI must never edit (Personal Info, Certifications, Awards) |
| embedding          | vector   | generated from title + description + skills |

- Locked records (`locked = true`) are never modified by the ReAct agent.
- Editable categories: Work, Education, Projects, Skills, Leadership (ECA).

---

## 4. Backend (Express)

### Endpoints

| Method | Path                    | Purpose                                      |
|--------|-------------------------|----------------------------------------------|
| GET    | `/api/experiences`      | List / filter experiences                    |
| GET    | `/api/experiences/search?q=...` | Semantic search (LanceDB vector search) |
| POST   | `/api/experiences`      | Add new experience                           |
| PUT    | `/api/experiences/:id`  | Update experience                            |
| DELETE | `/api/experiences/:id`  | Delete experience                            |
| POST   | `/api/tailor`           | **Main ReAct endpoint** (job description → CV) |

### ReAct Flow (`POST /api/tailor`)

1. Receive job-description text from the user.
2. Embed the job description and retrieve the most relevant **unlocked** experiences from LanceDB.
3. Call OpenRouter with a ReAct-style prompt that includes:
   - The retrieved experiences
   - The locked sections (Personal Info, Certifications, Awards)
   - Instruction to search the web for any missing company / role context
4. LLM returns a complete filled LaTeX document based on your template.
5. Backend writes the `.tex` file and runs a local LaTeX compiler (`pdflatex` or `xelatex`) to produce the PDF.
6. Both files are saved under:

    /generated/YYYY-MM-DD_CompanyName_JobTitle/
      ├── cv.tex
      └── cv.pdf

7. Return the paths (or download links) to the client.

No streaming UI, no long-running WebSocket – just a single API call that blocks until the PDF is ready (or times out gracefully).

---

## 5. Frontend (React)

- Simple single-page app.
- Pages / views:
  - Experience list (table or cards)
  - Semantic search bar
  - Add / Edit form (all fields from the data model)
  - Toggle or badge that shows whether a record is locked
- No “Tailor CV” UI – that is intentionally left to the API only.
- Talks only to the Express REST endpoints above.

---

## 6. File Layout (repo)

    /
    ├── backend/
    │   ├── src/
    │   │   ├── routes/
    │   │   ├── services/          # LanceDB, OpenRouter, LaTeX compiler
    │   │   └── index.js
    │   └── package.json
    ├── frontend/                  # React app
    ├── template/
    │   └── cv.tex                 # your existing template
    ├── data/                      # LanceDB files live here
    ├── generated/                 # all tailored CVs
    └── architecture.md

---

## 7. Key Design Decisions (kept deliberately simple)

- Everything is local (LanceDB files + generated PDFs).
- No authentication, no multi-user support.
- No background job queue – the tailor endpoint is synchronous.
- Vector search is used both for the UI enquiry **and** for retrieving relevant experiences inside the ReAct loop.
- Locked sections are stored in the same table with a boolean flag – no separate collections.
- LaTeX compilation is done with a system-installed engine (user responsibility to have `pdflatex`/`xelatex` available).

---

## 8. Future-proofing (optional, not implemented now)

- Add a simple CLI wrapper around `POST /api/tailor`.
- Switch the LLM provider later (OpenRouter makes this easy).
- Add PDF preview in the React UI if desired.

This is the complete, minimal architecture.