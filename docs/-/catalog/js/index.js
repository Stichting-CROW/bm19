import * as C from "catalog";

const STOPWORDS = new Set(
  (
    "aan als bij dan dat de deze die dit door een en er heb hebben het " +
    "hoe hun ik in is je kan kun kunnen me met mijn moet moeten mag naar " +
    "niet of om op over te tot uit van voor wat we welk welke wanneer " +
    "waar wij wil wordt zijn zo zou"
  ).split(" "),
);
const MIN_TOKEN_LENGTH = 3;
const TITLE_WEIGHT = 3;
const BODY_WEIGHT = 1;
const NUMBER = /^[0-9]+$/;

// Splits text into lowercase words. Hyphenated words are kept whole and
// also added as their separate parts.
function words(s) {
  const out = [];
  for (const raw of s.toLowerCase().split(/[^0-9a-z\u00c0-\u024f-]+/)) {
    const w = raw.replace(/^-+|-+$/g, "");
    if (!w) continue;
    out.push(w);
    if (w.includes("-")) out.push(...w.split("-").filter(Boolean));
  }
  return out;
}

// Words from the query that carry meaning: no stopwords, no short words
// except numbers.
function queryTokens(q) {
  return [...new Set(words(q))].filter(
    (w) =>
      !STOPWORDS.has(w) && (NUMBER.test(w) || w.length >= MIN_TOKEN_LENGTH),
  );
}

// A number must match a word exactly; other tokens match the start of a
// word.
function tokenMatches(token, recordWords) {
  const numeric = NUMBER.test(token);
  return recordWords.some((w) =>
    numeric ? w === token : w.startsWith(token),
  );
}

// A search result: a record with its words, split by title and body.
class Record {
  constructor(entry) {
    this.entry = entry;
    const node = entry.node;
    this.isProduct = C.isType(node, "Product");
    this.title = C.title(node);
    this.titleWords = words(this.title);
    const keywords = C.list(node.keywords).map(C.text).join(" ");
    const chapterWords = C.chapters(node).map((c) => `${c.label} ${c.keywords}`);
    this.words = words(
      [
        this.title,
        entry.source,
        C.text(node.publisher),
        C.fmtDate(node.datePublished),
        C.summary(node),
        C.text(node.url),
        keywords,
        ...chapterWords,
      ].join(" "),
    );
  }

  // A match in the title counts more than a match in the rest of the
  // record. 0 means no match.
  weight(token) {
    if (tokenMatches(token, this.titleWords)) return TITLE_WEIGHT;
    if (tokenMatches(token, this.words)) return BODY_WEIGHT;
    return 0;
  }

  // Sum of the weights of the tokens. A query with text words only counts
  // when at least one text word matches.
  score(tokens) {
    let total = 0;
    let textHits = 0;
    for (const t of tokens) {
      const w = this.weight(t);
      if (w) {
        total += w;
        if (!NUMBER.test(t)) textHits++;
      }
    }
    const hasTextToken = tokens.some((t) => !NUMBER.test(t));
    return hasTextToken && textHits === 0 ? 0 : total;
  }
}

// The words all titles start with, e.g. "HR-wand combiketel Kli-Max" for
// its tapklasse 3 and tapklasse 4 variants.
function commonTitle(titles) {
  let prefix = titles.reduce((p, t) => {
    let i = 0;
    while (i < p.length && i < t.length && p[i] === t[i]) i++;
    return p.slice(0, i);
  });
  const cutsWord = titles.some((t) => /[0-9a-z]/i.test(t.charAt(prefix.length)));
  if (cutsWord) prefix = prefix.replace(/[^\s/]*$/, "");
  prefix = prefix.replace(/[\s/-]+$/, "");
  return prefix || titles[0];
}

class CatalogSearch {
  constructor({ input, count, groups, list, status }) {
    this.input = input;
    this.countEl = count;
    this.groupsEl = groups;
    this.listEl = list;
    this.statusEl = status;
    this.records = [];
    this.concepts = []; // { label, triggers, terms }
    this.byId = {};
    input.addEventListener("input", () => this.apply());
  }

  async load() {
    const [sources, concepts] = await Promise.all([
      C.loadSources(),
      C.loadJson("data/concepts.json").catch((err) => {
        this.reportError("data/concepts.json", err);
        return [];
      }),
    ]);
    sources.errors.forEach((e) => this.reportError(e.url, e.error));
    this.byId = sources.byId;
    this.records = sources.nodes.map((entry) => new Record(entry));
    this.concepts = concepts;
    this.apply();
  }

  reportError(url, err) {
    this.statusEl.insertAdjacentHTML("beforeend", C.errorHtml(url, err));
  }

  apply() {
    const tokens = queryTokens(this.input.value);
    const groups = [];

    for (const concept of this.matchedConcepts(tokens)) {
      const hits = this.conceptHits(concept);
      if (hits.length) groups.push({ heading: concept.label, hits });
    }

    const products = this.bestProducts(tokens);
    if (products.length) {
      groups.push({
        heading: commonTitle(products.map((r) => r.title)),
        hits: products,
      });
    }

    if (groups.length) this.showGroups(groups);
    else this.showList(tokens);
  }

  matchedConcepts(tokens) {
    return this.concepts.filter((c) =>
      tokens.some((t) =>
        c.triggers.some((trigger) => t.startsWith(trigger.toLowerCase())),
      ),
    );
  }

  // The non-product sources about a concept, best matches first.
  conceptHits(concept) {
    const terms = concept.terms.map((t) => t.toLowerCase());
    return this.records
      .filter((r) => !r.isProduct)
      .map((r) => ({
        r,
        s: terms.reduce((sum, t) => sum + r.weight(t), 0),
      }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.r);
  }

  // The products that share the most query tokens with the query, shortest
  // title first.
  bestProducts(tokens) {
    let best = 0;
    let hits = [];
    for (const r of this.records) {
      if (!r.isProduct) continue;
      const s = r.score(tokens);
      if (s === 0) continue;
      if (s > best) {
        best = s;
        hits = [r];
      } else if (s === best) {
        hits.push(r);
      }
    }
    return hits.sort((a, b) => a.title.length - b.title.length);
  }

  card(r) {
    return C.card(r.entry, this.byId);
  }

  showGroups(groups) {
    let total = 0;
    this.groupsEl.innerHTML = groups
      .map(
        (g) => {
          total += g.hits.length;
          return `<section class="group">
            <h2>Over “${C.esc(g.heading)}” vind je informatie bij</h2>
            <ul class="cards">${g.hits.map((r) => this.card(r)).join("")}</ul>
          </section>`;
        },
      )
      .join("");
    this.groupsEl.hidden = false;
    this.listEl.hidden = true;
    this.countEl.textContent =
      `${total} ${total === 1 ? "bron" : "bronnen"} voor ` +
      `${groups.length} ${groups.length === 1 ? "onderwerp" : "onderwerpen"}`;
  }

  showList(tokens) {
    const shown = tokens.length
      ? this.records
          .map((r) => ({ r, s: r.score(tokens) }))
          .filter((x) => x.s > 0)
          .sort((a, b) => b.s - a.s)
          .map((x) => x.r)
      : this.records;
    this.listEl.innerHTML = shown.map((r) => this.card(r)).join("");
    this.groupsEl.hidden = true;
    this.listEl.hidden = this.records.length === 0;
    this.countEl.textContent = `${shown.length} van ${this.records.length} resultaten`;
  }
}

const search = new CatalogSearch({
  input: document.getElementById("search"),
  count: document.getElementById("count"),
  groups: document.getElementById("groups"),
  list: document.getElementById("list"),
  status: document.getElementById("status"),
});
search.load();
