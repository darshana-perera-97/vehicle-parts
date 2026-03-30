import { useEffect, useMemo, useRef, useState } from "react";

const API_BASE = window.location.port === "3000" ? "http://localhost:6050" : "";
const ARTICLE_COLUMNS = [
  "articleId",
  "articleNo",
  "productId",
  "articleProductName",
  "s3image",
];

const STEP_ITEMS = [
  { id: 1, label: "VIN" },
  { id: 2, label: "Parts" },
  { id: 3, label: "Articles" },
  { id: 4, label: "OEMs" },
  { id: 5, label: "Web Links" },
];

function StepCard({ step, title, subtitle, active, children }) {
  return (
    <section
      className={`rounded-3xl border bg-white/95 p-6 shadow-[0_10px_40px_rgba(15,23,42,0.08)] backdrop-blur transition md:p-8 ${
        active ? "border-slate-300 ring-2 ring-slate-200" : "border-slate-100"
      }`}
    >
      <div className="mb-6 flex items-center gap-3">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${
            active ? "bg-slate-900 text-white shadow-lg shadow-slate-300/70" : "bg-slate-100 text-slate-700"
          }`}
        >
          {step}
        </div>
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h2>
          {!!subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function App() {
  const [currentStep, setCurrentStep] = useState(1);
  const [vin, setVin] = useState("WDBFA68F42F202731");
  const [vinData, setVinData] = useState({ modelName: "-", carName: "-", vehicleId: "-" });
  const [vinError, setVinError] = useState("");
  const [vinStepComplete, setVinStepComplete] = useState(false);

  const [vehicleIdInput, setVehicleIdInput] = useState("");
  const [partsError, setPartsError] = useState("");
  const [partsMeta, setPartsMeta] = useState("No parts loaded yet.");
  const [partsColumns, setPartsColumns] = useState([]);
  const [partsRows, setPartsRows] = useState([]);
  const [selectedCategory1, setSelectedCategory1] = useState("");
  const [selectedCategory2, setSelectedCategory2] = useState("");
  const [selectedCategory3, setSelectedCategory3] = useState("");
  const [selectedCategory4, setSelectedCategory4] = useState("");

  const [articlesVehicleId, setArticlesVehicleId] = useState("");
  const [articlesCategoryId, setArticlesCategoryId] = useState("");
  const [articlesError, setArticlesError] = useState("");
  const [articlesMeta, setArticlesMeta] = useState("No articles loaded yet.");
  const [articlesRows, setArticlesRows] = useState([]);
  const [articlesCopyStatus, setArticlesCopyStatus] = useState("");

  const [oemArticleIds, setOemArticleIds] = useState("");
  const [oemError, setOemError] = useState("");
  const [oemMeta, setOemMeta] = useState("No OEM data loaded yet.");
  const [oemRows, setOemRows] = useState([]);
  const [savedMostCommonOems, setSavedMostCommonOems] = useState([]);
  const [savedMostCommonOemsUpdatedAt, setSavedMostCommonOemsUpdatedAt] = useState(null);
  const [savedMostCommonOemsError, setSavedMostCommonOemsError] = useState("");
  const [filteredWebLinkItems, setFilteredWebLinkItems] = useState([]);
  const [changedUrlWebLinkItems, setChangedUrlWebLinkItems] = useState([]);
  const [webLinksLoading, setWebLinksLoading] = useState(false);
  const [webLinksFilterError, setWebLinksFilterError] = useState("");
  const [removedLinksCount, setRemovedLinksCount] = useState(0);
  const prevStepRef = useRef(currentStep);

  const topOems = useMemo(() => {
    const counts = new Map();
    for (const row of oemRows) {
      const no = row?.oemDisplayNo;
      if (!no || no === "-") continue;
      counts.set(no, (counts.get(no) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], undefined, { numeric: true }))
      .slice(0, 4);
  }, [oemRows]);

  const webLinkItems = useMemo(() => {
    const uniqueOemNos = Array.from(
      new Set(
        oemRows
          .map((row) => row?.oemDisplayNo)
          .filter((value) => typeof value === "string" && value.trim() && value !== "-")
      )
    ).slice(0, 40);

    const articleIds = Array.from(
      new Set(
        articlesRows
          .map((row) => row?.articleId)
          .filter((value) => value !== null && value !== undefined && value !== "")
      )
    ).slice(0, 40);

    const oemLinks = uniqueOemNos.map((oemNo) => ({
      label: `OEM ${oemNo}`,
      url: `https://autobahntraders.com/?s=${encodeURIComponent(oemNo)}&post_type=product`,
    }));

    const articleLinks = articleIds.map((articleId) => ({
      label: `Article ${articleId}`,
      url: `https://autobahntraders.com/?s=${encodeURIComponent(
        String(articleId)
      )}&post_type=product`,
    }));

    return [...oemLinks, ...articleLinks];
  }, [oemRows, articlesRows]);

  const uniqueChangedUrlWebLinkItems = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const item of changedUrlWebLinkItems) {
      const loaded = String(item.finalUrl || item.url || "").trim();
      if (!loaded || seen.has(loaded)) continue;
      seen.add(loaded);
      out.push(item);
    }
    return out;
  }, [changedUrlWebLinkItems]);

  useEffect(() => {
    if (currentStep !== 5) return;

    async function loadSavedMostCommonOems() {
      setSavedMostCommonOemsError("");
      try {
        const res = await fetch(`${API_BASE}/api/oems/common`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to load saved OEM summary.");
        }
        setSavedMostCommonOems(Array.isArray(data.mostCommonOemNumbers) ? data.mostCommonOemNumbers : []);
        setSavedMostCommonOemsUpdatedAt(data.updatedAt || null);
      } catch (error) {
        setSavedMostCommonOemsError(error.message);
      }
    }

    loadSavedMostCommonOems();
  }, [currentStep]);

  useEffect(() => {
    if (currentStep !== 5) return;
    if (!webLinkItems.length) {
      setFilteredWebLinkItems([]);
      setChangedUrlWebLinkItems([]);
      setRemovedLinksCount(0);
      setWebLinksFilterError("");
      return;
    }

    let active = true;
    async function filterLinksAgainstAutobahnPages() {
      setWebLinksLoading(true);
      setWebLinksFilterError("");
      try {
        const res = await fetch(`${API_BASE}/api/web-links/filter-valid`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: webLinkItems }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to filter web links.");
        }
        if (!active) return;
        setFilteredWebLinkItems(Array.isArray(data.validItems) ? data.validItems : []);
        setChangedUrlWebLinkItems(
          Array.isArray(data.changedUrlItems) ? data.changedUrlItems : []
        );
        const removed = Array.isArray(data.removedItems) ? data.removedItems.length : 0;
        setRemovedLinksCount(removed);
      } catch (error) {
        if (!active) return;
        setWebLinksFilterError(error.message);
        // Fail open so user still sees links if filter endpoint fails.
        setFilteredWebLinkItems(webLinkItems);
        setChangedUrlWebLinkItems([]);
        setRemovedLinksCount(0);
      } finally {
        if (active) setWebLinksLoading(false);
      }
    }

    filterLinksAgainstAutobahnPages();
    return () => {
      active = false;
    };
  }, [currentStep, webLinkItems]);

  const category1Options = useMemo(() => {
    return Array.from(
      new Set(
        partsRows
          .map((row) => row?.categoryName1)
          .filter((value) => typeof value === "string" && value.trim())
      )
    );
  }, [partsRows]);

  const category2Options = useMemo(() => {
    if (!selectedCategory1) return [];
    return Array.from(
      new Set(
        partsRows
          .filter((row) => row?.categoryName1 === selectedCategory1)
          .map((row) => row?.categoryName2)
          .filter((value) => typeof value === "string" && value.trim())
      )
    );
  }, [partsRows, selectedCategory1]);

  const category3Options = useMemo(() => {
    if (!selectedCategory1 || !selectedCategory2) return [];
    return Array.from(
      new Set(
        partsRows
          .filter(
            (row) =>
              row?.categoryName1 === selectedCategory1 &&
              row?.categoryName2 === selectedCategory2
          )
          .map((row) => row?.categoryName3)
          .filter((value) => typeof value === "string" && value.trim())
      )
    );
  }, [partsRows, selectedCategory1, selectedCategory2]);

  const category4Options = useMemo(() => {
    if (!selectedCategory1 || !selectedCategory2 || !selectedCategory3) return [];
    return Array.from(
      new Set(
        partsRows
          .filter(
            (row) =>
              row?.categoryName1 === selectedCategory1 &&
              row?.categoryName2 === selectedCategory2 &&
              row?.categoryName3 === selectedCategory3
          )
          .map((row) => row?.categoryName4)
          .filter((value) => typeof value === "string" && value.trim())
      )
    );
  }, [partsRows, selectedCategory1, selectedCategory2, selectedCategory3]);

  const filteredPartsRows = useMemo(() => {
    return partsRows.filter((row) => {
      if (selectedCategory1 && row?.categoryName1 !== selectedCategory1) return false;
      if (selectedCategory2 && row?.categoryName2 !== selectedCategory2) return false;
      if (selectedCategory3 && row?.categoryName3 !== selectedCategory3) return false;
      if (selectedCategory4 && row?.categoryName4 !== selectedCategory4) return false;
      return true;
    });
  }, [partsRows, selectedCategory1, selectedCategory2, selectedCategory3, selectedCategory4]);

  const topCategoryRows = useMemo(() => {
    const map = new Map();
    for (const row of partsRows) {
      const name = row?.categoryName1;
      const id = row?.categoryId1;
      if ((name == null || name === "") && (id == null || id === "")) continue;
      const key = `${String(id ?? "")}::${String(name ?? "")}`;
      if (!map.has(key)) {
        map.set(key, {
          categoryName1: name ?? "-",
          categoryId1: id ?? "-",
        });
      }
    }
    return Array.from(map.values());
  }, [partsRows]);

  const secondCategoryRows = useMemo(() => {
    if (!selectedCategory1) return [];
    const map = new Map();
    for (const row of partsRows) {
      if (row?.categoryName1 !== selectedCategory1) continue;
      const name = row?.categoryName2;
      const id = row?.categoryId2;
      if ((name == null || name === "") && (id == null || id === "")) continue;
      const key = `${String(id ?? "")}::${String(name ?? "")}`;
      if (!map.has(key)) {
        map.set(key, {
          categoryName2: name ?? "-",
          categoryId2: id ?? "-",
        });
      }
    }
    return Array.from(map.values());
  }, [partsRows, selectedCategory1]);

  const thirdCategoryRows = useMemo(() => {
    if (!selectedCategory1 || !selectedCategory2) return [];
    const map = new Map();
    for (const row of partsRows) {
      if (row?.categoryName1 !== selectedCategory1 || row?.categoryName2 !== selectedCategory2) {
        continue;
      }
      const name = row?.categoryName3;
      const id = row?.categoryId3;
      if ((name == null || name === "") && (id == null || id === "")) continue;
      const key = `${String(id ?? "")}::${String(name ?? "")}`;
      if (!map.has(key)) {
        map.set(key, {
          categoryName3: name ?? "-",
          categoryId3: id ?? "-",
        });
      }
    }
    return Array.from(map.values());
  }, [partsRows, selectedCategory1, selectedCategory2]);

  const selectedSecondCategoryRows = useMemo(() => {
    if (!selectedCategory1 || !selectedCategory2) return [];
    const map = new Map();
    for (const row of partsRows) {
      if (row?.categoryName1 !== selectedCategory1 || row?.categoryName2 !== selectedCategory2) {
        continue;
      }
      const name = row?.categoryName2;
      const id = row?.categoryId2;
      if ((name == null || name === "") && (id == null || id === "")) continue;
      const key = `${String(id ?? "")}::${String(name ?? "")}`;
      if (!map.has(key)) {
        map.set(key, {
          categoryName2: name ?? "-",
          categoryId2: id ?? "-",
        });
      }
    }
    return Array.from(map.values());
  }, [partsRows, selectedCategory1, selectedCategory2]);

  const fourthCategoryRows = useMemo(() => {
    if (!selectedCategory1 || !selectedCategory2 || !selectedCategory3) return [];
    const map = new Map();
    for (const row of partsRows) {
      if (
        row?.categoryName1 !== selectedCategory1 ||
        row?.categoryName2 !== selectedCategory2 ||
        row?.categoryName3 !== selectedCategory3
      ) {
        continue;
      }
      const name = row?.categoryName4;
      const id = row?.categoryId4;
      if ((name == null || name === "") && (id == null || id === "")) continue;
      const key = `${String(id ?? "")}::${String(name ?? "")}`;
      if (!map.has(key)) {
        map.set(key, {
          categoryName4: name ?? "-",
          categoryId4: id ?? "-",
        });
      }
    }
    return Array.from(map.values());
  }, [partsRows, selectedCategory1, selectedCategory2, selectedCategory3]);

  const selectedCategoryIdForArticles = useMemo(() => {
    const firstMatchedRow = filteredPartsRows[0];
    if (!firstMatchedRow) return "";
    if (selectedCategory4) return String(firstMatchedRow?.categoryId4 ?? "");
    if (selectedCategory3) return String(firstMatchedRow?.categoryId3 ?? "");
    if (selectedCategory2) return String(firstMatchedRow?.categoryId2 ?? "");
    if (selectedCategory1) return String(firstMatchedRow?.categoryId1 ?? "");
    return "";
  }, [
    filteredPartsRows,
    selectedCategory1,
    selectedCategory2,
    selectedCategory3,
    selectedCategory4,
  ]);

  async function checkVin() {
    setVinError("");
    setVinStepComplete(false);
    setVinData({ modelName: "-", carName: "-", vehicleId: "-" });
    const value = vin.trim();
    if (!value) {
      setVinError("Please enter a VIN.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/vin/${encodeURIComponent(value)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "VIN request failed.");

      const vehicleId = data.vehicleId || "-";
      setVinData({
        modelName: data.modelName || "-",
        carName: data.carName || "-",
        vehicleId,
      });
      const validId = vehicleId && vehicleId !== "-";
      setVinStepComplete(!!validId);
      if (validId) {
        setVehicleIdInput(String(vehicleId));
        setArticlesVehicleId(String(vehicleId));
      }
    } catch (error) {
      setVinError(error.message);
    }
  }

  function toRowsFromObjectArray(arr) {
    if (!Array.isArray(arr) || !arr.length || typeof arr[0] !== "object") return null;
    return arr;
  }

  function findFirstObjectArrayDeep(value, path = "root", depth = 0) {
    if (depth > 7 || value === null || value === undefined) return null;
    if (Array.isArray(value)) {
      if (value.length && typeof value[0] === "object" && value[0] !== null) {
        return { rows: value, sourcePath: path };
      }
      return null;
    }
    if (typeof value !== "object") return null;

    for (const [key, child] of Object.entries(value)) {
      const found = findFirstObjectArrayDeep(child, `${path}.${key}`, depth + 1);
      if (found) return found;
    }
    return null;
  }

  function extractPartsRows(payload) {
    const candidates = [
      payload?.data?.array,
      payload?.data?.data?.array,
      payload?.data?.articles?.array,
      payload?.data?.products?.array,
      payload?.data?.items,
      payload?.data?.data,
      payload?.data,
    ];

    for (const candidate of candidates) {
      const rows = toRowsFromObjectArray(candidate);
      if (rows) return { rows, sourcePath: "known-candidate" };
    }

    const deepFound = findFirstObjectArrayDeep(payload?.data, "data");
    if (deepFound) return deepFound;
    return { rows: [], sourcePath: null };
  }

  async function loadParts() {
    setPartsError("");
    setPartsMeta("Loading...");
    setPartsColumns([]);
    setPartsRows([]);
    setSelectedCategory1("");
    setSelectedCategory2("");
    setSelectedCategory3("");
    setSelectedCategory4("");

    const vehicleId = vehicleIdInput.trim();
    if (!vehicleId) {
      setPartsError("Please enter a vehicle ID.");
      setPartsMeta("No parts loaded yet.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/parts/${encodeURIComponent(vehicleId)}`);
      const data = await res.json();
      if (!res.ok) {
        const endpointInfo = data.endpointTried
          ? ` Endpoint tried: ${data.endpointTried}`
          : data.endpointsTried
            ? ` Endpoints tried: ${data.endpointsTried.join(", ")}`
            : "";
        throw new Error(`${data.error || "Parts request failed."}${endpointInfo}`);
      }

      const extracted = extractPartsRows(data);
      const rows = extracted.rows || [];
      if (!rows.length) {
        setPartsMeta("No part rows found in response. API returned data in a different format.");
        return;
      }

      const priority = [
        "articleNo",
        "articleNumber",
        "brandName",
        "manufacturerName",
        "genericArticleName",
        "articleName",
        "description",
        "oeNumber",
        "matchCode",
      ];

      const allKeys = Array.from(
        rows.reduce((set, row) => {
          Object.keys(row || {}).forEach((key) => set.add(key));
          return set;
        }, new Set())
      );
      const columns = [
        ...priority.filter((key) => allKeys.includes(key)),
        ...allKeys.filter((key) => !priority.includes(key)),
      ];

      setPartsColumns(columns);
      setPartsRows(rows);
      setPartsMeta(
        `Showing ${rows.length} rows and ${columns.length} columns.${extracted.sourcePath ? ` Source: ${extracted.sourcePath}.` : ""}`
      );
    } catch (error) {
      setPartsError(error.message);
      setPartsMeta("No parts loaded yet.");
    }
  }

  useEffect(() => {
    if (currentStep === 2) {
      const id = vehicleIdInput.trim();
      if (id && prevStepRef.current !== 2) {
        void loadParts();
      }
    }
    prevStepRef.current = currentStep;
  }, [currentStep, vehicleIdInput]);

  async function loadArticles() {
    setArticlesError("");
    setArticlesMeta("Loading...");
    setArticlesRows([]);
    setArticlesCopyStatus("");

    const vehicleId = articlesVehicleId.trim();
    const categoryId = articlesCategoryId.trim();
    if (!vehicleId || !categoryId) {
      setArticlesMeta("No articles loaded yet.");
      setArticlesError("Enter both Vehicle ID and Category ID.");
      return;
    }

    try {
      const res = await fetch(
        `${API_BASE}/api/articles/${encodeURIComponent(vehicleId)}/${encodeURIComponent(categoryId)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Articles request failed.");

      const list = Array.isArray(data.articles) ? data.articles : [];
      setArticlesRows(list);
      setArticlesMeta(list.length ? `Showing ${list.length} articles.` : "No articles in response.");
    } catch (error) {
      setArticlesMeta("No articles loaded yet.");
      setArticlesError(error.message);
    }
  }

  async function copyArticleIdsToClipboard() {
    setArticlesCopyStatus("");
    if (!articlesRows.length) {
      setArticlesCopyStatus("Load articles first.");
      return;
    }
    const text = articlesRows
      .map((row) => row?.articleId)
      .filter((id) => id !== null && id !== undefined && id !== "")
      .join(", ");
    if (!text) {
      setArticlesCopyStatus("No articleId values in table.");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setArticlesCopyStatus("Copied.");
      window.setTimeout(() => setArticlesCopyStatus(""), 2000);
    } catch {
      setArticlesCopyStatus("Clipboard blocked by browser.");
    }
  }

  function parseArticleIdsInput(raw) {
    return raw
      .split(/[\s,;]+/)
      .map((part) => Number(part.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
  }

  function flattenOemRows(apiResponse) {
    const articles = apiResponse?.articles;
    if (!Array.isArray(articles)) return [];
    const rows = [];
    for (const article of articles) {
      const articleId = article?.articleId ?? "-";
      const oems = article?.oemNo;
      if (!Array.isArray(oems) || !oems.length) {
        rows.push({ articleId, oemBrand: "-", oemDisplayNo: "-" });
        continue;
      }
      for (const oem of oems) {
        rows.push({
          articleId,
          oemBrand: oem?.oemBrand ?? "-",
          oemDisplayNo: oem?.oemDisplayNo ? String(oem.oemDisplayNo).replace(/\s+/g, "") : "-",
        });
      }
    }
    return rows;
  }

  async function loadOems() {
    setOemError("");
    setOemMeta("Loading...");
    setOemRows([]);

    const articleIds = parseArticleIdsInput(oemArticleIds.trim());
    if (!articleIds.length) {
      setOemMeta("No OEM data loaded yet.");
      setOemError("Enter at least one numeric article ID.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/oems`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "OEM request failed.");

      const flatRows = flattenOemRows(data);
      setOemRows(flatRows);
      if (Array.isArray(data.mostCommonOemNumbers)) {
        setSavedMostCommonOems(data.mostCommonOemNumbers);
      }
      if (data.mostCommonOemNumbersUpdatedAt) {
        setSavedMostCommonOemsUpdatedAt(data.mostCommonOemNumbersUpdatedAt);
      }
      setOemMeta(
        flatRows.length
          ? `Showing ${flatRows.length} OEM row(s).${data.count != null ? ` API count: ${data.count}.` : ""}`
          : "No OEM rows in response."
      );
    } catch (error) {
      setOemMeta("No OEM data loaded yet.");
      setOemError(error.message);
    }
  }

  function continueToStep3WithPartsSelection() {
    const vehicleId = vehicleIdInput.trim();
    if (vehicleId) {
      setArticlesVehicleId(vehicleId);
    }
    if (selectedCategoryIdForArticles) {
      setArticlesCategoryId(selectedCategoryIdForArticles);
    }
    setCurrentStep(3);
  }

  function continueToStep4WithArticleIds() {
    const ids = Array.from(
      new Set(
        articlesRows
          .map((row) => row?.articleId)
          .filter((id) => id !== null && id !== undefined && id !== "")
      )
    );

    if (ids.length) {
      setOemArticleIds(ids.join(", "));
    }
    setCurrentStep(4);
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-white px-4 py-8 text-slate-800">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-3xl border border-slate-200 bg-white/95 p-7 shadow-[0_10px_40px_rgba(15,23,42,0.08)]">
          <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-600">
            Vehicle parts workflow
          </span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">VIN + Parts Lookup</h1>
          <p className="mt-2 text-sm text-slate-500">
            Modern minimal workflow in 4 steps.
          </p>
        </header>

        <nav className="rounded-3xl border border-slate-200 bg-white/95 p-3 shadow-[0_10px_40px_rgba(15,23,42,0.06)]">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            {STEP_ITEMS.map((item) => {
              const stepLocked = item.id > 1 && !vinStepComplete;
              return (
              <button
                key={item.id}
                type="button"
                disabled={stepLocked}
                onClick={() => {
                  if (stepLocked) return;
                  setCurrentStep(item.id);
                }}
                className={`rounded-2xl border px-4 py-3 text-left text-sm font-medium transition ${
                  currentStep === item.id
                    ? "border-slate-800 bg-slate-900 text-white shadow-lg shadow-slate-300/70"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                } ${stepLocked ? "cursor-not-allowed opacity-45" : ""}`}
              >
                <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-current text-[11px]">
                  {item.id}
                </span>
                {item.label}
              </button>
            );
            })}
          </div>
        </nav>

        {currentStep === 1 && (
        <StepCard
          step={1}
          title="Get VIN"
          subtitle="Start with VIN to identify the vehicle."
          active={currentStep === 1}
        >
          <div className="flex flex-col gap-3 md:flex-row">
            <input
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none ring-slate-200 transition focus:border-slate-300 focus:bg-white focus:ring-2"
              value={vin}
              onChange={(e) => {
                setVin(e.target.value);
                setVinStepComplete(false);
              }}
              placeholder="Enter VIN"
            />
            <button
              type="button"
              onClick={checkVin}
              className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-slate-800"
            >
              Check VIN
            </button>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">Model Name: <span className="font-semibold">{vinData.modelName}</span></div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">Car Name: <span className="font-semibold">{vinData.carName}</span></div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">Vehicle ID: <span className="font-semibold">{vinData.vehicleId}</span></div>
          </div>
          {!!vinError && <p className="mt-2 text-sm text-red-600">{vinError}</p>}
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => vinStepComplete && setCurrentStep(2)}
              disabled={!vinStepComplete}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continue to Step 2
            </button>
          </div>
        </StepCard>
        )}

        {currentStep === 2 && (
        <StepCard
          step={2}
          title="Vehicle Parts List"
          subtitle="Fetch all parts by Vehicle ID."
          active={currentStep === 2}
        >
          <div className="flex flex-col gap-3 md:flex-row">
            <input
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none ring-slate-200 transition focus:border-slate-300 focus:bg-white focus:ring-2"
              value={vehicleIdInput}
              onChange={(e) => setVehicleIdInput(e.target.value)}
              placeholder="Vehicle ID"
            />
            <button
              type="button"
              onClick={loadParts}
              className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-slate-800"
            >
              Get Parts
            </button>
          </div>
          {!!partsError && <p className="mt-2 text-sm text-red-600">{partsError}</p>}
          <p className="mt-2 text-sm text-slate-500">
            {partsMeta}
            {!!partsRows.length && filteredPartsRows.length !== partsRows.length
              ? ` Filtered to ${filteredPartsRows.length} row(s).`
              : ""}
          </p>

            {!!partsRows.length && !!category1Options.length && (
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <select
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none ring-slate-200 transition focus:border-slate-300 focus:bg-white focus:ring-2"
                value={selectedCategory1}
                onChange={(e) => {
                  setSelectedCategory1(e.target.value);
                  setSelectedCategory2("");
                  setSelectedCategory3("");
                  setSelectedCategory4("");
                }}
              >
                <option value="">Select categoryName1</option>
                {category1Options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>

              <select
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none ring-slate-200 transition focus:border-slate-300 focus:bg-white focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
                value={selectedCategory2}
                onChange={(e) => {
                  setSelectedCategory2(e.target.value);
                  setSelectedCategory3("");
                  setSelectedCategory4("");
                }}
                disabled={!selectedCategory1 || !category2Options.length}
              >
                <option value="">
                  {!selectedCategory1
                    ? "Select categoryName1 first"
                    : "Select categoryName2"}
                </option>
                {category2Options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>

              <select
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none ring-slate-200 transition focus:border-slate-300 focus:bg-white focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
                value={selectedCategory3}
                onChange={(e) => {
                  setSelectedCategory3(e.target.value);
                  setSelectedCategory4("");
                }}
                disabled={!selectedCategory2 || !category3Options.length}
              >
                <option value="">
                  {!selectedCategory2
                    ? "Select categoryName2 first"
                    : "Select categoryName3"}
                </option>
                {category3Options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>

              <select
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none ring-slate-200 transition focus:border-slate-300 focus:bg-white focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
                value={selectedCategory4}
                onChange={(e) => setSelectedCategory4(e.target.value)}
                disabled={!selectedCategory3 || !category4Options.length}
              >
                <option value="">
                  {!selectedCategory3
                    ? "Select categoryName3 first"
                    : "Select categoryName4"}
                </option>
                {category4Options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-[720px] w-full text-sm">
              <thead className="bg-slate-100/80 text-slate-700">
                {!!(
                  !selectedCategory1
                    ? topCategoryRows.length
                    : !selectedCategory2
                      ? secondCategoryRows.length
                      : !selectedCategory3
                        ? (category3Options.length ? thirdCategoryRows.length : selectedSecondCategoryRows.length)
                        : !selectedCategory4
                          ? fourthCategoryRows.length || filteredPartsRows.length
                          : partsColumns.length
                ) && (
                  <tr>
                    <th className="px-4 py-3 text-left">No.</th>
                    {(!selectedCategory1
                      ? ["categoryName1", "categoryId1"]
                      : !selectedCategory2
                        ? ["categoryName2", "categoryId2"]
                        : !selectedCategory3
                          ? (category3Options.length
                              ? ["categoryName3", "categoryId3"]
                              : ["categoryName2", "categoryId2"])
                          : !selectedCategory4 && fourthCategoryRows.length
                            ? ["categoryName4", "categoryId4"]
                            : partsColumns).map((col) => (
                        <th key={col} className="px-4 py-3 text-left">{col}</th>
                      ))}
                  </tr>
                )}
              </thead>
              <tbody>
                {(!selectedCategory1
                  ? topCategoryRows
                  : !selectedCategory2
                    ? secondCategoryRows
                    : !selectedCategory3
                      ? (category3Options.length ? thirdCategoryRows : selectedSecondCategoryRows)
                      : !selectedCategory4 && fourthCategoryRows.length
                        ? fourthCategoryRows
                        : filteredPartsRows).map((row, index) => (
                  <tr key={`${index}-${row?.articleId ?? "row"}`} className="border-t border-slate-100 bg-white odd:bg-slate-50/30">
                    <td className="px-4 py-3">{index + 1}</td>
                    {(!selectedCategory1
                      ? ["categoryName1", "categoryId1"]
                      : !selectedCategory2
                        ? ["categoryName2", "categoryId2"]
                        : !selectedCategory3
                          ? (category3Options.length
                              ? ["categoryName3", "categoryId3"]
                              : ["categoryName2", "categoryId2"])
                          : !selectedCategory4 && fourthCategoryRows.length
                            ? ["categoryName4", "categoryId4"]
                            : partsColumns).map((col) => (
                      <td key={col} className="px-4 py-3">
                        {row?.[col] == null ? "-" : typeof row[col] === "object" ? JSON.stringify(row[col]) : String(row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium transition hover:bg-slate-100"
            >
              Back
            </button>
            <button
              type="button"
              onClick={continueToStep3WithPartsSelection}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium transition hover:bg-slate-100"
            >
              Continue to Step 3
            </button>
          </div>
        </StepCard>
        )}

        {currentStep === 3 && (
        <StepCard
          step={3}
          title="Articles by Vehicle & Category"
          subtitle="Load article list for selected vehicle and category."
          active={currentStep === 3}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto]">
            <input
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none ring-slate-200 transition focus:border-slate-300 focus:bg-white focus:ring-2"
              value={articlesVehicleId}
              onChange={(e) => setArticlesVehicleId(e.target.value)}
              placeholder="Vehicle ID"
            />
            <input
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none ring-slate-200 transition focus:border-slate-300 focus:bg-white focus:ring-2"
              value={articlesCategoryId}
              onChange={(e) => setArticlesCategoryId(e.target.value)}
              placeholder="Category ID"
            />
            <button
              type="button"
              onClick={loadArticles}
              className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-slate-800"
            >
              Get Articles
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={copyArticleIdsToClipboard}
              className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium transition hover:bg-slate-100"
            >
              Copy all article IDs
            </button>
            <span className="text-sm text-slate-500">{articlesCopyStatus}</span>
          </div>

          {!!articlesError && <p className="mt-2 text-sm text-red-600">{articlesError}</p>}
          <p className="mt-2 text-sm text-slate-500">{articlesMeta}</p>
          <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-[720px] w-full text-sm">
              <thead className="bg-slate-100/80 text-slate-700">
                {!!articlesRows.length && (
                  <tr>
                    <th className="px-4 py-3 text-left">No.</th>
                    {ARTICLE_COLUMNS.map((col) => (
                      <th key={col} className="px-4 py-3 text-left">{col}</th>
                    ))}
                  </tr>
                )}
              </thead>
              <tbody>
                {articlesRows.map((row, index) => (
                  <tr key={`${index}-${row?.articleId ?? "article"}`} className="border-t border-slate-100 bg-white odd:bg-slate-50/30">
                    <td className="px-4 py-3">{index + 1}</td>
                    {ARTICLE_COLUMNS.map((col) => (
                      <td key={col} className="px-4 py-3">
                        {col === "s3image" && typeof row?.[col] === "string" && row[col].startsWith("http") ? (
                          <img src={row[col]} alt="" loading="lazy" className="h-14 w-14 rounded-lg border border-slate-200 bg-white object-contain p-1" />
                        ) : row?.[col] == null ? (
                          "-"
                        ) : (
                          String(row[col])
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium transition hover:bg-slate-100"
            >
              Back
            </button>
            <button
              type="button"
              onClick={continueToStep4WithArticleIds}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium transition hover:bg-slate-100"
            >
              Continue to Step 4
            </button>
          </div>
        </StepCard>
        )}

        {currentStep === 4 && (
        <StepCard
          step={4}
          title="OEM Numbers by Article ID"
          subtitle="Enter article IDs and get OEM brand/number mapping."
          active={currentStep === 4}
        >
          <div className="flex flex-col gap-3 md:flex-row">
            <input
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none ring-slate-200 transition focus:border-slate-300 focus:bg-white focus:ring-2"
              value={oemArticleIds}
              onChange={(e) => setOemArticleIds(e.target.value)}
              placeholder="e.g. 9574981, 3028988"
            />
            <button
              type="button"
              onClick={loadOems}
              className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-slate-800"
            >
              Get OEMs
            </button>
          </div>

          {!!oemError && <p className="mt-2 text-sm text-red-600">{oemError}</p>}
          <p className="mt-2 text-sm text-slate-500">{oemMeta}</p>
          {!!topOems.length && (
            <p className="mt-1 text-sm text-slate-600">
              <span className="font-semibold">Most common OEM numbers:</span>{" "}
              {topOems.map(([no, count]) => `${no} (${count}x)`).join(", ")}
            </p>
          )}

          <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-[640px] w-full text-sm">
              <thead className="bg-slate-100/80 text-slate-700">
                {!!oemRows.length && (
                  <tr>
                    <th className="px-4 py-3 text-left">No.</th>
                    <th className="px-4 py-3 text-left">articleId</th>
                    <th className="px-4 py-3 text-left">oemBrand</th>
                    <th className="px-4 py-3 text-left">oemDisplayNo</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {oemRows.map((row, index) => (
                  <tr key={`${index}-${row.articleId}`} className="border-t border-slate-100 bg-white odd:bg-slate-50/30">
                    <td className="px-4 py-3">{index + 1}</td>
                    <td className="px-4 py-3">{row.articleId ?? "-"}</td>
                    <td className="px-4 py-3">{row.oemBrand ?? "-"}</td>
                    <td className="px-4 py-3">{row.oemDisplayNo ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-start">
            <div className="flex w-full justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium transition hover:bg-slate-100"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(5)}
                className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium transition hover:bg-slate-100"
              >
                Continue to Step 5
              </button>
            </div>
          </div>
        </StepCard>
        )}

        {currentStep === 5 && (
        <StepCard
          step={5}
          title="Web Links"
          subtitle="Open useful links generated from OEM numbers and article IDs."
          active={currentStep === 5}
        >
          <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Saved Most Common OEM numbers (backend)
            </p>
            {!!savedMostCommonOemsError && (
              <p className="mt-1 text-sm text-red-600">{savedMostCommonOemsError}</p>
            )}
            {!savedMostCommonOemsError && !savedMostCommonOems.length && (
              <p className="mt-1 text-sm text-slate-600">No saved OEM summary yet. Run Step 4 first.</p>
            )}
            {!savedMostCommonOemsError && !!savedMostCommonOems.length && (
              <p className="mt-1 text-sm text-slate-700">
                {savedMostCommonOems
                  .map((item) => `${item.oemDisplayNo} (${item.count}x)`)
                  .join(", ")}
              </p>
            )}
            {!!savedMostCommonOemsUpdatedAt && (
              <p className="mt-1 text-xs text-slate-500">Updated: {savedMostCommonOemsUpdatedAt}</p>
            )}
          </div>

          {webLinksLoading && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              Checking links and removing unavailable products...
            </div>
          )}

          {!!webLinksFilterError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
              {webLinksFilterError}
            </div>
          )}

          {!webLinksLoading && !uniqueChangedUrlWebLinkItems.length && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              No changed links found after loading pages. All loaded links are equal to original URLs.
            </div>
          )}

          {!!uniqueChangedUrlWebLinkItems.length && (
            <div className="flex flex-col gap-1">
              {uniqueChangedUrlWebLinkItems.map((item) => {
                const href = String(item.finalUrl || item.url || "").trim();
                return (
                  <a
                    key={href}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all text-sm text-blue-700 hover:underline"
                  >
                    {href}
                  </a>
                );
              })}
            </div>
          )}

          <div className="mt-4 flex justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(4)}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium transition hover:bg-slate-100"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => {
                setVinStepComplete(false);
                setCurrentStep(1);
              }}
              className="rounded-2xl bg-slate-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Start New Lookup
            </button>
          </div>
        </StepCard>
        )}
      </div>
    </main>
  );
}

export default App;
