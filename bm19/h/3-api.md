## APIs

> NOTE
>
> These API descriptions don't include any DSGO framework-required endpoints.

> NOTE
>
> This section is in English for possible non-Dutch implementors.

### GET /publications

Returns the paginated list of [=Publications=] published by this data service provider.

| Parameter    | Type        | Usage                                                              |
| ------------ | ----------- | ------------------------------------------------------------------ |
| ?pageSize    | Number 0..1 | Limit the amount of results per page. Default = 1000.              |
| ?page        | Number 0..1 | Returns the paginated results. Default = 0.                        |
| ?citation    | Text 0..n   | Filter [=Publications=] to those that cite the passed publication. |
| {.def .data} |
