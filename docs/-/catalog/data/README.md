# Sources

| Participant | JSON                           | Endpoint                                                                             |
| ----------- | ------------------------------ | ------------------------------------------------------------------------------------ |
| CROW        | [crow.json](./crow.json)       | [Source](https://datasets.crow.nl/bm19/-/queries/publications) (private for now)     |
| BouwZo      | [bouwzo.json](./bouwzo.json)   | Hand-made demo records (search term `warmtebehoefte`); Kleintje Gas is a placeholder |
| FGOPlus     | [fgoplus.json](./fgoplus.json) | Mock: a minimal extract of an FGOPlus API response, mapped to schema.org             |

# Concepts

[concepts.json](./concepts.json) drives the question search on the catalog
page. When a word in the query starts with one of a concept's `triggers`, the
page shows a group "Over “label”" with every publication whose title, abstract
or keywords contain a word starting with one of the concept's `terms`.

# Chapters

A publication's `url` links to the document as a whole. To link straight to a
chapter or section, add it under `hasPart` as a `Chapter`
([schema:Chapter](https://schema.org/Chapter)) with its own `url`:

```json
"url": "https://bouwzo.nl/reader/publicatie/kleintje-inregelen/2021/",
"hasPart": [
  {
    "id": "https://bouwzo.nl/reader/publicatie/kleintje-inregelen/2021/4#4/4.2/4.2.2",
    "type": "Chapter",
    "position": "4.2.2",
    "name": null,
    "keywords": ["warmtebehoefte"],
    "url": "https://bouwzo.nl/reader/publicatie/kleintje-inregelen/2021/4#4/4.2/4.2.2"
  }
]
```

The source's `@context` must define `Chapter`, `hasPart` and `position` (see
[bouwzo.json](./bouwzo.json)). The catalog page shows each chapter as a link, labelled `position name` or `Hoofdstuk position` when it has
no name. A chapter's name and keywords are searchable, so a concept can find a
publication through one of its chapters.

# Detail page

`detail.html?id=<id>` shows one node. A product points with `subjectOf` to
the work from its own source, such as the FGOPlus `Dataset`, which provides
the general description and the access section (its `offers` and
`acquireLicensePage`).

# Similar publications

[similar.json](./similar.json) lists, per id, up to 25 entries whose Dutch name,
keywords and abstract are semantically close (multilingual-e5-base, cosine
similarity). The detail page shows them as "Vergelijkbare publicaties".

- Same-source neighbours need a score of at least 0.88.
- Neighbours from other sources need at least 0.84, and at most 5 per entry.
  Cross-source matches are kept deliberately, so the sources link to each other.
  The rest of the list is filled with same-source neighbours.
- Entries with no neighbour above the threshold get an empty list.

It is generated, not written by hand. After changing a data file, run:

```sh
cd tools/similar && npm install && npm run build
```

The GitHub workflow `update-similar.yaml` does this on changes to the data
and commits the result.
