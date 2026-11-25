// Loads the JSON-LD sources of the catalog and offers helpers to read and
// render their nodes. Used by the catalog page and the detail page.
window.Catalog = (function () {
  "use strict";

  // Each file may be a single node or an object with an "@graph" array of
  // nodes.
  var endpoints = [
    { url: "data/crow.json", source: "CROW" },
    { url: "data/bouwzo.json", source: "BouwZo" },
    { url: "data/fgoplus.json", source: "FGOPlus" },
  ];

  // Written by tools/similar; maps each id to its most similar entries.
  var similarUrl = "data/similar.json";

  function text(value) {
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

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function list(value) {
    return value == null ? [] : [].concat(value);
  }

  function isType(node, type) {
    return list(node.type).some(function (t) {
      return text(t) === type;
    });
  }

  function title(node) {
    return text(node.name) || text(node.alternateName) || "(zonder titel)";
  }

  function detailUrl(node) {
    return "detail.html?id=" + encodeURIComponent(text(node.id));
  }

  function fmtDate(value) {
    var s = text(value);
    if (!s) return "";
    var d = new Date(s);
    if (isNaN(d)) return s;
    return d.toLocaleDateString("nl-NL", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }

  // The amount of an offer, e.g. "€ 96,59 per jaar" or "Gratis". The price
  // may be on the offer itself or in its priceSpecification.
  function fmtAmount(offer) {
    var spec = offer.priceSpecification || {};
    var price = text(spec.price != null ? spec.price : offer.price);
    if (price === "") return "";
    var currency = text(spec.priceCurrency || offer.priceCurrency) || "EUR";
    var n = Number(price);
    if (n === 0) return "Gratis";
    if (isNaN(n)) return price + " " + currency;
    var unit = spec.referenceQuantity
      ? text(spec.referenceQuantity.unitText)
      : "";
    return (
      n.toLocaleString("nl-NL", { style: "currency", currency: currency }) +
      (unit ? " per " + unit : "")
    );
  }

  // E.g. "€ 96,59 per jaar (Leden Techniek Nederland)".
  function fmtPrice(offer) {
    var amount = fmtAmount(offer);
    if (!amount) return "";
    var label = text(offer.description) || text(offer.name);
    return amount + (label ? " (" + label + ")" : "");
  }

  // One line of a product's specifications, e.g. brand, model and GTIN.
  function productSummary(node) {
    return [
      text(node.brand),
      text(node.model),
      node.mpn ? "art.nr. " + text(node.mpn) : "",
      node.gtin ? "GTIN " + text(node.gtin) : "",
      text(node.category),
    ]
      .filter(Boolean)
      .join(" · ");
  }

  function summary(node) {
    return isType(node, "Product")
      ? productSummary(node)
      : text(node.abstract) || text(node.description);
  }

  // Chapters of a publication, from schema:hasPart. A chapter shows as
  // "4.2.2 Name", or "Hoofdstuk 4.2.2" when it has no name.
  function chapters(node) {
    return list(node.hasPart)
      .filter(function (part) {
        return part && typeof part === "object";
      })
      .map(function (part) {
        var position = text(part.position);
        var name = text(part.name);
        var label = name
          ? (position ? position + " " : "") + name
          : "Hoofdstuk" + (position ? " " + position : "");
        return {
          label: label,
          url: text(part.url) || text(part.id),
          keywords: list(part.keywords).map(text).join(" "),
        };
      });
  }

  function chapterLinks(items) {
    return (
      '<ul class="chapters">' +
      items
        .map(function (c) {
          return (
            "<li>" +
            (c.url
              ? '<a href="' +
                esc(c.url) +
                '" target="_blank" rel="noopener">' +
                esc(c.label) +
                "</a>"
              : esc(c.label)) +
            "</li>"
          );
        })
        .join("") +
      "</ul>"
    );
  }

  // The entries of the nodes a property refers to, e.g. isRelatedTo. A
  // reference is an object with only an id; unknown ids are skipped.
  function refs(byId, value) {
    return list(value)
      .map(function (ref) {
        var id = typeof ref === "string" ? ref : text(ref.id || ref["@id"]);
        return byId[id] || (typeof ref === "object" && ref.type ? ref : null);
      })
      .filter(Boolean)
      .map(function (entry) {
        return entry.node ? entry : { node: entry, source: "" };
      });
  }

  // The work that gives access to an entry: the entry itself when it has
  // offers or a license page, otherwise the first work about it from the
  // same source, e.g. the FGOPlus dataset for an FGOPlus product.
  function accessWork(entry, byId) {
    var node = entry.node;
    if (node.offers || node.acquireLicensePage || node.license) return entry;
    return (
      refs(byId, node.isRelatedTo).filter(function (e) {
        return e.source === entry.source;
      })[0] || null
    );
  }

  // The entries most similar to an entry, from any source, as computed by
  // scripts in tools/similar. Entries without a close match have no list.
  function relatedWorks(entry, byId, similar) {
    var ids = (similar && similar[text(entry.node.id)]) || [];
    return ids
      .map(function (n) {
        return byId[n.id];
      })
      .filter(Boolean);
  }

  // Cost and license as HTML, from schema.org offers, license and
  // acquireLicensePage. Offers on a dataset are shown as a license on it,
  // e.g. "Licentie op FGOPlus".
  function costLicense(entry, byId) {
    var work = accessWork(entry, byId);
    if (!work) {
      return '<span class="unknown">Niet opgegeven door de bron</span>';
    }
    var node = work.node;
    var parts = [];
    var prices = list(node.offers).map(fmtPrice).filter(Boolean);
    if (prices.length) {
      parts.push(
        (isType(node, "Dataset")
          ? '<span class="offer-item">Licentie op ' +
            esc(title(node)) +
            "</span><br />"
          : "") + prices.map(esc).join("<br />"),
      );
    }
    var license = text(node.license);
    if (license) {
      parts.push(
        /^https?:\/\//.test(license)
          ? '<a href="' +
              esc(license) +
              '" target="_blank" rel="noopener">licentie</a>'
          : esc(license),
      );
    }
    if (!prices.length) {
      list(node.acquireLicensePage).forEach(function (page) {
        var href = text(page);
        if (href) {
          parts.push(
            '<a href="' +
              esc(href) +
              '" target="_blank" rel="noopener">licentie verkrijgen</a>',
          );
        }
      });
    }
    return parts.length
      ? parts.join(" · ")
      : '<span class="unknown">Niet opgegeven door de bron</span>';
  }

  // A result card. The title links to the detail page.
  function card(entry, byId) {
    var node = entry.node;
    var url = text(node.url);
    var date = fmtDate(node.datePublished);
    var sum = summary(node);
    var parts = chapters(node);
    return (
      '<li class="card">' +
      '<span class="badge">' +
      esc(entry.source) +
      "</span>" +
      '<h3 class="card-title"><a href="' +
      esc(detailUrl(node)) +
      '">' +
      esc(title(node)) +
      "</a></h3>" +
      (sum ? '<p class="card-summary">' + esc(sum) + "</p>" : "") +
      (parts.length
        ? '<p class="chapters-label">Direct naar</p>' + chapterLinks(parts)
        : "") +
      '<dl class="card-meta">' +
      (date ? "<div><dt>Datum</dt><dd>" + esc(date) + "</dd></div>" : "") +
      "<div><dt>Kosten/licentie</dt><dd>" +
      costLicense(entry, byId) +
      "</dd></div>" +
      "</dl>" +
      '<p class="card-links">' +
      '<a href="' +
      esc(detailUrl(node)) +
      '">Details</a>' +
      (url
        ? '<a href="' +
          esc(url) +
          '" target="_blank" rel="noopener">Naar de bron ↗</a>'
        : '<span class="unknown">Geen bronlink</span>') +
      "</p>" +
      "</li>"
    );
  }

  function loadJson(url) {
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    });
  }

  // Resolves to { nodes: [{ node, source }], byId: { id: { node, source } },
  // similar: { id: [{ id, score }] }, errors: [{ url, error }] }. A failing
  // file is reported but doesn't block the others.
  function loadSources() {
    var errors = [];
    function optional(url, pick) {
      return loadJson(url)
        .then(pick)
        .catch(function (err) {
          errors.push({ url: url, error: err });
          return pick(null);
        });
    }
    var similarFile = optional(similarUrl, function (data) {
      return data ? data.similar || {} : {};
    });
    var sourceFiles = Promise.all(
      endpoints.map(function (ep) {
        return optional(ep.url, function (data) {
          if (!data) return [];
          var nodes = Array.isArray(data["@graph"]) ? data["@graph"] : [data];
          return nodes.map(function (node) {
            return { node: node, source: ep.source };
          });
        });
      }),
    );
    return Promise.all([sourceFiles, similarFile]).then(function (results) {
      var nodes = [].concat.apply([], results[0]);
      var byId = {};
      nodes.forEach(function (entry) {
        var id = text(entry.node.id);
        if (id) byId[id] = entry;
      });
      return {
        nodes: nodes,
        byId: byId,
        similar: results[1],
        errors: errors,
      };
    });
  }

  function errorHtml(url, err) {
    return (
      '<p class="error">Kon <code>' +
      esc(url) +
      "</code> niet laden: " +
      esc(err.message) +
      ".</p>"
    );
  }

  return {
    text: text,
    esc: esc,
    list: list,
    isType: isType,
    title: title,
    detailUrl: detailUrl,
    fmtDate: fmtDate,
    fmtAmount: fmtAmount,
    productSummary: productSummary,
    summary: summary,
    chapters: chapters,
    refs: refs,
    accessWork: accessWork,
    relatedWorks: relatedWorks,
    costLicense: costLicense,
    card: card,
    loadJson: loadJson,
    loadSources: loadSources,
    errorHtml: errorHtml,
  };
})();
