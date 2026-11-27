import * as C from "catalog";

const { esc, text } = C;

function externalLink(href, label, cls) {
  return `<a class="${cls}" href="${esc(href)}" target="_blank" rel="noopener">${esc(label)} ↗</a>`;
}

function publisherName(entry) {
  return text(entry.node.publisher) || entry.source;
}

function memberProgram(offer) {
  const spec = offer.priceSpecification || {};
  const tier = spec.validForMemberTier || offer.validForMemberTier;
  return tier ? tier.isTierOf || tier : null;
}

class DetailPage {
  constructor(result, id) {
    this.result = result;
    this.entry = result.byId[id];
    this.work = this.entry ? C.accessWork(this.entry, result.byId) : null;
  }

  render(detailEl) {
    if (!this.entry) {
      detailEl.innerHTML = `<section class="panel"><h1>Niet gevonden</h1>
        <p>Dit item staat niet in de catalogus.</p></section>`;
      return;
    }
    document.title = `${C.title(this.entry.node)} — BM19 Proof of Concept`;
    detailEl.innerHTML =
      this.header() +
      this.about(this.work || this.entry) +
      this.access() +
      this.related();
  }

  header() {
    const node = this.entry.node;
    const facts = C.isType(node, "Product")
      ? C.productSummary(node)
      : [text(node.publisher), C.fmtDate(node.datePublished)]
          .filter(Boolean)
          .join(" · ");
    return `<section class="panel detail-head">
      <span class="badge">${esc(this.entry.source)}</span>
      <h1>${esc(C.title(node))}</h1>
      ${facts ? `<p class="facts">${esc(facts)}</p>` : ""}
    </section>`;
  }

  // General information about the work the entry belongs to, e.g. what
  // FGOPlus is for an FGOPlus product.
  about(work) {
    const node = work.node;
    const subtitle = text(node.alternateName);
    const intro = text(node.disambiguatingDescription);
    const abstract = text(node.abstract) || text(node.description);
    if (!subtitle && !intro && !abstract) return "";
    return `<section class="panel">
      <h2>Over ${esc(C.title(node))}</h2>
      ${subtitle ? `<p class="subtitle">${esc(subtitle)}</p>` : ""}
      ${intro ? `<p class="intro">${esc(intro)}</p>` : ""}
      ${abstract ? `<p>${esc(abstract)}</p>` : ""}
      ${node.publisher ? `<p class="publisher">Uitgegeven door ${esc(text(node.publisher))}</p>` : ""}
    </section>`;
  }

  // One row per offer: who it is for, what it costs and what to do.
  offerRow(offer, anyMembers) {
    const work = this.work;
    const name = C.title(work.node);
    const amount = C.fmtAmount(offer);
    const label = text(offer.description) || text(offer.name) || "Prijs";
    const program = memberProgram(offer);
    let body = "";
    if (program) {
      const host = text(program.hostingOrganization) || publisherName(work);
      body =
        `Word lid van ${esc(host)} en neem daarna een abonnement op ${esc(name)}.` +
        (program.url
          ? ` ${externalLink(text(program.url), "Lid worden", "inline")}`
          : "");
    } else if (anyMembers) {
      body = `Ook zonder lidmaatschap kun je een abonnement op ${esc(name)} nemen.`;
    }
    return `<li><strong>${esc(label)}${amount ? `: ${esc(amount)}` : ""}</strong>${
      body ? `<span>${body}</span>` : ""
    }</li>`;
  }

  // How to get the data: the offers of the work and a call to action to the
  // page of the source where access is arranged and paid for.
  access() {
    const entry = this.entry;
    const node = this.work ? this.work.node : entry.node;
    const offers = C.list(node.offers);
    const anyMembers = offers.some(memberProgram);
    const subscription = offers.some(
      (o) => (o.priceSpecification || {}).referenceQuantity,
    );
    const publisher =
      this.work && text(node.acquireLicensePage)
        ? publisherName(this.work)
        : entry.source;
    const ctaHref =
      text(node.acquireLicensePage) ||
      offers.map((o) => text(o.url)).find(Boolean) ||
      text(entry.node.url);
    const ctaLabel = subscription
      ? `Abonnement aanvragen bij ${publisher}`
      : `Naar de bron bij ${publisher}`;
    const sourceUrl = text(entry.node.url);

    const rows = offers.map((o) => this.offerRow(o, anyMembers));
    if (!rows.length) {
      rows.push(
        text(node.acquireLicensePage)
          ? `<li><strong>Kosten en licentie bij de bron</strong>
              <span>De bron vermeldt geen prijs. Op de licentiepagina lees je hoe je toegang krijgt.</span></li>`
          : `<li><strong>Kosten en licentie niet opgegeven</strong>
              <span>De bron vermeldt geen kosten of licentievoorwaarden. Kijk bij de bron hoe je toegang krijgt.</span></li>`,
      );
    }
    rows.push(
      `<li><strong>Aanvragen en betalen gaat via ${esc(publisher)}</strong>
        <span>Deze catalogus verkoopt niets; de licentie en de klantrelatie liggen bij de bronhouder.</span></li>`,
    );

    return `<section class="access">
      <h2>Zo krijg je toegang</h2>
      <ul class="access-rows">${rows.join("")}</ul>
      <p class="actions">
        ${ctaHref ? externalLink(ctaHref, ctaLabel, "button button-primary") : '<span class="unknown">Geen bronlink</span>'}
        ${
          sourceUrl && sourceUrl !== ctaHref
            ? externalLink(
                sourceUrl,
                `Lees direct bij ${entry.source}`,
                "button button-secondary",
              )
            : ""
        }
      </p>
    </section>`;
  }

  // A section of cards. Empty when there are no works.
  cardSection(cls, heading, lead, works) {
    if (!works.length) return "";
    return `<section class="${cls}">
      <h2>${heading}</h2>
      <p class="related-lead">${lead}</p>
      <ul class="cards cards-grid">${works.map((w) => C.card(w, this.result.byId)).join("")}</ul>
    </section>`;
  }

  // Works this entry refers to (isRelatedTo, mentions, citation), then the
  // similar publications that are not already listed there.
  related() {
    const { entry, work, result } = this;
    const title = esc(C.title(entry.node));
    const refersTo = C.referencesOf(entry, result.byId, result.references);
    const seen = new Set(refersTo.map((w) => text(w.node.id)));
    const similar = C.relatedWorks(entry, result.byId, result.similar).filter(
      (w) => !seen.has(text(w.node.id)) && (!work || w.node !== work.node),
    );
    return (
      this.cardSection(
        "related refers",
        "Referenties",
        `Werken waar <cite>${title}</cite> naar verwijst of omgekeerd, die naar <cite>${title}</cite> verwijzen.`,
        refersTo,
      ) +
      this.cardSection(
        "related",
        "Ook relevant",
        `Vergelijkbare publicaties bij <cite>${title}</cite>.`,
        similar,
      )
    );
  }
}

const statusEl = document.getElementById("status");
const detailEl = document.getElementById("detail");
const id = new URLSearchParams(location.search).get("id");

const result = await C.loadSources();
result.errors.forEach((e) =>
  statusEl.insertAdjacentHTML("beforeend", C.errorHtml(e.url, e.error)),
);
new DetailPage(result, id).render(detailEl);
