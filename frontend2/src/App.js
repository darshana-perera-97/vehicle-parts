import { useEffect, useMemo, useRef, useState } from "react";

const API_BASE =
  (process.env.REACT_APP_API_BASE || "").replace(/\/$/, "") ||
  (process.env.NODE_ENV === "development" ? "http://localhost:6050" : "");

const STEPS = [
  { id: 1, label: "VIN & confirm" },
  { id: 2, label: "Categories & parts" },
  { id: 3, label: "Web links" },
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

  const [vin, setVin] = useState("");
  const [vinData, setVinData] = useState({ modelName: "-", carName: "-", vehicleId: "-" });
  const [vinError, setVinError] = useState("");
  const [vinLookedUp, setVinLookedUp] = useState(false);

  const [vehicleIdInput, setVehicleIdInput] = useState("");
  const [partsError, setPartsError] = useState("");
  const [partsMeta, setPartsMeta] = useState("No parts loaded yet.");
  const [partsRows, setPartsRows] = useState([]);
  const [selectedCategory1, setSelectedCategory1] = useState("");
  const [selectedCategory2, setSelectedCategory2] = useState("");
  const [selectedCategory3, setSelectedCategory3] = useState("");
  const [selectedCategory4, setSelectedCategory4] = useState("");

  const [articlesRows, setArticlesRows] = useState([]);
  const [oemRows, setOemRows] = useState([]);

  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [pipelineError, setPipelineError] = useState("");

  const [filteredWebLinkItems, setFilteredWebLinkItems] = useState([]);
  const [changedUrlWebLinkItems, setChangedUrlWebLinkItems] = useState([]);
  const [webLinksLoading, setWebLinksLoading] = useState(false);
  const [webLinksFilterError, setWebLinksFilterError] = useState("");
  const [removedLinksCount, setRemovedLinksCount] = useState(0);

  const prevStepRef = useRef(currentStep);

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
      url: `https://autobahntraders.com/?s=${encodeURIComponent(String(articleId))}&post_type=product`,
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
    if (currentStep !== 3) return;
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

  const vehicleConfirmed =
    vinLookedUp &&
    vinData.vehicleId &&
    vinData.vehicleId !== "-" &&
    String(vinData.vehicleId).trim() !== "";

  async function checkVin() {
    setVinError("");
    setVinLookedUp(false);
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
      setVinLookedUp(true);
      if (vehicleId !== "-") {
        setVehicleIdInput(String(vehicleId));
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

  async function loadParts() {
    setPartsError("");
    setPartsMeta("Loading...");
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

      setPartsRows(rows);
      setPartsMeta(
        `Loaded ${rows.length} part row(s) for category selection.${extracted.sourcePath ? ` Source: ${extracted.sourcePath}.` : ""}`
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

  async function runArticlesOemsAndGoToWebLinks() {
    const vid = vehicleIdInput.trim();
    const catId = selectedCategoryIdForArticles.trim();
    setPipelineError("");

    if (!vid) {
      setPipelineError("Vehicle ID is required.");
      return;
    }
    if (!catId) {
      setPipelineError(
        "Select categories in the dropdowns until a category ID is available for articles."
      );
      return;
    }

    setPipelineLoading(true);
    setArticlesRows([]);
    setOemRows([]);

    try {
      const resA = await fetch(
        `${API_BASE}/api/articles/${encodeURIComponent(vid)}/${encodeURIComponent(catId)}`
      );
      const dataA = await resA.json();
      if (!resA.ok) throw new Error(dataA.error || "Articles request failed.");

      const list = Array.isArray(dataA.articles) ? dataA.articles : [];
      setArticlesRows(list);

      const ids = Array.from(
        new Set(
          list
            .map((row) => row?.articleId)
            .filter((id) => id !== null && id !== undefined && id !== "")
            .map((id) => Number(id))
            .filter((n) => Number.isFinite(n) && n > 0)
        )
      );

      if (!ids.length) {
        throw new Error("No article IDs returned for this vehicle and category.");
      }

      const resO = await fetch(`${API_BASE}/api/oems`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleIds: ids }),
      });
      const dataO = await resO.json();
      if (!resO.ok) throw new Error(dataO.error || "OEM request failed.");

      setOemRows(flattenOemRows(dataO));
      setCurrentStep(3);
    } catch (error) {
      setPipelineError(error.message);
    } finally {
      setPipelineLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-white px-4 py-8 text-slate-800">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-3xl border border-slate-200 bg-white/95 p-7 shadow-[0_10px_40px_rgba(15,23,42,0.08)]">
          <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-600">
            Autobahntraders Catlog
          </span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            VIN → Categories → Shop links
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Three steps: confirm vehicle, pick category (4 levels), then Autobahn product links.
          </p>
        </header>

        <nav className="rounded-3xl border border-slate-200 bg-white/95 p-3 shadow-[0_10px_40px_rgba(15,23,42,0.06)]">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            {STEPS.map((item) => {
              const stepLocked = item.id > 1 && !vehicleConfirmed;
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
            title="Vehicle from VIN"
            subtitle="Look up the VIN, then confirm Model Name and Car Name."
            active={currentStep === 1}
          >
            <div className="flex flex-col gap-3 md:flex-row">
              <input
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none ring-slate-200 transition focus:border-slate-300 focus:bg-white focus:ring-2"
                value={vin}
                onChange={(e) => {
                  setVin(e.target.value);
                  setVinLookedUp(false);
                }}
                placeholder="Enter VIN"
              />
              <button
                type="button"
                onClick={checkVin}
                className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-slate-800"
              >
                Look up VIN
              </button>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Model Name</p>
                <p className="font-semibold text-slate-900 mt-1">{vinData.modelName}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Car Name</p>
                <p className="font-semibold text-slate-900 mt-1">{vinData.carName}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Vehicle ID (for parts):{" "}
              <span className="font-mono font-medium text-slate-700">{vinData.vehicleId}</span>
            </p>

            {!!vinError && <p className="mt-2 text-sm text-red-600">{vinError}</p>}

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                disabled={!vehicleConfirmed}
                className="rounded-2xl bg-slate-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Confirm and continue
              </button>
            </div>
            {!vehicleConfirmed && vinLookedUp && (
              <p className="mt-2 text-right text-xs text-amber-700">
                Resolve VIN to a valid Vehicle ID before continuing.
              </p>
            )}
          </StepCard>
        )}

        {currentStep === 2 && (
          <StepCard
            step={2}
            title="Categories & parts"
            subtitle="Parts load automatically from your confirmed VIN. Use the four dropdowns, then continue to web links."
            active={currentStep === 2}
          >
            <p className="text-sm text-slate-600">
              Vehicle ID:{" "}
              <span className="font-mono font-semibold text-slate-900">
                {vehicleIdInput.trim() || "—"}
              </span>
            </p>
            {!!partsError && <p className="mt-2 text-sm text-red-600">{partsError}</p>}
            <p className="mt-2 text-sm text-slate-500">
              {partsMeta}
              {!!partsRows.length && filteredPartsRows.length !== partsRows.length
                ? ` Filtered to ${filteredPartsRows.length} part row(s) for this category path.`
                : ""}
            </p>
            {!!partsRows.length && selectedCategoryIdForArticles && (
              <p className="mt-1 text-xs text-slate-600">
                Category ID for articles:{" "}
                <span className="font-mono font-semibold">{selectedCategoryIdForArticles}</span>
              </p>
            )}

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
                  <option value="">Category 1</option>
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
                    {!selectedCategory1 ? "Select category 1 first" : "Category 2"}
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
                    {!selectedCategory2 ? "Select category 2 first" : "Category 3"}
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
                    {!selectedCategory3 ? "Select category 3 first" : "Category 4"}
                  </option>
                  {category4Options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!!pipelineError && (
              <p className="mt-3 text-sm text-red-600">{pipelineError}</p>
            )}

            <div className="mt-4 flex flex-wrap justify-between gap-2">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium transition hover:bg-slate-100"
              >
                Back
              </button>
              <button
                type="button"
                onClick={runArticlesOemsAndGoToWebLinks}
                disabled={pipelineLoading}
                className="rounded-2xl bg-slate-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pipelineLoading ? "Loading articles & OEMs…" : "Get article IDs & OEMs → Web links"}
              </button>
            </div>
          </StepCard>
        )}

        {currentStep === 3 && (
          <StepCard
            step={3}
            title="Web links"
            subtitle="Autobahn Traders search links (filtered and URL-checked via backend)."
            active={currentStep === 3}
          >
            {webLinksLoading && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                Checking links and removing unavailable products…
              </div>
            )}

            {!!webLinksFilterError && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
                {webLinksFilterError}
              </div>
            )}

            {!webLinksLoading && !uniqueChangedUrlWebLinkItems.length && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                No changed links found after loading pages, or no links to check. Try another category
                or verify OEM/article data.
              </div>
            )}

            {!!uniqueChangedUrlWebLinkItems.length && (
              <div className="mt-4 flex flex-col gap-1">
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
                onClick={() => setCurrentStep(2)}
                className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium transition hover:bg-slate-100"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => {
                  setCurrentStep(1);
                  setVinLookedUp(false);
                  setPipelineError("");
                }}
                className="rounded-2xl bg-slate-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Start over
              </button>
            </div>
          </StepCard>
        )}
      </div>
    </main>
  );
}

export default App;
