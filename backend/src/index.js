import "dotenv/config";
import express from "express";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ExperienceStore } from "./experienceStore.js";
import { OpenRouterClient } from "./openRouter.js";
import { runReactTailor } from "./reactAgent.js";
import { compileLatex } from "./latexCompiler.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const app = express();
const port = Number(process.env.PORT || 3001);
const store = new ExperienceStore(join(root, "data", "experiences.json"));
const client = new OpenRouterClient({
  apiKey: process.env.OPENROUTER_API_KEY,
  model: process.env.OPENROUTER_MODEL,
  siteUrl: process.env.OPENROUTER_SITE_URL,
  appName: process.env.OPENROUTER_APP_NAME || "Job Hunt Agent"
});

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_request, response) => response.json({ ok: true }));
app.get("/api/experiences", async (_request, response, next) => {
  try { response.json(await store.list()); } catch (error) { next(error); }
});
app.get("/api/experiences/search", async (request, response, next) => {
  try { response.json(await store.search(String(request.query.q || ""), { includeLocked: true })); } catch (error) { next(error); }
});
app.post("/api/experiences", async (request, response, next) => {
  try { response.status(201).json(await store.add(normalizeExperience(request.body))); } catch (error) { next(error); }
});
app.put("/api/experiences/:id", async (request, response, next) => {
  try {
    const experience = await store.update(request.params.id, normalizeExperience(request.body));
    if (!experience) return response.status(404).json({ error: "Experience not found" });
    response.json(experience);
  } catch (error) { next(error); }
});
app.delete("/api/experiences/:id", async (request, response, next) => {
  try {
    if (!await store.remove(request.params.id)) return response.status(404).json({ error: "Experience not found" });
    response.status(204).end();
  } catch (error) { next(error); }
});

app.post("/api/tailor", async (request, response, next) => {
  try {
    const { jobDescription, company = "company", jobTitle = "role" } = request.body || {};
    if (typeof jobDescription !== "string" || !jobDescription.trim()) {
      return response.status(400).json({ error: "jobDescription is required" });
    }

    const outputDirectory = join(root, "generated", `${dateStamp()}_${slug(company)}_${slug(jobTitle)}`);
    const texPath = join(outputDirectory, "cv.tex");
    const result = await runReactTailor({
      client,
      store,
      jobDescription: jobDescription.trim(),
      templatePath: join(root, "docs", "main.tex")
    });
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(texPath, result.latex);
    const compilation = await compileLatex(texPath, outputDirectory);

    response.json({
      texPath: relativeToRoot(texPath),
      pdfPath: compilation.pdfPath ? relativeToRoot(compilation.pdfPath) : null,
      compiler: compilation.compiler,
      warning: compilation.warning || null,
      steps: result.steps,
      retrievedExperienceIds: result.editableExperiences.map((item) => item.id)
    });
  } catch (error) { next(error); }
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: error.message || "Internal server error" });
});

app.listen(port, () => console.log(`Job Hunt Agent backend listening on http://localhost:${port}`));

function normalizeExperience(input = {}) {
  return {
    type: String(input.type || "work"),
    title: String(input.title || ""),
    company: String(input.company || ""),
    start_date: String(input.start_date || ""),
    end_date: String(input.end_date || ""),
    description: Array.isArray(input.description) ? input.description.map(String) : [],
    skills: Array.isArray(input.skills) ? input.skills.map(String) : [],
    location: String(input.location || ""),
    locked: Boolean(input.locked)
  };
}

function slug(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "untitled";
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function relativeToRoot(filePath) {
  return filePath.slice(root.length + 1);
}
