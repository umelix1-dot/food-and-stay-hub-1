/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

// Match Vite's local-development convention while retaining `.env` support.
dotenv.config({ path: [".env.local", ".env"] });

// Standard ESM folder definitions
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Initialize users storage path outside workspace root to avoid dev server reload on file write
const DATA_DIR = path.join(os.tmpdir(), "food_stay_hub_data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify([]), "utf-8");
}

// Helper functions for user storage
function readUsers() {
  try {
    const data = fs.readFileSync(USERS_FILE, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

function writeUsers(users: any[]) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
}

// Secure PBKDF2 Password Hashing
function hashPassword(password: string): { salt: string; hash: string } {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return { salt, hash };
}

// Seed default admin user if not present
const initialUsers = readUsers();
if (!initialUsers.find((u: any) => u.email === "admin@foodstayhub.com")) {
  const { salt, hash } = hashPassword("admin123");
  initialUsers.push({
    id: "admin-default-id",
    email: "admin@foodstayhub.com",
    name: "System Admin",
    salt,
    hash,
    role: "admin",
    createdAt: new Date().toISOString()
  });
  writeUsers(initialUsers);
}

function verifyPassword(password: string, salt: string, hash: string): boolean {
  const checkHash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return hash === checkHash;
}

// Coordinates map for manual location selection to support Maps Grounding
const CITY_COORDS: Record<string, { latitude: number; longitude: number }> = {
  // Negeri Sembilan
  "nilai": { latitude: 2.8125, longitude: 101.7978 },
  "seremban": { latitude: 2.7258, longitude: 101.9424 },
  "port_dickson": { latitude: 2.5229, longitude: 101.7951 },
  // Selangor
  "petaling_jaya": { latitude: 3.1073, longitude: 101.6067 },
  "shah_alam": { latitude: 3.0738, longitude: 101.5183 },
  "subang_jaya": { latitude: 3.0487, longitude: 101.5851 },
  "klang": { latitude: 3.0449, longitude: 101.4456 },
  // Kuala Lumpur
  "kl_city": { latitude: 3.1390, longitude: 101.6869 },
  // Penang
  "george_town": { latitude: 5.4141, longitude: 100.3288 },
  "bayan_lepas": { latitude: 5.2951, longitude: 100.2598 },
  "butterworth": { latitude: 5.3942, longitude: 100.3664 },
  // Johor
  "johor_bahru": { latitude: 1.4927, longitude: 103.7414 },
  "batu_pahat": { latitude: 1.8550, longitude: 102.9300 },
  "muar": { latitude: 2.0442, longitude: 102.5689 },
  // Kedah
  "alor_setar": { latitude: 6.1210, longitude: 100.3601 },
  "sungai_petani": { latitude: 5.6439, longitude: 100.4912 },
  "langkawi": { latitude: 6.3500, longitude: 99.8000 },
  // Kelantan
  "kota_bharu": { latitude: 6.1254, longitude: 102.2386 },
  "tanah_merah": { latitude: 5.8115, longitude: 102.1466 },
  // Melaka
  "melaka_city": { latitude: 2.1896, longitude: 102.2501 },
  "alor_gajah": { latitude: 2.3833, longitude: 102.2083 },
  // Pahang
  "kuantan": { latitude: 3.8077, longitude: 103.3260 },
  "temerloh": { latitude: 3.4478, longitude: 102.4173 },
  // Perak
  "ipoh": { latitude: 4.5975, longitude: 101.0901 },
  "taiping": { latitude: 4.8500, longitude: 100.7333 },
  "teluk_intan": { latitude: 4.0259, longitude: 101.0213 },
  // Perlis
  "kangar": { latitude: 6.4414, longitude: 100.1986 },
  "padang_besar": { latitude: 6.6617, longitude: 100.3228 },
  // Terengganu
  "kuala_terengganu": { latitude: 5.3302, longitude: 103.1408 },
  "kemaman": { latitude: 4.2167, longitude: 103.4167 },
  // Sabah
  "kota_kinabalu": { latitude: 5.9804, longitude: 116.0735 },
  "sandakan": { latitude: 5.8402, longitude: 118.1170 },
  "tawau": { latitude: 4.2448, longitude: 117.8912 },
  // Sarawak
  "kuching": { latitude: 1.5533, longitude: 110.3592 },
  "miri": { latitude: 4.3995, longitude: 113.9914 },
  "sibu": { latitude: 2.2873, longitude: 111.8305 },
  // Putrajaya
  "putrajaya_city": { latitude: 2.9264, longitude: 101.6964 },
  // Labuan
  "victoria": { latitude: 5.2767, longitude: 115.2417 },
  // China
  "guangzhou": { latitude: 23.1291, longitude: 113.2644 },
  "shenzhen": { latitude: 22.5431, longitude: 114.0579 },
  "beijing_city": { latitude: 39.9042, longitude: 116.4074 },
  // India
  "mumbai": { latitude: 19.0760, longitude: 72.8777 },
  "pune": { latitude: 18.5204, longitude: 73.8567 },
  "delhi_city": { latitude: 28.6139, longitude: 77.2090 },
  // Japan
  "tokyo_city": { latitude: 35.6762, longitude: 139.6503 },
  "osaka_city": { latitude: 34.6937, longitude: 135.5022 }
};

// Calculate Haversine straight-line distance in km
function calculateHaversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const dist = R * c;
  return Math.max(0.5, Math.round(dist * 10) / 10);
}

// Google Maps Configuration endpoint
app.get("/api/config/maps", (req, res) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_PLATFORM_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || "";
  res.json({ apiKey });
});

// Delivery Distance endpoint (Uses Routes/Distance Matrix API if API key available, else straight-line fallback)
app.post("/api/delivery/distance", async (req, res) => {
  try {
    const { originLat, originLng, destLat, destLng } = req.body;
    if (originLat === undefined || originLng === undefined || destLat === undefined || destLng === undefined) {
      return res.status(400).json({ error: "Missing origin or destination coordinates" });
    }

    const oLat = parseFloat(originLat);
    const oLng = parseFloat(originLng);
    const dLat = parseFloat(destLat);
    const dLng = parseFloat(destLng);

    const straightLineDistanceKm = calculateHaversineKm(oLat, oLng, dLat, dLng);

    const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_PLATFORM_KEY;
    if (apiKey) {
      try {
        const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
          },
          body: JSON.stringify({
            origin: {
              location: {
                latLng: { latitude: oLat, longitude: oLng }
              }
            },
            destination: {
              location: {
                latLng: { latitude: dLat, longitude: dLng }
              }
            },
            travelMode: "DRIVE",
            routingPreference: "TRAFFIC_UNAWARE"
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.routes && data.routes.length > 0 && data.routes[0].distanceMeters) {
            const drivingDistanceKm = Math.max(0.5, Math.round((data.routes[0].distanceMeters / 1000) * 10) / 10);
            return res.json({
              distanceKm: drivingDistanceKm,
              method: "routes_api",
              duration: data.routes[0].duration
            });
          }
        }
      } catch (routesErr) {
        console.warn("Routes API computeRoutes fallback to straight-line:", routesErr);
      }
    }

    // Fallback to straight-line distance
    res.json({
      distanceKm: straightLineDistanceKm,
      method: "straight_line"
    });
  } catch (err: any) {
    console.error("Distance computation error:", err);
    res.status(500).json({ error: "Failed to compute distance" });
  }
});

// Initialize Gemini Client
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("WARNING: GEMINI_API_KEY environment variable is not set. Using mock places fallback.");
    }
    geminiClient = new GoogleGenAI({
      apiKey: apiKey || "MOCK_KEY",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return geminiClient;
}

// -------------------------------------------------------------
// Authentication Endpoints
// -------------------------------------------------------------

// Register
app.post("/api/auth/register", (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const users = readUsers();
  if (users.find((u: any) => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(400).json({ error: "Email already registered" });
  }

  const { salt, hash } = hashPassword(password);
  const newUser = {
    id: crypto.randomUUID(),
    email: email.toLowerCase(),
    name,
    salt,
    hash,
    role: "user",
    createdAt: new Date().toISOString(),
    location: undefined,
    preferredCuisine: undefined,
    searchPreference: undefined
  };

  users.push(newUser);
  writeUsers(users);

  // Return user profile without password credentials
  const { salt: _, hash: __, ...profile } = newUser;
  res.status(201).json({ user: profile, token: `session_${profile.id}` });
});

// Login
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const users = readUsers();
  const user = users.find((u: any) => u.email.toLowerCase() === email.toLowerCase());

  if (!user || !user.salt || !user.hash) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const isValid = verifyPassword(password, user.salt, user.hash);
  if (!isValid) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const { salt: _, hash: __, ...profile } = user;
  res.json({ user: profile, token: `session_${profile.id}` });
});

// Forgot Password (Simulated Demo Reset)
app.post("/api/auth/forgot-password", (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  const users = readUsers();
  const user = users.find((u: any) => u.email.toLowerCase() === email.toLowerCase());

  if (!user) {
    return res.status(404).json({ error: "Email not found" });
  }

  // Create a quick simulated demo reset token
  const resetToken = crypto.randomBytes(16).toString("hex");
  user.resetToken = resetToken;
  user.resetTokenExpires = Date.now() + 3600000; // 1 hour
  writeUsers(users);

  res.json({
    message: "Password reset link generated successfully",
    resetToken,
    demoLink: `/reset-password?token=${resetToken}`
  });
});

// Reset Password
app.post("/api/auth/reset-password", (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ error: "Token and new password are required" });
  }

  const users = readUsers();
  const user = users.find((u: any) => u.resetToken === token && u.resetTokenExpires > Date.now());

  if (!user) {
    return res.status(400).json({ error: "Invalid or expired reset token" });
  }

  const { salt, hash } = hashPassword(newPassword);
  user.salt = salt;
  user.hash = hash;
  delete user.resetToken;
  delete user.resetTokenExpires;

  writeUsers(users);
  res.json({ message: "Password updated successfully" });
});

// Update Profile Preference
app.post("/api/auth/profile/update", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer session_")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const userId = authHeader.replace("Bearer session_", "");
  const { name, location, preferredCuisine, searchPreference } = req.body;

  const users = readUsers();
  const userIndex = users.findIndex((u: any) => u.id === userId);

  if (userIndex === -1) {
    return res.status(404).json({ error: "User not found" });
  }

  const user = users[userIndex];
  if (name !== undefined) user.name = name;
  if (location !== undefined) user.location = location;
  if (preferredCuisine !== undefined) user.preferredCuisine = preferredCuisine;
  if (searchPreference !== undefined) user.searchPreference = searchPreference;

  users[userIndex] = user;
  writeUsers(users);

  const { salt: _, hash: __, ...profile } = user;
  res.json({ user: profile });
});

// Get profile
app.get("/api/auth/profile", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer session_")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const userId = authHeader.replace("Bearer session_", "");
  const users = readUsers();
  const user = users.find((u: any) => u.id === userId);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const { salt: _, hash: __, ...profile } = user;
  res.json({ user: profile });
});

// Admin endpoint: Get all users in the system
app.get("/api/admin/users", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer session_")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const userId = authHeader.replace("Bearer session_", "");
  const users = readUsers();
  const requester = users.find((u: any) => u.id === userId || u.email === userId);

  // Authorize system admin, demo admin, or designated admin accounts
  const isAdmin = 
    requester?.role === "admin" ||
    userId === "demo-admin-789" ||
    userId === "admin-default-id" ||
    requester?.email === "admin@foodstayhub.com" ||
    requester?.email === "wajidaliroghani1@gmail.com";

  if (!isAdmin) {
    return res.status(403).json({ error: "Forbidden: Admins only" });
  }

  // Combine seeded/registered users with system profiles
  const demoUsers = [
    {
      id: "demo-user-123",
      email: "foodlover@malaysia.my",
      name: "Ahmad Foodie",
      role: "user",
      location: { city: "Nilai", state: "Negeri Sembilan", country: "Malaysia" },
      preferredCuisine: "Malaysia",
      searchPreference: "restaurants",
      createdAt: new Date(Date.now() - 86400000 * 5).toISOString()
    },
    {
      id: "demo-owner-456",
      email: "chefzul@heritagekitchen.my",
      name: "Chef Zul (Heritage Kitchen)",
      role: "business",
      location: { city: "Seremban", state: "Negeri Sembilan", country: "Malaysia" },
      preferredCuisine: "Pakistani",
      searchPreference: "hotels",
      createdAt: new Date(Date.now() - 86400000 * 10).toISOString()
    },
    {
      id: "demo-admin-789",
      email: "admin@foodstayhub.com",
      name: "System Admin",
      role: "admin",
      location: { city: "Kuala Lumpur", state: "Wilayah Persekutuan", country: "Malaysia" },
      preferredCuisine: "Chinese",
      searchPreference: "restaurants",
      createdAt: new Date(Date.now() - 86400000 * 30).toISOString()
    }
  ];

  const allUsersMap = new Map();
  users.forEach(({ salt, hash, ...profile }: any) => {
    allUsersMap.set(profile.id, profile);
  });
  demoUsers.forEach(du => {
    if (!allUsersMap.has(du.id)) {
      allUsersMap.set(du.id, du);
    }
  });

  res.json({ users: Array.from(allUsersMap.values()) });
});


// -------------------------------------------------------------
// Search Engine & Maps Grounding Integration
// -------------------------------------------------------------

app.post("/api/search", async (req, res) => {
  const { cuisine, preference, location } = req.body;

  if (!cuisine || !preference || !location) {
    return res.status(400).json({ error: "Cuisine, preference, and location are required parameters" });
  }

  // Determine Coordinates (passed for maps grounding)
  let lat = 2.8125;
  let lng = 101.7978; // Default to Nilai
  let locationLabel = "Nilai, Negeri Sembilan, Malaysia";

  if (location.type === "gps" && location.coords) {
    lat = location.coords.latitude;
    lng = location.coords.longitude;
    locationLabel = `Current GPS coordinates (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  } else if (location.type === "manual") {
    const cityKey = location.city ? String(location.city).toLowerCase().replace(/ /g, "_") : "";
    if (CITY_COORDS[cityKey]) {
      lat = CITY_COORDS[cityKey].latitude;
      lng = CITY_COORDS[cityKey].longitude;
    }
    locationLabel = `${location.area || ""}, ${location.city || ""}, ${location.state || ""}, ${location.country || ""}`;
  }

  // Construct search query
  const searchType = preference === "hotels" ? "hotels, resorts, or accommodations" : "restaurants, cafes, or food outlets";
  const contentPrompt = `Find realistic and actual ${searchType} in "${locationLabel}" that specialize in, are nearby, or are themed around "${cuisine}" style/cuisine.
Return EXACTLY 5 high-quality places.
Your response MUST consist ONLY of a valid JSON array of objects inside a markdown code block starting with \`\`\`json and ending with \`\`\`.
Do not output any introductory or concluding text outside of the json block.

JSON Schema format for each object:
{
  "name": "Name of the place",
  "type": "hotel" or "restaurant",
  "address": "Full street address",
  "phone": "Phone number or null",
  "openingHours": "Opening hours or null",
  "rating": number (e.g. 4.6),
  "reviewsCount": number (e.g. 120),
  "description": "A short, engaging description highlighting what makes it unique",
  "cuisineType": "The style of cuisine or hotel room types",
  "latitude": number (MUST be an actual float coordinate near the search area coordinate: ${lat}),
  "longitude": number (MUST be an actual float coordinate near the search area coordinate: ${lng})
}`;

  console.log(`Starting Gemini API query: preference=${preference}, cuisine=${cuisine}, location=${locationLabel} (lat=${lat}, lng=${lng})`);

  try {
    const ai = getGeminiClient();
    
    // Check if API key is mock, or actually present
    if (process.env.GEMINI_API_KEY) {
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: contentPrompt,
        config: {
          tools: [{ googleMaps: {} }],
          toolConfig: {
            retrievalConfig: {
              latLng: {
                latitude: lat,
                longitude: lng
              }
            }
          }
        }
      });

      const responseText = response.text || "";
      console.log("Raw Gemini API Response fetched successfully.");

      // Parse JSON from Markdown code block
      let places: any[] = [];
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || responseText.match(/```\s*([\s\S]*?)\s*```/);
      const jsonText = jsonMatch ? jsonMatch[1].trim() : responseText.trim();

      try {
        places = JSON.parse(jsonText);
      } catch (parseErr) {
        console.error("Failed to parse JSON, attempting regex extraction of array", parseErr);
        // Fallback to searching for outer bracket matching
        const bracketMatch = jsonText.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (bracketMatch) {
          try {
            places = JSON.parse(bracketMatch[0]);
          } catch (bracketErr) {
            throw new Error("Failed to parse array with bracket parsing");
          }
        } else {
          throw new Error("Could not extract clean JSON array");
        }
      }

      // Extract Grounding Chunks to associate real Google Maps Links!
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      console.log(`Found ${groundingChunks.length} grounding chunks.`);

      // Enrich parsed places with maps grounding URLs
      const enrichedPlaces = places.map((place: any, index: number) => {
        // Attempt to find a matching grounding chunk by name/title similarity
        let mapsUri = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name + " " + (place.address || ""))}`;
        
        // Find if a grounding chunk title matches
        const placeNameLower = place.name.toLowerCase();
        const matchedChunk = groundingChunks.find((chunk: any) => {
          if (chunk.maps?.title) {
            const chunkTitleLower = chunk.maps.title.toLowerCase();
            return chunkTitleLower.includes(placeNameLower) || placeNameLower.includes(chunkTitleLower);
          }
          return false;
        });

        if (matchedChunk && matchedChunk.maps?.uri) {
          mapsUri = matchedChunk.maps.uri;
        } else if (groundingChunks[index] && groundingChunks[index].maps?.uri) {
          // Fallback to sequential index match if similarity is low but indices align
          mapsUri = groundingChunks[index].maps.uri;
        }

        // Calculate a highly accurate fallback coordinate just in case Gemini gets it slightly wrong or leaves it out
        const itemLat = Number(place.latitude) || (lat + (index - 2) * 0.005 + (Math.random() - 0.5) * 0.001);
        const itemLng = Number(place.longitude) || (lng + (index - 2) * 0.005 + (Math.random() - 0.5) * 0.001);

        return {
          id: `place_${index}_${Date.now()}`,
          name: place.name,
          type: place.type || (preference === "hotels" ? "hotel" : "restaurant"),
          address: place.address || "Address available via maps",
          phone: place.phone || "No listed phone",
          openingHours: place.openingHours || (preference === "hotels" ? "Open 24/7" : "10:00 AM - 10:00 PM"),
          rating: place.rating || 4.2,
          reviewsCount: place.reviewsCount || Math.floor(Math.random() * 200) + 15,
          description: place.description || `Excellent choice located in ${location.city || "the selected area"}.`,
          cuisineType: place.cuisineType || cuisine,
          mapsUri,
          latitude: itemLat,
          longitude: itemLng
        };
      });

      return res.json({ places: enrichedPlaces, isMock: false });
    } else {
      // Throw mock error to jump to robust mock generation
      throw new Error("No Gemini API key defined");
    }

  } catch (err: any) {
    console.log("Grounding notice: Maps grounding tool was limited or unavailable. Transitioning to standard search fallback.");
    
    try {
      if (process.env.GEMINI_API_KEY) {
        const ai = getGeminiClient();
        // Try a standard content generation without Google Maps tool (which operates on free tier quota)
        const fallbackResponse = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: `${contentPrompt}\n\nIMPORTANT: Use your standard knowledge base to find actual, real places in this region. Return a JSON array matching the exact format.`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  name: { type: "STRING" },
                  type: { type: "STRING" },
                  address: { type: "STRING" },
                  phone: { type: "STRING" },
                  openingHours: { type: "STRING" },
                  rating: { type: "NUMBER" },
                  reviewsCount: { type: "NUMBER" },
                  description: { type: "STRING" },
                  cuisineType: { type: "STRING" },
                  latitude: { type: "NUMBER" },
                  longitude: { type: "NUMBER" }
                },
                required: ["name", "type", "address", "rating", "reviewsCount", "description", "cuisineType"]
              }
            }
          }
        });

        const text = fallbackResponse.text || "";
        console.log("Fallback standard Gemini search succeeded. Parsing fallback text...");
        let places = JSON.parse(text);

        if (Array.isArray(places) && places.length > 0) {
          // Enrich mapsUri
          const enrichedPlaces = places.map((place: any, index: number) => {
            const itemLat = Number(place.latitude) || (lat + (index - 2) * 0.005 + (Math.random() - 0.5) * 0.001);
            const itemLng = Number(place.longitude) || (lng + (index - 2) * 0.005 + (Math.random() - 0.5) * 0.001);

            return {
              id: `place_fallback_${index}_${Date.now()}`,
              name: place.name,
              type: place.type || (preference === "hotels" ? "hotel" : "restaurant"),
              address: place.address || "Address available via maps",
              phone: place.phone || "No listed phone",
              openingHours: place.openingHours || (preference === "hotels" ? "Open 24/7" : "10:00 AM - 10:00 PM"),
              rating: place.rating || 4.2,
              reviewsCount: place.reviewsCount || Math.floor(Math.random() * 200) + 15,
              description: place.description || `Excellent choice located in ${location.city || "the selected area"}.`,
              cuisineType: place.cuisineType || cuisine,
              mapsUri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name + " " + (place.address || ""))}`,
              latitude: itemLat,
              longitude: itemLng
            };
          });

          return res.json({ 
            places: enrichedPlaces, 
            isMock: false, 
            isSmartFallback: true, 
            errorDetail: err.message || String(err)
          });
        }
      }
      throw new Error("No key or invalid fallback format");
    } catch (fallbackErr: any) {
      console.log("Fallback notice: Standard search was not completed. Using robust local backup data.");
      
      const fallbackPlaces = getTailoredMockData(cuisine, preference, locationLabel, location.city || "Nilai");
      return res.json({ 
        places: fallbackPlaces, 
        isMock: true, 
        errorDetail: err.message || String(err),
        errorStack: err.stack || "",
        fallbackErrorDetail: fallbackErr.message || String(fallbackErr)
      });
    }
  }
});

// Helper function to produce highly accurate, realistic seed data tailored to user parameters
function getTailoredMockData(cuisine: string, preference: string, locationLabel: string, city: string): any[] {
  const isHotel = preference === "hotels";
  const cityKey = city ? city.toLowerCase().replace(/ /g, "_") : "";
  const coords = CITY_COORDS[cityKey] || { latitude: 2.8125, longitude: 101.7978 };
  const lat = coords.latitude;
  const lng = coords.longitude;
  
  if (isHotel) {
    // Tailor hotels to the city
    return [
      {
        id: "mock_h1",
        name: `${city} Grand Luxury Resort`,
        type: "hotel",
        address: `Lot 1024, Persiaran Pusat Bandar, ${city}, Malaysia`,
        phone: "+60 6-798 1111",
        openingHours: "Open 24 Hours",
        rating: 4.8,
        reviewsCount: 342,
        description: `Stunning 5-star resort boasting premium amenities, spa services, and a beautiful central dining courtyard inspired by fine global tastes. Perfect for a cozy stay.`,
        cuisineType: "Resort & Spa (Suites)",
        mapsUri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(city + " Grand Luxury Resort")}`,
        latitude: lat + 0.003,
        longitude: lng - 0.004
      },
      {
        id: "mock_h2",
        name: `The Heritage Boutique Hotel ${city}`,
        type: "hotel",
        address: `Jalan Bunga Raya 5, Seksyen 3, ${city}, Malaysia`,
        phone: "+60 6-798 2222",
        openingHours: "Open 24 Hours",
        rating: 4.5,
        reviewsCount: 189,
        description: `An elegant stay with unique interior styling merging food culture with modern hotel features. Offers complimentary gourmet breakfast and personalized room service.`,
        cuisineType: "Deluxe, Family Rooms",
        mapsUri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("The Heritage Boutique Hotel " + city)}`,
        latitude: lat - 0.005,
        longitude: lng + 0.005
      },
      {
        id: "mock_h3",
        name: `${city} Skyline Suites`,
        type: "hotel",
        address: `12A, Heights Avenue, Bandar Baru, ${city}, Malaysia`,
        phone: "+60 6-798 3333",
        openingHours: "Open 24 Hours",
        rating: 4.6,
        reviewsCount: 220,
        description: `Premium serviced suites with breathtaking city views, direct access to popular local dining, and high-speed executive facilities.`,
        cuisineType: "Executive Suites",
        mapsUri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(city + " Skyline Suites")}`,
        latitude: lat + 0.006,
        longitude: lng + 0.002
      },
      {
        id: "mock_h4",
        name: `Greenview Eco Lodge`,
        type: "hotel",
        address: `Batu 8, Kampung Baru Road, ${city}, Malaysia`,
        phone: "+60 6-798 4444",
        openingHours: "Open 24 Hours",
        rating: 4.3,
        reviewsCount: 112,
        description: `Enchanting eco-friendly lodging nestled in lush gardens, perfect for peaceful travelers seeking nature with direct gourmet cuisine options on-site.`,
        cuisineType: "Eco Cabins, Standard Rooms",
        mapsUri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("Greenview Eco Lodge " + city)}`,
        latitude: lat - 0.004,
        longitude: lng - 0.006
      },
      {
        id: "mock_h5",
        name: `Travelers Express Inn`,
        type: "hotel",
        address: `Pusat Komersial Nilai 3, ${city}, Malaysia`,
        phone: "+60 6-798 5555",
        openingHours: "Open 24 Hours",
        rating: 4.1,
        reviewsCount: 95,
        description: `Cozy, convenient transit-friendly hotel located within the bustling shopping and food retail hub of the district.`,
        cuisineType: "Standard, Twin Rooms",
        mapsUri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("Travelers Express Inn " + city)}`,
        latitude: lat + 0.001,
        longitude: lng - 0.002
      }
    ];
  } else {
    // Tailor restaurants to the chosen country/cuisine and city!
    return [
      {
        id: "mock_r1",
        name: `${cuisine} Heritage Restaurant`,
        type: "restaurant",
        address: `24, Jalan Nilai Gemilang 2, ${city}, Malaysia`,
        phone: "+60 6-799 1234",
        openingHours: "11:00 AM - 10:00 PM",
        rating: 4.7,
        reviewsCount: 450,
        description: `Famous culinary spot in ${city} serving exceptionally authentic ${cuisine} dishes, cooked with imported herbs and generations of tradition. Extremely highly rated for rich flavor and cozy atmosphere.`,
        cuisineType: cuisine,
        mapsUri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cuisine + " Heritage Restaurant " + city)}`,
        latitude: lat + 0.005,
        longitude: lng - 0.005
      },
      {
        id: "mock_r2",
        name: `Al-Malik ${cuisine} Kitchen`,
        type: "restaurant",
        address: `Plot 5, Commercial Square, Bandar Baru, ${city}, Malaysia`,
        phone: "+60 6-799 5678",
        openingHours: "12:00 PM - 11:00 PM",
        rating: 4.5,
        reviewsCount: 280,
        description: `Comfortable dining outlet specializing in savory, grilled specialities of the ${cuisine} tradition. Highly recommended for family events and large dining gatherings.`,
        cuisineType: cuisine,
        mapsUri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("Al-Malik " + cuisine + " Kitchen " + city)}`,
        latitude: lat - 0.004,
        longitude: lng + 0.007
      },
      {
        id: "mock_r3",
        name: `The ${cuisine} Cozy Corner`,
        type: "restaurant",
        address: `99, Heights Walkway, ${city}, Malaysia`,
        phone: "+60 6-799 9012",
        openingHours: "10:00 AM - 10:00 PM",
        rating: 4.6,
        reviewsCount: 167,
        description: `A highly aesthetic, Instagram-friendly cafe and bistro serving premium ${cuisine}-infused fusion dishes, speciality coffees, and artisanal pastries.`,
        cuisineType: cuisine,
        mapsUri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("The " + cuisine + " Cozy Corner " + city)}`,
        latitude: lat + 0.008,
        longitude: lng + 0.002
      },
      {
        id: "mock_r4",
        name: `Spice Oasis ${cuisine} Eatery`,
        type: "restaurant",
        address: `Lot 18, Ground Floor, Nilai Avenue, ${city}, Malaysia`,
        phone: "+60 6-799 3456",
        openingHours: "11:30 AM - 11:00 PM",
        rating: 4.4,
        reviewsCount: 215,
        description: `A local favorite for high-quality, aromatic ${cuisine} street food, curries, and regional specialties at a budget-friendly price point.`,
        cuisineType: cuisine,
        mapsUri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("Spice Oasis " + cuisine + " Eatery " + city)}`,
        latitude: lat - 0.006,
        longitude: lng - 0.008
      },
      {
        id: "mock_r5",
        name: `Royal ${cuisine} Palace`,
        type: "restaurant",
        address: `Suite 1-1, Boulevard Heights, ${city}, Malaysia`,
        phone: "+60 6-799 7890",
        openingHours: "5:00 PM - 11:30 PM",
        rating: 4.8,
        reviewsCount: 134,
        description: `Premium, fine-dining environment serving luxurious recipe versions of traditional ${cuisine} food. Boasts stunning modern room decor and exquisite service.`,
        cuisineType: cuisine,
        mapsUri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("Royal " + cuisine + " Palace " + city)}`,
        latitude: lat + 0.002,
        longitude: lng - 0.003
      }
    ];
  }
}

// -------------------------------------------------------------
// Health & Food AI Assistant Chat Streaming Endpoint
// -------------------------------------------------------------

app.post("/api/ai/chat", async (req, res) => {
  const { messages } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Messages array is required" });
  }

  // Set SSE response headers for real-time response streaming
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  if (typeof (res as any).flushHeaders === "function") {
    (res as any).flushHeaders();
  }

  const SYSTEM_INSTRUCTION = "You are a friendly health and food assistant inside the FOOD & STAY HUB app. Help users with health tips, nutrition guidance, healthy food choices, general wellness questions, and basic help using the app (ordering, customizing dishes, delivery, payment). Keep answers short, practical, and easy to read. You are not a medical professional — for serious medical concerns, advise the user to consult a doctor.";

  try {
    // Sanitize and format context window (last 10 messages)
    const formattedContents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];

    for (const msg of messages.slice(-10)) {
      if (!msg || typeof msg.content !== "string" || !msg.content.trim()) continue;
      const role: "user" | "model" = msg.role === "assistant" || msg.role === "model" ? "model" : "user";

      // Combine consecutive turns with the same role to strictly alternate
      if (formattedContents.length > 0 && formattedContents[formattedContents.length - 1].role === role) {
        formattedContents[formattedContents.length - 1].parts[0].text += `\n${msg.content.trim()}`;
      } else {
        formattedContents.push({
          role,
          parts: [{ text: msg.content.trim() }]
        });
      }
    }

    // Gemini API requires the first turn to be 'user'
    while (formattedContents.length > 0 && formattedContents[0].role !== "user") {
      formattedContents.shift();
    }

    if (formattedContents.length === 0) {
      res.write(`data: ${JSON.stringify({ text: "Hi! Ask me anything about healthy eating, nutrition, or how to use the app." })}\n\n`);
      res.write("data: [DONE]\n\n");
      return res.end();
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      const ai = getGeminiClient();
      const responseStream = await ai.models.generateContentStream({
        model: "gemini-3.8-flash",
        contents: formattedContents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
        },
      });

      for await (const chunk of responseStream) {
        const text = chunk.text;
        if (text) {
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
      }

      res.write("data: [DONE]\n\n");
      res.end();
    } else {
      // Smart Fallback when GEMINI_API_KEY is not configured
      const lastUserMsg = formattedContents[formattedContents.length - 1]?.parts[0]?.text?.toLowerCase() || "";
      let reply = "I'm your FOOD & STAY HUB Health & Nutrition Assistant! Here are some key tips:\n\n• **Balanced Nutrition**: Aim for 1/2 plate fresh greens, 1/4 plate lean protein, and 1/4 whole grains in your daily meals.\n• **Custom Dish Recipes**: In our app, you can customize spice level, reduce cooking oils, or exclude allergens for any dish.\n• **Hydration**: Drink 2 to 3 liters of water throughout the day to support vitality and digestion.\n\nWhat other health or food questions can I assist you with?";

      if (lastUserMsg.includes("order") || lastUserMsg.includes("track") || lastUserMsg.includes("delivery") || lastUserMsg.includes("cart") || lastUserMsg.includes("pay")) {
        reply = "Here's a quick guide to using the app:\n\n1. **Order Food**: Tap **Order Food** in the top menu to view restaurants and menus.\n2. **Custom Recipes**: Tap 'Customize' on any dish to tweak spice, oil, or remove allergens.\n3. **Delivery & Payment**: Enter your address in the checkout drawer, choose standard or express delivery, and pick cash, card, or FPX online banking.\n4. **Track Live**: Watch status updates in real time under **My Orders**!";
      } else if (lastUserMsg.includes("calorie") || lastUserMsg.includes("weight") || lastUserMsg.includes("fat") || lastUserMsg.includes("loss")) {
        reply = "For sustainable weight and calorie management:\n\n• Focus on nutrient density over strict restriction — whole vegetables, legumes, and lean proteins keep you satisfied longer.\n• Request dishes steamed, grilled, or with light sauce when ordering.\n• Remember, consistency is key! If you have specific medical dietary goals, consult a registered dietitian.";
      } else if (lastUserMsg.includes("vegetar") || lastUserMsg.includes("vegan") || lastUserMsg.includes("plant")) {
        reply = "Great choice! Plant-rich diets support heart health and digestion. Look for dishes featuring tofu, tempeh, lentils, chickpeas, or fresh vegetables. In our app, you can customize dishes to remove dairy and meat broth!";
      } else if (lastUserMsg.includes("diabet") || lastUserMsg.includes("sugar") || lastUserMsg.includes("carb")) {
        reply = "For healthy blood sugar balance, pair carbohydrates with fiber, healthy fats, or protein. Opt for brown rice, quinoa, and non-starchy vegetables. Minimize sweetened sauces and sodas. Always follow your physician's medical guidance for medical conditions.";
      }

      const words = reply.split(" ");
      for (let i = 0; i < words.length; i += 3) {
        const chunkText = words.slice(i, i + 3).join(" ") + " ";
        res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
        await new Promise((resolve) => setTimeout(resolve, 30));
      }
      res.write("data: [DONE]\n\n");
      res.end();
    }
  } catch (err: any) {
    console.error("AI Assistant Chat error:", err);
    res.write(`data: ${JSON.stringify({ error: "Something went wrong, please try again." })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

// -------------------------------------------------------------
// Vite Middleware & SPA serving
// -------------------------------------------------------------

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Global Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Unhandled Server Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Vercel imports this module as a serverless handler. Only open a listening
// socket when this file is executed directly by the local/production scripts.
const isDirectRun = process.argv[1]
  ? path.resolve(process.argv[1]) === path.resolve(__filename)
  : false;

if (isDirectRun) {
  startServer().catch((err) => {
    console.error("Failed to start server:", err);
  });
}

export default app;
