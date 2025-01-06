import { Router } from "express";
import { Firestore } from "@google-cloud/firestore";
import { SOURCES } from "../constants.js";

const rentalRouter = Router();
const db = new Firestore();

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

    let query = db.collection("rental_listings");

    if (parsedMinPrice) {
      query = query.where("price", ">=", parsedMinPrice);
    }

    if (parsedMaxPrice) {
      query = query.where("price", "<=", parsedMaxPrice);
    }

    if (parking === "true") {
      query = query.where("parking", "==", true);
    }

    if (furnished === "true") {
      query = query.where("furnished", "==", true);
    }

    if (aircon === "true") {
      query = query.where("aircon", "==", true);
    }

    if (parsedBedrooms) {
      if (parsedBedrooms === 1) {
        query = query.where("bedrooms", "==", 1);
      } else if (parsedBedrooms === 2) {
        query = query.where("bedrooms", "==", 2);
      } else {
        query = query.where("bedrooms", ">=", 3);
      }
    }

    if (houseTypes) {
      const houseTypeArray = Array.isArray(houseTypes)
        ? houseTypes
        : [houseTypes];
      query = query.where("type", "in", houseTypeArray);
    }

    if (locations) {
      const locationArray = Array.isArray(locations) ? locations : [locations];
      query = query.where("location", "in", locationArray);
    }

    if (sources) {
      const sourceArray = Array.isArray(sources) ? sources : [sources];
      query = query.where("source", "in", sourceArray);
    }

    query = query.offset(offset).limit(limitNumber).orderBy("price", "asc");

    const snapshot = await query.get();
    const listings = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json(listings);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default rentalRouter;
