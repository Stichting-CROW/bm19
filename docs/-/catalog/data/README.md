# Sources

| Participant | JSON                           | Endpoint                                                                         |
| ----------- | ------------------------------ | -------------------------------------------------------------------------------- |
| CROW        | [crow.json](./crow.json)       | [Source](https://datasets.crow.nl/bm19/-/queries/publications) (private for now) |
| BouwZo      | [bouwzo.json](./bouwzo.json)   | Hand-made demo record (search term `warmtebehoefte`)                             |
| ISSO        | [isso.json](./isso.json)       | Placeholder until the ISSO search index is delivered                             |
| FGOPlus     | [fgoplus.json](./fgoplus.json) | Mock: a minimal extract of an FGOPlus API response, mapped to schema.org         |

# Concepts

[concepts.json](./concepts.json) drives the question search on the catalog
page. When a word in the query starts with one of a concept's `triggers`, the
page shows a group "Over “label”" with every publication whose title, abstract
or keywords contain a word starting with one of the concept's `terms`.
