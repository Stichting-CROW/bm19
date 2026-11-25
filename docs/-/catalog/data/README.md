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
the works about it. The work from the same source, such as the FGOPlus
`Dataset`, provides the general description and the access section (its
`offers` and `acquireLicensePage`); the other works are shown as related
content.
