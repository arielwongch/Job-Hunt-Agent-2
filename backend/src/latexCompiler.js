import { access, mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dirname, join } from "node:path";

const execFileAsync = promisify(execFile);

export async function compileLatex(texPath, outputDirectory) {
  const compiler = await findCompiler();
  if (!compiler) return { pdfPath: null, compiler: null, warning: "No pdflatex or xelatex executable is installed" };

  await mkdir(outputDirectory, { recursive: true });
  try {
    await execFileAsync(compiler, ["-interaction=nonstopmode", "-halt-on-error", "-output-directory", outputDirectory, texPath], { maxBuffer: 1024 * 1024 });
    return { pdfPath: join(outputDirectory, `${texPath.split("/").pop().replace(/\.tex$/, ".pdf")}`), compiler };
  } catch (error) {
    const detail = `${error.stdout || ""}\n${error.stderr || ""}`.trim();
    throw new Error(`LaTeX compilation failed${detail ? `: ${detail.slice(-1200)}` : ""}`);
  }
}

async function findCompiler() {
  for (const candidate of ["pdflatex", "xelatex"]) {
    try {
      await execFileAsync("which", [candidate]);
      return candidate;
    } catch {
      // Try the next installed compiler.
    }
  }
  return null;
}
