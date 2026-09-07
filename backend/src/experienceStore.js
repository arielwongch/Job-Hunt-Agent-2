import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

const DEFAULT_STORE = {
  experiences: []
};

export class ExperienceStore {
  constructor(filePath) {
    this.filePath = filePath;
  }

  async read() {
    try {
      return JSON.parse(await readFile(this.filePath, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      await this.write(DEFAULT_STORE);
      return structuredClone(DEFAULT_STORE);
    }
  }

  async write(value) {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(value, null, 2)}\n`);
  }

  async list() {
    const store = await this.read();
    return store.experiences;
  }

  async add(input) {
    const store = await this.read();
    const experience = { id: randomUUID(), locked: false, ...input };
    store.experiences.push(experience);
    await this.write(store);
    return experience;
  }

  async update(id, input) {
    const store = await this.read();
    const index = store.experiences.findIndex((item) => item.id === id);
    if (index === -1) return null;
    store.experiences[index] = { ...store.experiences[index], ...input, id };
    await this.write(store);
    return store.experiences[index];
  }

  async remove(id) {
    const store = await this.read();
    const next = store.experiences.filter((item) => item.id !== id);
    if (next.length === store.experiences.length) return false;
    await this.write({ experiences: next });
    return true;
  }

  async search(query, { includeLocked = true, limit = 12 } = {}) {
    const normalizedQuery = query.toLowerCase();
    const terms = normalizedQuery.split(/\W+/).filter(Boolean);
    const records = (await this.list()).filter((item) => includeLocked || !item.locked);

    return records
      .map((item) => {
        const haystack = [item.type, item.title, item.company, item.description, item.skills, item.location]
          .flat()
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
        return { ...item, score };
      })
      .filter((item) => item.score > 0 || terms.length === 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ score, ...item }) => item);
  }
}
