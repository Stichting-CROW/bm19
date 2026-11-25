// Loads the JSON-LD sources of the catalog and offers helpers to read their
// nodes. Used by the catalog page and the detail page.
window.Catalog = (function () {
  "use strict";

  // Each file may be a single node or an object with an "@graph" array of
  // nodes.
  var endpoints = [
    { url: "data/crow.json", source: "CROW" },
    { url: "data/bouwzo.json", source: "BouwZo" },
    { url: "data/isso.json", source: "ISSO" },
    { url: "data/fgoplus.json", source: "FGOPlus" },
  ];

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

  function title(node) {
    return text(node.name) || text(node.alternateName) || "(zonder titel)";
  }

  function detailUrl(node) {
    return "detail.html?id=" + encodeURIComponent(text(node.id));
  }

  function loadJson(url) {
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    });
  }

  // Resolves to { nodes: [{ node, source }], errors: [{ url, error }] }.
  // A failing source is reported but doesn't block the others.
  function loadSources() {
    var errors = [];
    return Promise.all(
      endpoints.map(function (ep) {
        return loadJson(ep.url)
          .then(function (data) {
            var nodes = Array.isArray(data["@graph"]) ? data["@graph"] : [data];
            return nodes.map(function (node) {
              return { node: node, source: ep.source };
            });
          })
          .catch(function (err) {
            errors.push({ url: ep.url, error: err });
            return [];
          });
      }),
    ).then(function (results) {
      return { nodes: [].concat.apply([], results), errors: errors };
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
    title: title,
    detailUrl: detailUrl,
    loadJson: loadJson,
    loadSources: loadSources,
    errorHtml: errorHtml,
  };
})();
