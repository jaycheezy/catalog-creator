# Meta Commerce Manager feed acceptance — 2026-09-11

Environment: Netlify production deploy `6aa303eed8f0140008f61cf6`, commit `622cf2f52bd304498f8ef4285ac0f99410030631`

The test used an existing authorized Commerce Manager product catalog and the anonymous stable Catalog Forge feed. Catalog, business, project, feed, and product capability identifiers are omitted. No Meta credentials, cookies, or complete feed/render URLs are recorded.

## Import configuration

- Source type: scheduled data file from a URL
- Feed format: Commerce Manager CSV
- Default currency: EUR
- Refresh: daily, GMT+02:00
- Duplicate handling: update matching products and add new products
- Deletion behavior: products absent from the incoming feed were retained

Meta fetched and parsed the URL before confirmation. Its duplicate preview showed matching products as new and old versions, and the incoming `image_link` values used the deployed versioned Netlify render path.

## Upload result

Upload session: 2026-09-11 at 06:55 GMT+02:00

| Result | Count |
| --- | ---: |
| Updated or added | 30 |
| Removed | 0 |
| Upload failed | 0 |
| Issues | 0 |

Commerce Manager displayed `Data file uploaded` and retained 31 products on the data source: the 30 incoming rows plus one prior product preserved by the non-deleting update mode. This is a successful external acceptance of the anonymous stable feed with no rejected rows or diagnostics.
