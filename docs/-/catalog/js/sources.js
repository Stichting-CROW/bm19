// Loads the JSON-LD sources of the catalog and offers helpers to read and
// render their nodes. Used by the catalog page and the detail page.

// Each file may be a single node or an object with an "@graph" array of
// nodes.
const endpoints = [
  { url: "data/crow.json", source: "CROW" },
  { url: "data/bouwzo.json", source: "BouwZo" },
  { url: "data/fgoplus.json", source: "FGOPlus" },
  { url: "data/nen.json", source: "NEN" },
];

// Written by tools/similar; maps each id to its most similar entries.
const similarUrl = "data/similar.json";

export function text(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(", ");
  if (typeof value === "object") {
    // Language-tagged string: { "@language": "nl", "@value": "…" }
    if (value["@value"] != null) return String(value["@value"]);
    if (value.name != null) return text(value.name);
    if (value["@id"] != null) return String(value["@id"]);
    if (value.id != null) return String(value.id);
    return JSON.stringify(value);
  }
  return String(value);
}

export function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function list(value) {
  return value == null ? [] : [].concat(value);
}

export function isType(node, type) {
  return list(node.type).some((t) => text(t) === type);
}

export function title(node) {
  return text(node.name) || text(node.alternateName) || "(zonder titel)";
}

export function detailUrl(node) {
  return `detail.html?id=${encodeURIComponent(text(node.id))}`;
}

export function fmtDate(value) {
  const s = text(value);
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(d)) return s;
  return d.toLocaleDateString("nl-NL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// The amount of an offer, e.g. "€ 96,59 per jaar" or "Gratis". The price
// may be on the offer itself or in its priceSpecification.
export function fmtAmount(offer) {
  const spec = offer.priceSpecification || {};
  const price = text(spec.price != null ? spec.price : offer.price);
  if (price === "") return "";
  const currency = text(spec.priceCurrency || offer.priceCurrency) || "EUR";
  const n = Number(price);
  if (n === 0) return "Gratis";
  if (isNaN(n)) return `${price} ${currency}`;
  const unit = spec.referenceQuantity
    ? text(spec.referenceQuantity.unitText)
    : "";
  const amount = n.toLocaleString("nl-NL", { style: "currency", currency });
  return unit ? `${amount} per ${unit}` : amount;
}

// E.g. "€ 96,59 per jaar (Leden Techniek Nederland)".
export function fmtPrice(offer) {
  const amount = fmtAmount(offer);
  if (!amount) return "";
  const label = text(offer.description) || text(offer.name);
  return label ? `${amount} (${label})` : amount;
}

// One line of a product's specifications, e.g. brand, model and GTIN.
export function productSummary(node) {
  return [
    text(node.brand),
    text(node.model),
    node.mpn ? `art.nr. ${text(node.mpn)}` : "",
    node.gtin ? `GTIN ${text(node.gtin)}` : "",
    text(node.category),
  ]
    .filter(Boolean)
    .join(" · ");
}

export function summary(node) {
  return isType(node, "Product")
    ? productSummary(node)
    : text(node.abstract) || text(node.description);
}

// Chapters of a publication, from schema:hasPart. A chapter shows as
// "4.2.2 Name", or "Hoofdstuk 4.2.2" when it has no name.
export function chapters(node) {
  return list(node.hasPart)
    .filter((part) => part && typeof part === "object")
    .map((part) => {
      const position = text(part.position);
      const name = text(part.name);
      const label = name
        ? `${position ? `${position} ` : ""}${name}`
        : `Hoofdstuk${position ? ` ${position}` : ""}`;
      return {
        label,
        url: text(part.url) || text(part.id),
        keywords: list(part.keywords).map(text).join(" "),
      };
    });
}

function chapterLinks(items) {
  const lis = items.map((c) => {
    const label = esc(c.label);
    return `<li>${
      c.url
        ? `<a href="${esc(c.url)}" target="_blank" rel="noopener">${label}</a>`
        : label
    }</li>`;
  });
  return `<ul class="chapters">${lis.join("")}</ul>`;
}

// The entries of the nodes a property refers to, e.g. isRelatedTo. A
// reference is an object with only an id; unknown ids are skipped.
export function refs(byId, value) {
  return list(value)
    .map((ref) => {
      const id = typeof ref === "string" ? ref : text(ref.id || ref["@id"]);
      return byId[id] || (typeof ref === "object" && ref.type ? ref : null);
    })
    .filter(Boolean)
    .map((entry) => (entry.node ? entry : { node: entry, source: "" }));
}

// The work that gives access to an entry: the entry itself when it has
// offers or a license page, otherwise the first work about it from the
// same source, e.g. the FGOPlus dataset for an FGOPlus product.
export function accessWork(entry, byId) {
  const node = entry.node;
  if (node.offers || node.acquireLicensePage || node.license) return entry;
  return (
    refs(byId, node.isRelatedTo).find((e) => e.source === entry.source) || null
  );
}

// The entries most similar to an entry, from any source, as computed by
// scripts in tools/similar. Entries without a close match have no list.
export function relatedWorks(entry, byId, similar) {
  const ids = similar?.[text(entry.node.id)] || [];
  return ids.map((n) => byId[n.id]).filter(Boolean);
}

// The ids a node points to with a property, e.g. isRelatedTo.
function refIds(value) {
  return list(value)
    .map((ref) => (typeof ref === "string" ? ref : text(ref.id || ref["@id"])))
    .filter(Boolean);
}

// Which entries each entry refers to, as { id: [id, ...] }. isRelatedTo is
// symmetric: when A relates to B, B also refers to A. mentions and citation
// are one-way. Only the data files are read; no reverse edge is written.
function buildReferences(nodes) {
  const refs = {};
  const add = (from, to) => {
    if (!from || !to || from === to) return;
    refs[from] = refs[from] || [];
    if (!refs[from].includes(to)) refs[from].push(to);
  };
  for (const entry of nodes) {
    const id = text(entry.node.id);
    for (const to of refIds(entry.node.isRelatedTo)) {
      add(id, to);
      add(to, id);
    }
    for (const to of refIds(entry.node.mentions)) {
      add(id, to);
      add(to, id);
    }
    for (const to of refIds(entry.node.citation)) {
      add(id, to);
      add(to, id);
    }
  }
  return refs;
}

// The works an entry refers to, from any source. The access work is left
// out, because it is shown in the access section.
export function referencesOf(entry, byId, references) {
  const access = accessWork(entry, byId);
  const ids = references?.[text(entry.node.id)] || [];
  return ids
    .map((id) => byId[id])
    .filter((e) => e && (!access || e.node !== access.node));
}

// Cost and license as HTML, from schema.org offers, license and
// acquireLicensePage. Offers on a dataset are shown as a license on it,
// e.g. "Licentie op FGOPlus".
export function costLicense(entry, byId) {
  const unknown = '<span class="unknown">Niet opgegeven door de bron</span>';
  const work = accessWork(entry, byId);
  if (!work) return unknown;
  const node = work.node;
  const parts = [];
  const prices = list(node.offers).map(fmtPrice).filter(Boolean);
  if (prices.length) {
    const licenseOn = isType(node, "Dataset")
      ? `<span class="offer-item">Licentie op ${esc(title(node))}</span><br />`
      : "";
    parts.push(licenseOn + prices.map(esc).join("<br />"));
  }
  const license = text(node.license);
  if (license) {
    parts.push(
      /^https?:\/\//.test(license)
        ? `<a href="${esc(license)}" target="_blank" rel="noopener">licentie</a>`
        : esc(license),
    );
  }
  if (!prices.length) {
    for (const page of list(node.acquireLicensePage)) {
      const href = text(page);
      if (href) {
        parts.push(
          `<a href="${esc(href)}" target="_blank" rel="noopener">licentie verkrijgen</a>`,
        );
      }
    }
  }
  return parts.length ? parts.join(" · ") : unknown;
}

// A result card. The title links to the detail page.
export function card(entry, byId) {
  const node = entry.node;
  const url = text(node.url);
  const date = fmtDate(node.datePublished);
  const sum = summary(node);
  const parts = chapters(node);
  return `<li class="card">
    <span class="badge">${esc(entry.source)}</span>
    <h3 class="card-title"><a href="${esc(detailUrl(node))}">${esc(title(node))}</a></h3>
    ${sum ? `<p class="card-summary">${esc(sum)}</p>` : ""}
    ${parts.length ? `<p class="chapters-label">Direct naar</p>${chapterLinks(parts)}` : ""}
    <dl class="card-meta">
      ${date ? `<div><dt>Datum</dt><dd>${esc(date)}</dd></div>` : ""}
      <div><dt>Kosten/licentie</dt><dd>${costLicense(entry, byId)}</dd></div>
    </dl>
    <p class="card-links"><a href="${esc(detailUrl(node))}">Details</a>${
      url
        ? `<a href="${esc(url)}" target="_blank" rel="noopener">Naar de bron ↗</a>`
        : '<span class="unknown">Geen bronlink</span>'
    }</p>
  </li>`;
}

export async function loadJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Resolves to { nodes: [{ node, source }], byId: { id: { node, source } },
// similar: { id: [{ id, score }] }, references: { id: [id] },
// errors: [{ url, error }] }. A failing file is reported but doesn't block
// the others.
export async function loadSources() {
  const errors = [];
  async function optional(url, pick) {
    try {
      return pick(await loadJson(url));
    } catch (error) {
      errors.push({ url, error });
      return pick(null);
    }
  }

  const similarFile = optional(similarUrl, (data) =>
    data ? data.similar || {} : {},
  );
  const sourceFiles = Promise.all(
    endpoints.map((ep) =>
      optional(ep.url, (data) => {
        if (!data) return [];
        const nodes = Array.isArray(data["@graph"]) ? data["@graph"] : [data];
        return nodes.map((node) => ({ node, source: ep.source }));
      }),
    ),
  );
  const [sourceLists, similar] = await Promise.all([sourceFiles, similarFile]);

  const nodes = sourceLists.flat();
  const byId = {};
  for (const entry of nodes) {
    const id = text(entry.node.id);
    if (id) byId[id] = entry;
  }
  return {
    nodes,
    byId,
    similar,
    references: buildReferences(nodes),
    errors,
  };
}

export function errorHtml(url, err) {
  return `<p class="error">Kon <code>${esc(url)}</code> niet laden: ${esc(err.message)}.</p>`;
}
