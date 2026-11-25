// Builds docs/-/catalog/data/similar.json: for every catalog entry, up to
// MAX_NEIGHBOURS entries from any source whose Dutch name, keywords and
// abstract are semantically close. Entries below MIN_SCORE are left out, so
// an entry without close neighbours gets an empty list.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { pipeline } from "@huggingface/transformers";

const MODEL = process.env.SIMILAR_MODEL ?? "Xenova/multilingual-e5-base";
const MAX_NEIGHBOURS = 25;
// Pair scores of e5 models sit in a narrow band (median about 0.83), so the
// thresholds are close to the top of that band. Same-source neighbours need a
// high score. Other sources get a lower floor, because the sources barely use
// the same vocabulary, and at most MAX_CROSS_SOURCE of the list come from them.
const MIN_SCORE = Number(process.env.SIMILAR_MIN_SCORE ?? 0.88);
const MIN_CROSS_SOURCE_SCORE = Number(process.env.SIMILAR_CROSS_MIN_SCORE ?? 0.84);
const MAX_CROSS_SOURCE = Number(process.env.SIMILAR_MAX_CROSS ?? 5);
const BATCH_SIZE = 16;

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, "../../docs/-/catalog/data");
const outFile = join(dataDir, "similar.json");

// Same files and sources as the endpoints in docs/-/catalog/js/sources.js.
const sources = [
  { file: "crow.json", source: "CROW" },
  { file: "bouwzo.json", source: "BouwZo" },
  { file: "fgoplus.json", source: "FGOPlus" },
];

// Mirrors Catalog.text in js/sources.js: strings, arrays and language-tagged
// values all become plain text.
function text(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(", ");
  if (typeof value === "object") {
    if (value["@value"] != null) return String(value["@value"]);
    if (value.name != null) return text(value.name);
    if (value["@id"] != null) return String(value["@id"]);
    if (value.id != null) return String(value.id);
  }
  return String(value);
}

const sourceByNode = new WeakMap();
function sourceOf(node) {
  return sourceByNode.get(node);
}

async function loadNodes() {
  const nodes = [];
  for (const { file, source } of sources) {
    const data = JSON.parse(await readFile(join(dataDir, file), "utf8"));
    for (const node of Array.isArray(data["@graph"]) ? data["@graph"] : [data]) {
      sourceByNode.set(node, source);
      nodes.push(node);
    }
  }
  const seen = new Set();
  return nodes.filter((node) => {
    const id = text(node.id);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

// Name, keywords and abstract, as one Dutch passage. The e5 models expect a
// "query: " prefix for symmetric similarity.
function documentText(node) {
  const parts = [text(node.name), text(node.keywords), text(node.abstract)];
  const body = parts.map((p) => p.trim()).filter(Boolean).join("\n");
  return body ? `query: ${body}` : "";
}

async function embed(extractor, texts) {
  const vectors = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const output = await extractor(texts.slice(i, i + BATCH_SIZE), {
      pooling: "mean",
      normalize: true,
    });
    vectors.push(...output.tolist());
  }
  return vectors;
}

// Vectors are normalised, so the dot product is the cosine similarity.
function dot(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

async function main() {
  const nodes = await loadNodes();
  const indexed = nodes
    .map((node) => ({ id: text(node.id), source: sourceOf(node), text: documentText(node) }))
    .filter((d) => d.text);
  console.log(`Embedding ${indexed.length} of ${nodes.length} entries with ${MODEL}`);

  const extractor = await pipeline("feature-extraction", MODEL);
  const vectors = await embed(
    extractor,
    indexed.map((d) => d.text),
  );

  const similar = {};
  const allScores = [];
  let crossCount = 0;
  indexed.forEach((doc, i) => {
    const same = [];
    const cross = [];
    indexed.forEach((other, j) => {
      if (i === j) return;
      const score = dot(vectors[i], vectors[j]);
      allScores.push(score);
      const entry = { id: other.id, score: round(score), source: other.source };
      if (other.source === doc.source) {
        if (score >= MIN_SCORE) same.push(entry);
      } else if (score >= MIN_CROSS_SOURCE_SCORE) {
        cross.push(entry);
      }
    });
    const byScore = (a, b) => b.score - a.score;
    same.sort(byScore);
    cross.sort(byScore);
    // Cross-source picks first, so they always get room; the rest of the list
    // is filled with the best same-source matches.
    const crossPicks = cross.slice(0, MAX_CROSS_SOURCE);
    const samePicks = same.slice(0, MAX_NEIGHBOURS - crossPicks.length);
    const picks = [...crossPicks, ...samePicks].sort(byScore);
    crossCount += crossPicks.length;
    similar[doc.id] = picks.map(({ id, score }) => ({ id, score }));
  });

  const output = {
    model: MODEL,
    minScore: MIN_SCORE,
    minCrossSourceScore: MIN_CROSS_SOURCE_SCORE,
    maxCrossSource: MAX_CROSS_SOURCE,
    maxNeighbours: MAX_NEIGHBOURS,
    similar,
  };
  await writeFile(outFile, JSON.stringify(output, null, 2) + "\n");

  const withNone = Object.values(similar).filter((list) => list.length === 0).length;
  console.log(`Wrote ${outFile}`);
  console.log(`Entries without neighbours: ${withNone} of ${indexed.length}`);
  console.log(`Average cross-source neighbours: ${(crossCount / indexed.length).toFixed(2)}`);
  printDistribution(allScores);
}

function round(n) {
  return Math.round(n * 1000) / 1000;
}

function printDistribution(scores) {
  const sorted = [...scores].sort((a, b) => a - b);
  const pct = (p) => round(sorted[Math.floor((sorted.length - 1) * p)]);
  console.log(
    `Pair scores p50=${pct(0.5)} p90=${pct(0.9)} p99=${pct(0.99)} max=${pct(1)} (threshold ${MIN_SCORE})`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
