(function () {
  "use strict";

  var searchInput = document.getElementById("search");
  var countEl = document.getElementById("count");
  var statusEl = document.getElementById("status");
  var groupsEl = document.getElementById("groups");
  var listEl = document.getElementById("list");

  var text = Catalog.text;
  var esc = Catalog.esc;
  var conceptsUrl = "data/concepts.json";

  var STOPWORDS = (
    "aan als bij dan dat de deze die dit door een en er heb hebben het " +
    "hoe hun ik in is je kan kun kunnen me met mijn moet moeten mag naar " +
    "niet of om op over te tot uit van voor wat we welk welke wanneer " +
    "waar wij wil wordt zijn zo zou"
  ).split(" ");
  var MIN_TOKEN_LENGTH = 3;

  var records = []; // see buildRecord
  var byId = {};
  var concepts = []; // { label, triggers, terms }

  // Splits text into lowercase words. Hyphenated words are kept whole
  // and also added as their separate parts.
  function words(s) {
    var out = [];
    s.toLowerCase()
      .split(/[^0-9a-z\u00c0-\u024f-]+/)
      .forEach(function (w) {
        w = w.replace(/^-+|-+$/g, "");
        if (!w) return;
        out.push(w);
        if (w.indexOf("-") !== -1) {
          w.split("-").forEach(function (part) {
            if (part) out.push(part);
          });
        }
      });
    return out;
  }

  // Words from the query that carry meaning: no stopwords, no short
  // words except numbers.
  function queryTokens(q) {
    return words(q).filter(function (w, i, all) {
      if (all.indexOf(w) !== i) return false;
      if (STOPWORDS.indexOf(w) !== -1) return false;
      return /^[0-9]+$/.test(w) || w.length >= MIN_TOKEN_LENGTH;
    });
  }

  // A number must match a word exactly; other tokens match the start
  // of a word.
  function tokenMatches(token, recordWords) {
    var numeric = /^[0-9]+$/.test(token);
    for (var i = 0; i < recordWords.length; i++) {
      var w = recordWords[i];
      if (numeric ? w === token : w.indexOf(token) === 0) return true;
    }
    return false;
  }

  // A match in the title counts more than a match in the rest of the
  // record. 0 means no match.
  var TITLE_WEIGHT = 3;
  var BODY_WEIGHT = 1;
  function matchWeight(token, record) {
    if (tokenMatches(token, record.titleWords)) return TITLE_WEIGHT;
    if (tokenMatches(token, record.words)) return BODY_WEIGHT;
    return 0;
  }

  function score(tokens, record) {
    var total = 0;
    var textHits = 0;
    tokens.forEach(function (t) {
      var w = matchWeight(t, record);
      if (w) {
        total += w;
        if (!/^[0-9]+$/.test(t)) textHits++;
      }
    });
    var hasTextToken = tokens.some(function (t) {
      return !/^[0-9]+$/.test(t);
    });
    return hasTextToken && textHits === 0 ? 0 : total;
  }

  function buildRecord(entry) {
    var node = entry.node;
    var title = Catalog.title(node);
    var keywords = Catalog.list(node.keywords).map(text).join(" ");
    return {
      entry: entry,
      isProduct: Catalog.isType(node, "Product"),
      title: title,
      titleWords: words(title),
      words: words(
        [
          title,
          entry.source,
          text(node.publisher),
          Catalog.fmtDate(node.datePublished),
          Catalog.summary(node),
          text(node.url),
          keywords,
        ]
          .concat(
            Catalog.chapters(node).map(function (c) {
              return c.label + " " + c.keywords;
            }),
          )
          .join(" "),
      ),
    };
  }

  function matchedConcepts(tokens) {
    return concepts.filter(function (c) {
      return tokens.some(function (t) {
        return c.triggers.some(function (trigger) {
          return t.indexOf(trigger.toLowerCase()) === 0;
        });
      });
    });
  }

  // The non-product sources about a concept, best matches first.
  function conceptHits(concept) {
    var terms = concept.terms.map(function (t) {
      return t.toLowerCase();
    });
    return records
      .map(function (r) {
        var s = 0;
        if (!r.isProduct) {
          terms.forEach(function (t) {
            s += matchWeight(t, r);
          });
        }
        return { r: r, s: s };
      })
      .filter(function (x) {
        return x.s > 0;
      })
      .sort(function (a, b) {
        return b.s - a.s;
      })
      .map(function (x) {
        return x.r;
      });
  }

  // The products that share the most query tokens with the query.
  function bestProducts(tokens) {
    var best = 0;
    var hits = [];
    records.forEach(function (r) {
      if (!r.isProduct) return;
      var s = score(tokens, r);
      if (s === 0) return;
      if (s > best) {
        best = s;
        hits = [r];
      } else if (s === best) {
        hits.push(r);
      }
    });
    return hits.sort(function (a, b) {
      return a.title.length - b.title.length;
    });
  }

  // The words all titles start with, e.g. "HR-wand combiketel Kli-Max"
  // for its tapklasse 3 and tapklasse 4 variants.
  function commonTitle(titles) {
    var prefix = titles[0];
    titles.forEach(function (t) {
      var i = 0;
      while (i < prefix.length && i < t.length && prefix[i] === t[i]) i++;
      prefix = prefix.slice(0, i);
    });
    var cutsWord = titles.some(function (t) {
      return /[0-9a-z]/i.test(t.charAt(prefix.length));
    });
    if (cutsWord) prefix = prefix.replace(/[^\s\/]*$/, "");
    prefix = prefix.replace(/[\s\/-]+$/, "");
    return prefix || titles[0];
  }

  function card(r) {
    return Catalog.card(r.entry, byId);
  }

  function group(heading, hits) {
    return (
      '<section class="group">' +
      "<h2>Over “" +
      esc(heading) +
      "” vind je informatie bij</h2>" +
      '<ul class="cards">' +
      hits.map(card).join("") +
      "</ul></section>"
    );
  }

  function showGroups(groups) {
    var total = 0;
    groupsEl.innerHTML = groups
      .map(function (g) {
        total += g.hits.length;
        return group(g.heading, g.hits);
      })
      .join("");
    groupsEl.hidden = false;
    listEl.hidden = true;
    countEl.textContent =
      total +
      (total === 1 ? " bron" : " bronnen") +
      " voor " +
      groups.length +
      (groups.length === 1 ? " onderwerp" : " onderwerpen");
  }

  function showList(tokens) {
    var shown = records;
    if (tokens.length) {
      shown = records
        .map(function (r) {
          return { r: r, s: score(tokens, r) };
        })
        .filter(function (x) {
          return x.s > 0;
        })
        .sort(function (a, b) {
          return b.s - a.s;
        })
        .map(function (x) {
          return x.r;
        });
    }
    listEl.innerHTML = shown.map(card).join("");
    groupsEl.hidden = true;
    listEl.hidden = records.length === 0;
    countEl.textContent =
      shown.length + " van " + records.length + " resultaten";
  }

  function applySearch() {
    var tokens = queryTokens(searchInput.value);
    var groups = [];

    matchedConcepts(tokens).forEach(function (c) {
      var hits = conceptHits(c);
      if (hits.length) groups.push({ heading: c.label, hits: hits });
    });

    var products = bestProducts(tokens);
    if (products.length) {
      groups.push({
        heading: commonTitle(
          products.map(function (r) {
            return r.title;
          }),
        ),
        hits: products,
      });
    }

    if (groups.length) showGroups(groups);
    else showList(tokens);
  }

  searchInput.addEventListener("input", applySearch);

  function reportError(url, err) {
    statusEl.innerHTML += Catalog.errorHtml(url, err);
  }

  Promise.all([
    Catalog.loadSources(),
    Catalog.loadJson(conceptsUrl).catch(function (err) {
      reportError(conceptsUrl, err);
      return [];
    }),
  ]).then(function (results) {
    results[0].errors.forEach(function (e) {
      reportError(e.url, e.error);
    });
    byId = results[0].byId;
    records = results[0].nodes.map(buildRecord);
    concepts = results[1];
    applySearch();
  });
})();
