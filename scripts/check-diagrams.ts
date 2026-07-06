// Render-check every Mermaid block in documentation/architecture-diagrams/.
//
// A broken Mermaid block does not fail anything by itself — GitHub just shows
// an error box where the diagram should be. This script extracts each
// ```mermaid block and renders it with mmdr
// (https://github.com/1jehuang/mermaid-rs-renderer), failing loudly with the
// file and block number when one stops rendering.
//
// Known limitation: mmdr's Rust parser is fast but more lenient than
// mermaid.js (what GitHub runs) in places — e.g. a ";" inside a
// sequence-diagram note renders fine here but errors on GitHub. This check
// catches structural breakage (garbage, unknown diagram types, dangling
// edges) and render regressions, not every GitHub-side parse error.
//
// Usage: npx ts-node scripts/check-diagrams.ts   (or `make diagrams`)
// Requires mmdr on PATH: cargo install mermaid-rs-renderer --locked
import { execFileSync } from "child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const DIAGRAMS_DIR = join(process.cwd(), "documentation", "architecture-diagrams");
const MERMAID_BLOCK = /```mermaid\n([\s\S]*?)```/g;

interface DiagramBlock {
  file: string;
  index: number;
  source: string;
}

function collectBlocks(): DiagramBlock[] {
  const markdownFiles = readdirSync(DIAGRAMS_DIR)
    .filter((file) => file.endsWith(".md"))
    .sort();

  const blocks: DiagramBlock[] = [];
  for (const file of markdownFiles) {
    const text = readFileSync(join(DIAGRAMS_DIR, file), "utf8");
    let index = 0;
    for (const match of text.matchAll(MERMAID_BLOCK)) {
      index += 1;
      blocks.push({ file, index, source: match[1] });
    }
  }
  return blocks;
}

function describeFailure(error: unknown): string {
  if (typeof error === "object" && error !== null && "stderr" in error) {
    const stderr = String(error.stderr).trim();
    if (stderr) return stderr;
  }
  return String(error);
}

/** Returns null on success, or the render error text. */
function renderBlock(workDir: string, block: DiagramBlock): string | null {
  const inputPath = join(workDir, `${block.file}.${block.index}.mmd`);
  const outputPath = join(workDir, `${block.file}.${block.index}.svg`);
  writeFileSync(inputPath, block.source);

  try {
    execFileSync("mmdr", ["-i", inputPath, "-o", outputPath, "-e", "svg"], {
      stdio: "pipe",
    });
  } catch (error) {
    return describeFailure(error);
  }

  // Belt and braces: a renderer that exits 0 without producing output is
  // still a failure.
  if (!existsSync(outputPath)) return "mmdr exited 0 but produced no output";
  return null;
}

function main(): void {
  const blocks = collectBlocks();
  if (blocks.length === 0) {
    throw new Error(`No Mermaid blocks found under ${DIAGRAMS_DIR} — glob broken?`);
  }

  const workDir = mkdtempSync(join(tmpdir(), "mmdr-check-"));
  const failures: string[] = [];
  try {
    for (const block of blocks) {
      const failure = renderBlock(workDir, block);
      if (failure === null) {
        console.log(`ok   ${block.file} block ${block.index}`);
      } else {
        failures.push(`${block.file} block ${block.index}`);
        console.error(`FAIL ${block.file} block ${block.index}\n${failure}`);
      }
    }
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} of ${blocks.length} Mermaid block(s) failed to render:`);
    failures.forEach((failure) => console.error(`  - ${failure}`));
    process.exit(1);
  }
  console.log(`All ${blocks.length} Mermaid blocks render.`);
}

if (require.main === module) {
  main();
}
