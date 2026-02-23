## Information model

> NOTE
> This section is in English for possible non-Dutch implementors.

### <dfn>`Publication`

> DEF
> A Publication is a unit of knowledge, indepdentently managed, references and sold.
> It can contain online or offline pages of text, websites, web services, datasets and individual requirements.

For publications, an appropriate subclass of [=CreativeWork=] is used.

> NOTE
> This is a subset of Schema.org's [CreativeWork]. The usage notes are adapted from Schema.org (CC BY-SA 3.0).

| Property               | Type                                | Usage notes                                                                       |
| ---------------------- | ----------------------------------- | --------------------------------------------------------------------------------- |
| `abstract`             | Text 0..1                           | An abstract is a short description that summarizes a CreativeWork.                |
| `name`                 | Text 0..1                           | Title.                                                                            |
| `alternateName`        | Text 0..1                           | Subtitle.                                                                         |
| `acquireLicensePage`   | URL 1..n                            | Indicates a page documenting how licenses can be purchased or otherwise acquired. |
| `audience`             | [=Audience=]                        |
| `citation`             | [=CreativeWork=] or Text 0..n       | A citation or reference to another creative work.                                 |
| `author`               | [=Organization=] or [=Person=] 0..n | The author of this content.                                                       |
| `editor`               | [=Organization=] or [=Person=] 0..n | The editor of this content.                                                       |
| `datePublished`        | Date orDateTime 0..1                | Date of first publication or broadcast.                                           |
| `educationalAlignment` | [=AlignmentObject=] 0..n            | An alignment to an established educational framework.                             |
| `publisher`            | [=Organization=] or [=Person=] 1..1 | The publisher of this content.                                                    |
| `isbn`                 | Text 0..n                           | (From [=Book=].)                                                                  |
| `url`                  | Text 1..1                           | URL of the item.                                                                  |
| {.data}                |

> ISSUE
> Dit is nog onvolledig en onvoldoende voor een goede titelbeschrijving.
> Ik denk iig aan ondertitel, type.

| Property         | Type                 | Usage notes                                                   |
| ---------------- | -------------------- | ------------------------------------------------------------- |
| normativityLevel | [=NormativityLevel=] | The level of bindingness of the contents of this publication. |
| { .data .def }   |                      |

### <dfn>`NormativityLevel`

| Level              | Usage notes                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------- |
| `"Voorschrift"`    | Regel die men moet volgen                                                                               |
| `"Richtlijn"`      | Regel waaraan men zich moet houden, en waarvan men alleen gemotiveerd mag afwijken                      |
| `"Aanbeveling"`    | Iets dat wordt aanbevolen en waarvan doorgaans mag worden aangenomen dat de uitwerking ervan gunstig is |
| `"Suggestie"`      | Iets dat wordt geopperd en waarvan een gunstige uitwerking mag worden verwacht                          |
| `"Mogelijkheid"`   | Een optie die wordt gegeven en waarvan over de uitwerking weinig zekerheid bestaat                      |
| `"Norm"`           | Geen onderdeel van CROW-content                                                                         |
| `"Wet"`            | Geen onderdeel van CROW-content                                                                         |
| {.def .data .long} |

### Schema.org

For the usage of the following types, refer to the Schema.org documentation.

- <dfn>`AlignmentObject`</dfn> at Schema.org: [schema.org/AlignmentObject](https://schema.org/AlignmentObject)
- <dfn>`Audience`</dfn> at Schema.org: [schema.org/Audience](https://schema.org/Audience)
- <dfn>`Book`</dfn> at Schema.org: [schema.org/Book](https://schema.org/Book)
- <dfn>`CreativeWork`</dfn> at Schema.org: [schema.org/CreativeWork](https://schema.org/CreativeWork)
- <dfn>`Organization`</dfn> at Schema.org: [schema.org/Organization](https://schema.org/Organization)
- <dfn>`Person`</dfn> at Schema.org: [schema.org/Person](https://schema.org/Person)
