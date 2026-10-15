# collectly-be

Node/Express API for the Collectly rental aggregator. Reads listings
from Firestore and serves them to the React frontend. One of three
repos: `collectly-be` (this), `collectly-crawler` (scraper),
`collectly-fe` (React UI).

## Architecture

```
collectly-fe (Firebase Hosting)
  -> HTTP -> Cloud Function (gen2) "treasure-finder-be"  [index.js treasureFinder]
  -> Express app (app.js)
       /rentalListings  (routes/rentalRouter.js) -> Firestore "rental_listings"
       /feedback        (routes/feedbackRouter.js) -> Resend email
```

- GCP project: `treasure-finder-62cd0`, region `us-central1`.
- Deploy: push to `main` runs `.github/workflows/deploy.yml`, deploying
  the Cloud Function (`--runtime=nodejs20 --entry-point=treasureFinder
  --trigger-http --allow-unauthenticated`).
- ES modules (`"type": "module"`). `index.js` is the Function entry;
  `server.js` is for local `npm start`.

## GET /rentalListings

Query params: `locations`, `sources`, `houseTypes` (arrays),
`minPrice`, `maxPrice`, `bedrooms`, `page`, `limit`.

Design: fetch ALL listings once, cache in memory for 5 minutes, then
filter / sort / paginate in JS. Data changes only every 3h (crawler
cadence) so a 5-min cache is safe and cuts Firestore reads to near zero
on warm instances.

Why in-memory instead of Firestore queries:
- A null-price listing was dropped by `orderBy("price")`, which hid all
  of kijiji (its prices were null). In-memory sort puts null prices last
  (Infinity) instead of dropping them.
- Arbitrary filter combinations avoided Firestore's composite-index
  requirements and range-filter/orderBy conflicts.
- `offset` pagination billed full reads per page; `slice` does not.

Also filters out expired listings (`expiresAt <= now`) to cover the
window before Firestore TTL deletes them.

Assumption: the dataset is small (7-day TTL, a few thousand docs). If it
grows to tens of thousands, switch to cursor-based pagination.

## /feedback

Sends email via Resend. `new Resend(process.env.RESEND_API_KEY)` runs at
module load, so the server crashes on startup if the key is missing —
set a dummy key for local runs (`RESEND_API_KEY=dummy npm start`).

## Data model

Firestore collection `rental_listings`. Docs written by the crawler;
this API only reads. Fields: source, title, url, price (int|null),
location, imageUrl, bedrooms, bathrooms, size, type, furnished, parking,
aircon, latitude, longitude, createdAt, expiresAt. The API returns
`...doc.data()` verbatim, so new crawler fields flow through without
changes here (that is how latitude/longitude reached the frontend).

## Local run

```
RESEND_API_KEY=dummy GOOGLE_CLOUD_PROJECT=treasure-finder-62cd0 node server.js
# needs application-default credentials for Firestore:
gcloud auth application-default login
```

## Conventions

- The frontend sends only the filters listed above. Parking / aircon /
  furnished filters were removed (fill rates too low across sources) —
  do not re-add server-side filter branches for them.
- Keep the response shape flat and verbatim from Firestore so the
  crawler can add fields without touching this repo.
