(function () {
  "use strict";

  var C = Catalog;
  var esc = C.esc;
  var text = C.text;
  var statusEl = document.getElementById("status");
  var detailEl = document.getElementById("detail");
  var id = new URLSearchParams(location.search).get("id");

  function externalLink(href, label, cls) {
    return (
      '<a class="' +
      cls +
      '" href="' +
      esc(href) +
      '" target="_blank" rel="noopener">' +
      esc(label) +
      " ↗</a>"
    );
  }

  function publisherName(entry) {
    return text(entry.node.publisher) || entry.source;
  }

  function header(entry) {
    var node = entry.node;
    var isProduct = C.isType(node, "Product");
    var date = C.fmtDate(node.datePublished);
    var facts = isProduct
      ? C.productSummary(node)
      : [text(node.publisher), date].filter(Boolean).join(" · ");
    return (
      '<section class="panel detail-head">' +
      '<span class="badge">' +
      esc(entry.source) +
      "</span>" +
      "<h1>" +
      esc(C.title(node)) +
      "</h1>" +
      (facts ? '<p class="facts">' + esc(facts) + "</p>" : "") +
      "</section>"
    );
  }

  // General information about the work the entry belongs to, e.g. what
  // FGOPlus is for an FGOPlus product.
  function about(work) {
    var node = work.node;
    var name = C.title(node);
    var subtitle = text(node.alternateName);
    var intro = text(node.disambiguatingDescription);
    var abstract = text(node.abstract) || text(node.description);
    if (!subtitle && !intro && !abstract) return "";
    return (
      '<section class="panel">' +
      "<h2>Over " +
      esc(name) +
      "</h2>" +
      (subtitle ? '<p class="subtitle">' + esc(subtitle) + "</p>" : "") +
      (intro ? '<p class="intro">' + esc(intro) + "</p>" : "") +
      (abstract ? "<p>" + esc(abstract) + "</p>" : "") +
      (node.publisher
        ? '<p class="publisher">Uitgegeven door ' +
          esc(text(node.publisher)) +
          "</p>"
        : "") +
      "</section>"
    );
  }

  function memberProgram(offer) {
    var spec = offer.priceSpecification || {};
    var tier = spec.validForMemberTier || offer.validForMemberTier;
    return tier ? tier.isTierOf || tier : null;
  }

  // One row per offer: who it is for, what it costs and what to do.
  function offerRow(offer, work, anyMembers) {
    var name = C.title(work.node);
    var amount = C.fmtAmount(offer);
    var label = text(offer.description) || text(offer.name) || "Prijs";
    var program = memberProgram(offer);
    var host = program
      ? text(program.hostingOrganization) || publisherName(work)
      : "";
    var body = program
      ? "Word lid van " +
        esc(host) +
        " en neem daarna een abonnement op " +
        esc(name) +
        "." +
        (program.url
          ? " " + externalLink(text(program.url), "Lid worden", "inline")
          : "")
      : anyMembers
        ? "Ook zonder lidmaatschap kun je een abonnement op " +
          esc(name) +
          " nemen."
        : "";
    return (
      "<li><strong>" +
      esc(label) +
      (amount ? ": " + esc(amount) : "") +
      "</strong>" +
      (body ? "<span>" + body + "</span>" : "") +
      "</li>"
    );
  }

  // How to get the data: the offers of the work and a call to action
  // to the page of the source where access is arranged and paid for.
  function access(entry, work) {
    var node = work ? work.node : entry.node;
    var offers = C.list(node.offers);
    var anyMembers = offers.some(memberProgram);
    var subscription = offers.some(function (o) {
      return (o.priceSpecification || {}).referenceQuantity;
    });
    var publisher =
      work && text(node.acquireLicensePage)
        ? publisherName(work)
        : entry.source;
    var ctaHref =
      text(node.acquireLicensePage) ||
      offers
        .map(function (o) {
          return text(o.url);
        })
        .filter(Boolean)[0] ||
      text(entry.node.url);
    var ctaLabel = subscription
      ? "Abonnement aanvragen bij " + publisher
      : "Naar de bron bij " + publisher;
    var sourceUrl = text(entry.node.url);

    var rows = offers.map(function (o) {
      return offerRow(o, work, anyMembers);
    });
    if (!rows.length) {
      rows.push(
        text(node.acquireLicensePage)
          ? "<li><strong>Kosten en licentie bij de bron</strong>" +
              "<span>De bron vermeldt geen prijs. Op de licentiepagina " +
              "lees je hoe je toegang krijgt.</span></li>"
          : "<li><strong>Kosten en licentie niet opgegeven</strong>" +
              "<span>De bron vermeldt geen kosten of " +
              "licentievoorwaarden. Kijk bij de bron hoe je toegang " +
              "krijgt.</span></li>",
      );
    }
    rows.push(
      "<li><strong>Aanvragen en betalen gaat via " +
        esc(publisher) +
        "</strong><span>Deze catalogus verkoopt niets; de licentie en " +
        "de klantrelatie liggen bij de bronhouder.</span></li>",
    );

    return (
      '<section class="access">' +
      "<h2>Zo krijg je toegang</h2>" +
      '<ul class="access-rows">' +
      rows.join("") +
      "</ul>" +
      '<p class="actions">' +
      (ctaHref
        ? externalLink(ctaHref, ctaLabel, "button button-primary")
        : '<span class="unknown">Geen bronlink</span>') +
      (sourceUrl && sourceUrl !== ctaHref
        ? externalLink(
            sourceUrl,
            "Lees direct bij " + entry.source,
            "button button-secondary",
          )
        : "") +
      "</p>" +
      "</section>"
    );
  }

  // A section of cards. Empty when there are no works.
  function cardSection(cls, heading, lead, works, byId) {
    if (!works.length) return "";
    return (
      '<section class="' +
      cls +
      '">' +
      "<h2>" +
      heading +
      "</h2>" +
      '<p class="related-lead">' +
      lead +
      "</p>" +
      '<ul class="cards cards-grid">' +
      works
        .map(function (w) {
          return C.card(w, byId);
        })
        .join("") +
      "</ul>" +
      "</section>"
    );
  }

  // Works this entry refers to (isRelatedTo, mentions, citation), then
  // the similar publications that are not already listed there.
  function related(entry, result) {
    var access = C.accessWork(entry, result.byId);
    var refersTo = C.referencesOf(entry, result.byId, result.references);
    var seen = {};
    refersTo.forEach(function (w) {
      seen[text(w.node.id)] = true;
    });
    var similar = C.relatedWorks(
      entry,
      result.byId,
      result.similar,
    ).filter(function (w) {
      return !seen[text(w.node.id)] && (!access || w.node !== access.node);
    });
    return (
      cardSection(
        "related refers",
        "Referereert aan",
        "Werken waar " + esc(C.title(entry.node)) + " naar verwijst.",
        refersTo,
        result.byId,
      ) +
      cardSection(
        "related",
        "Ook relevant",
        "Vergelijkbare publicaties bij " + esc(C.title(entry.node)) + ".",
        similar,
        result.byId,
      )
    );
  }

  C.loadSources().then(function (result) {
    result.errors.forEach(function (e) {
      statusEl.innerHTML += C.errorHtml(e.url, e.error);
    });
    var entry = result.byId[id];
    if (!entry) {
      detailEl.innerHTML =
        '<section class="panel"><h1>Niet gevonden</h1>' +
        "<p>Dit item staat niet in de catalogus.</p></section>";
      return;
    }
    var work = C.accessWork(entry, result.byId);
    document.title = C.title(entry.node) + " — BM19 Proof of Concept";
    detailEl.innerHTML =
      header(entry) +
      about(work || entry) +
      access(entry, work) +
      related(entry, result);
  });
})();
