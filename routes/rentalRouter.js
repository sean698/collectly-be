import { Router } from "express";
import { Firestore } from "@google-cloud/firestore";

const rentalRouter = Router();
const db = new Firestore();

const CACHE_TTL_MS = 5 * 60 * 1000;
let listingsCache = { data: null, timestamp: 0 };

async function getAllListings() {
  const now = Date.now();
  if (listingsCache.data && now - listingsCache.timestamp < CACHE_TTL_MS) {
    return listingsCache.data;
  }

  const snapshot = await db.collection("rental_listings").get();
  const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  listingsCache = { data, timestamp: now };
  return data;
}

rentalRouter.get("/", async (req, res) => {
  try {
    const {
      locations,
      sources,
      houseTypes,
      minPrice,
      maxPrice,
      bedrooms,
      page = 1,
      limit = 40,
      parking,
      furnished,
      aircon,
    } = req.query;

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const parsedMinPrice = parseInt(minPrice);
    const parsedMaxPrice = parseInt(maxPrice);
    const parsedBedrooms = parseInt(bedrooms);
    const offset = (pageNumber - 1) * limitNumber;

    const toArray = (value) =>
      value === undefined ? null : Array.isArray(value) ? value : [value];
    const locationArray = toArray(locations);
    const sourceArray = toArray(sources);
    const houseTypeArray = toArray(houseTypes);

    let listings = await getAllListings();

    const nowMs = Date.now();
    listings = listings.filter((l) => {
      if (!l.expiresAt) return true;
      const expiresMs =
        typeof l.expiresAt.toMillis === "function"
          ? l.expiresAt.toMillis()
          : new Date(l.expiresAt).getTime();
      return Number.isNaN(expiresMs) || expiresMs > nowMs;
    });

    if (parsedMinPrice) {
      listings = listings.filter(
        (l) => typeof l.price === "number" && l.price >= parsedMinPrice
      );
    }

    if (parsedMaxPrice) {
      listings = listings.filter(
        (l) => typeof l.price === "number" && l.price <= parsedMaxPrice
      );
    }

    if (parking === "true") {
      listings = listings.filter((l) => l.parking === true);
    }

    if (furnished === "true") {
      listings = listings.filter((l) => l.furnished === true);
    }

    if (aircon === "true") {
      listings = listings.filter((l) => l.aircon === true);
    }

    if (parsedBedrooms) {
      if (parsedBedrooms === 1) {
        listings = listings.filter((l) => l.bedrooms === 1);
      } else if (parsedBedrooms === 2) {
        listings = listings.filter((l) => l.bedrooms === 2);
      } else {
        listings = listings.filter(
          (l) => typeof l.bedrooms === "number" && l.bedrooms >= 3
        );
      }
    }

    if (houseTypeArray) {
      listings = listings.filter((l) => houseTypeArray.includes(l.type));
    }

    if (locationArray) {
      listings = listings.filter((l) => locationArray.includes(l.location));
    }

    if (sourceArray) {
      listings = listings.filter((l) => sourceArray.includes(l.source));
    }

    listings.sort((a, b) => {
      const priceA = typeof a.price === "number" ? a.price : Infinity;
      const priceB = typeof b.price === "number" ? b.price : Infinity;
      return priceA - priceB;
    });

    const paged = listings.slice(offset, offset + limitNumber);

    res.json(paged);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default rentalRouter;
