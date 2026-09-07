# Job Hunt Agent

The backend exposes the ReAct CV tailoring flow described in [ARCHITECTURE.md](ARCHITECTURE.md).

## Run the backend

```bash
cd backend
npm install
cp ../.env.example .env
# Set OPENROUTER_API_KEY in .env
npm start
```

The service listens on `http://localhost:3001` by default.

## Tailor a CV

Add experiences through `POST /api/experiences`, then call:

```bash
curl -X POST http://localhost:3001/api/tailor \
	-H 'content-type: application/json' \
	-d '{"company":"Example","jobTitle":"Software Engineer","jobDescription":"Build APIs with Node.js and PostgreSQL..."}'
```

The agent retrieves relevant unlocked experiences, preserves locked records, may search the web through DuckDuckGo, and writes the result to `generated/<date>_<company>_<role>/cv.tex`. A PDF is also produced when `pdflatex` or `xelatex` is installed.