const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 6050;

const RAPIDAPI_HOST = "tecdoc-catalog.p.rapidapi.com";
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || "PUT_YOUR_KEY_HERE";

// Change this value if your RapidAPI docs show a different parts endpoint.
const PARTS_ENDPOINT_TEMPLATE =
  process.env.TECDOC_PARTS_ENDPOINT ||
  "/category/type-id/1/products-groups-variant-1/{vehicleId}/lang-id/4";
let latestMostCommonOems = [];
let latestMostCommonOemsUpdatedAt = null;

app.use(cors());
app.use(express.json());

const frontendPath = path.join(__dirname, "..", "frontend");
app.use(express.static(frontendPath));

function getHeaders() {
  return {
    "x-rapidapi-key": RAPIDAPI_KEY,
    "x-rapidapi-host": RAPIDAPI_HOST,
    "Content-Type": "application/json",
  };
}

async function requestRapidApi(pathname) {
  const url = `https://${RAPIDAPI_HOST}${pathname}`;
  const response = await fetch(url, { method: "GET", headers: getHeaders() });
  const body = await response.text();
  let json = null;

  try {
    json = JSON.parse(body);
  } catch {
    json = { raw: body };
  }

  return {
    ok: response.ok,
    status: response.status,
    data: json,
    requestUrl: url,
  };
}

async function requestRapidApiPost(pathname, bodyObj) {
  const url = `https://${RAPIDAPI_HOST}${pathname}`;
  const response = await fetch(url, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(bodyObj),
  });
  const body = await response.text();
  let json = null;

  try {
    json = JSON.parse(body);
  } catch {
    json = { raw: body };
  }

  return {
    ok: response.ok,
    status: response.status,
    data: json,
    requestUrl: url,
  };
}

function normalizeOemDisplayNo(value) {
  if (value == null) return "";
  return String(value).replace(/\s+/g, "").trim();
}

function computeMostCommonOems(payload, limit = 4) {
  const articles = payload?.articles;
  if (!Array.isArray(articles) || !articles.length) return [];

  const counts = new Map();
  for (const article of articles) {
    const oems = article?.oemNo;
    if (!Array.isArray(oems)) continue;
    for (const oem of oems) {
      const key = normalizeOemDisplayNo(oem?.oemDisplayNo);
      if (!key) continue;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort(
      (a, b) =>
        b[1] - a[1] ||
        a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: "base" })
    )
    .slice(0, limit)
    .map(([oemDisplayNo, count]) => ({ oemDisplayNo, count }));
}

app.get("/api/vin/:vin", async (req, res) => {
  try {
    if (RAPIDAPI_KEY === "PUT_YOUR_KEY_HERE") {
      return res.status(400).json({
        error: "Set RAPIDAPI_KEY in environment before calling API.",
      });
    }

    const { vin } = req.params;
    const rapidResult = await requestRapidApi(`/vin/tecdoc-vin-check/${vin}`);

    if (!rapidResult.ok) {
      return res.status(rapidResult.status).json({
        error: "VIN lookup failed.",
        rapidapi: rapidResult.data,
      });
    }

    const modelName =
      rapidResult.data?.data?.matchingModels?.array?.[0]?.modelName || null;
    const carName =
      rapidResult.data?.data?.matchingVehicles?.array?.[0]?.carName || null;
    const vehicleId =
      rapidResult.data?.data?.matchingVehicles?.array?.[0]?.vehicleId || null;

    return res.json({
      modelName,
      carName,
      vehicleId,
      raw: rapidResult.data,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Server error while checking VIN.",
      details: error.message,
    });
  }
});

app.get("/api/parts/:vehicleId", async (req, res) => {
  try {
    if (RAPIDAPI_KEY === "PUT_YOUR_KEY_HERE") {
      return res.status(400).json({
        error: "Set RAPIDAPI_KEY in environment before calling API.",
      });
    }

    const { vehicleId } = req.params;
    const configuredPath = PARTS_ENDPOINT_TEMPLATE.replace("{vehicleId}", vehicleId);
    const candidatePaths = [
      configuredPath,
      `/category/type-id/1/products-groups-variant-1/${vehicleId}/lang-id/4`,
      `/articles/tecdoc-article-search-by-vehicle-id/${vehicleId}`,
      `/articles/tecdoc-article-search-by-vehicle-id?vehicleId=${vehicleId}`,
      `/articles/tecdoc-article-search-by-linkage-target-id/${vehicleId}`,
      `/articles/tecdoc-article-search-by-linkage-target-id?linkageTargetId=${vehicleId}`,
      `/articles/tecdoc-article-search?vehicleId=${vehicleId}`,
      `/articles/tecdoc-article-search?linkageTargetId=${vehicleId}`,
    ];

    let lastResult = null;
    const tried = [];

    for (const path of candidatePaths) {
      const rapidResult = await requestRapidApi(path);
      tried.push(path);
      lastResult = rapidResult;
      if (rapidResult.ok) {
        // Endpoint response format can differ by operation, so forward as-is.
        return res.json({
          endpointUsed: path,
          data: rapidResult.data,
        });
      }
    }

    return res.status(lastResult?.status || 400).json({
      error:
        "Parts lookup failed for all known endpoint patterns. Set TECDOC_PARTS_ENDPOINT to the exact route from your RapidAPI docs.",
      endpointsTried: tried,
      rapidapi: lastResult?.data || null,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Server error while loading parts.",
      details: error.message,
    });
  }
});

app.get("/api/articles/:vehicleId/:categoryId", async (req, res) => {
  try {
    if (RAPIDAPI_KEY === "PUT_YOUR_KEY_HERE") {
      return res.status(400).json({
        error: "Set RAPIDAPI_KEY in environment before calling API.",
      });
    }

    const { vehicleId, categoryId } = req.params;
    const langId = process.env.TECDOC_LANG_ID || "4";
    const typeId = process.env.TECDOC_TYPE_ID || "1";
    const pathName = `/articles/list/type-id/${typeId}/vehicle-id/${vehicleId}/category-id/${categoryId}/lang-id/${langId}`;
    const rapidResult = await requestRapidApi(pathName);

    if (!rapidResult.ok) {
      return res.status(rapidResult.status).json({
        error: "Articles list failed.",
        endpointTried: pathName,
        rapidapi: rapidResult.data,
      });
    }

    return res.json({
      endpointUsed: pathName,
      ...rapidResult.data,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Server error while loading articles.",
      details: error.message,
    });
  }
});

app.post("/api/oems", async (req, res) => {
  try {
    if (RAPIDAPI_KEY === "PUT_YOUR_KEY_HERE") {
      return res.status(400).json({
        error: "Set RAPIDAPI_KEY in environment before calling API.",
      });
    }

    const { articleIds } = req.body;
    if (!Array.isArray(articleIds) || articleIds.length === 0) {
      return res.status(400).json({
        error: "Request body must include a non-empty articleIds array.",
      });
    }

    const ids = articleIds
      .map((id) => Number(id))
      .filter((n) => Number.isFinite(n) && n > 0);

    if (!ids.length) {
      return res.status(400).json({
        error: "articleIds must contain valid numeric article IDs.",
      });
    }

    const rapidResult = await requestRapidApiPost(
      "/articles/get-oems-by-list-of-articles-ids",
      { articleIds: ids }
    );

    if (!rapidResult.ok) {
      return res.status(rapidResult.status).json({
        error: "OEM lookup failed.",
        rapidapi: rapidResult.data,
      });
    }

    latestMostCommonOems = computeMostCommonOems(rapidResult.data, 4);
    latestMostCommonOemsUpdatedAt = new Date().toISOString();

    return res.json({
      endpointUsed: "/articles/get-oems-by-list-of-articles-ids",
      mostCommonOemNumbers: latestMostCommonOems,
      mostCommonOemNumbersUpdatedAt: latestMostCommonOemsUpdatedAt,
      ...rapidResult.data,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Server error while loading OEMs.",
      details: error.message,
    });
  }
});

app.get("/api/oems/common", (_req, res) => {
  return res.json({
    mostCommonOemNumbers: latestMostCommonOems,
    updatedAt: latestMostCommonOemsUpdatedAt,
  });
});

app.use((_req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
