import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import LoginScreen from "./components/LoginScreen";
import { AlertTriangle, MapPin, Navigation, Package, Plus, Search, UserCheck, X } from "lucide-react";

const getEnv = (key) => {
  try {
    return import.meta && import.meta.env ? import.meta.env[key] || "" : "";
  } catch {
    return "";
  }
};

const SUPABASE_URL = getEnv("VITE_SUPABASE_URL");
const SUPABASE_ANON_KEY = getEnv("VITE_SUPABASE_ANON_KEY");
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const ADELAIDE_CENTER = { lat: -34.9285, lng: 138.6007 };
const MAP_ZOOM = 11;
const MIN_MAP_ZOOM = 9;
const MAX_MAP_ZOOM = 14;
const TILE_SIZE = 256;

const directionOptions = ["CBD", "East", "South", "West", "North", "Far North", "Far South", "Southeast", "Southwest", "Northeast", "Northwest"];
const staffOptions = ["Aaron", "Amanda", "Bradley", "Chen", "Henry", "Ivan", "James", "Laurinda", "Nikil"];
const mapProviderOptions = ["Google Maps", "Apple Maps", "Waze"];

function getStoredPreference(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function setStoredPreference(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures.
  }
}

const directionFocus = {
  All: { lat: -34.9285, lng: 138.6007, zoom: 11 },
  CBD: { lat: -34.9285, lng: 138.6007, zoom: 14 },
  East: { lat: -34.925, lng: 138.655, zoom: 12 },
  South: { lat: -34.995, lng: 138.555, zoom: 12 },
  West: { lat: -34.895, lng: 138.535, zoom: 12 },
  North: { lat: -34.84, lng: 138.61, zoom: 12 },
  "Far North": { lat: -34.72, lng: 138.67, zoom: 11 },
  "Far South": { lat: -35.32, lng: 138.55, zoom: 10 },
  Southeast: { lat: -35.02, lng: 138.74, zoom: 11 },
  Southwest: { lat: -35.12, lng: 138.51, zoom: 11 },
  Northeast: { lat: -34.83, lng: 138.69, zoom: 12 },
  Northwest: { lat: -34.84, lng: 138.51, zoom: 12 },
};

const suburbDefaults = {
  // CBD / inner city
  adelaide: { direction: "CBD", lat: -34.9285, lng: 138.6007 },
  north_adelaide: { direction: "CBD", lat: -34.9087, lng: 138.5952 },
  kent_town: { direction: "CBD", lat: -34.9219, lng: 138.6207 },
  mile_end: { direction: "CBD", lat: -34.9252, lng: 138.5682 },
  thebarton: { direction: "CBD", lat: -34.9162, lng: 138.5714 },
  wayville: { direction: "CBD", lat: -34.9451, lng: 138.5891 },
  keswick: { direction: "CBD", lat: -34.9417, lng: 138.5773 },

  // East
  norwood: { direction: "East", lat: -34.921, lng: 138.6364 },
  magill: { direction: "East", lat: -34.9122, lng: 138.6743 },
  burnside: { direction: "East", lat: -34.9392, lng: 138.6597 },
  dulwich: { direction: "East", lat: -34.9368, lng: 138.6272 },
  glenside: { direction: "East", lat: -34.9424, lng: 138.6372 },
  unley: { direction: "East", lat: -34.9498, lng: 138.6079 },
  fullarton: { direction: "East", lat: -34.9512, lng: 138.6244 },

  // North
  prospect: { direction: "North", lat: -34.8849, lng: 138.5932 },
  pooraka: { direction: "North", lat: -34.8227, lng: 138.6156 },
  enfield: { direction: "North", lat: -34.8526, lng: 138.6013 },
  clearview: { direction: "North", lat: -34.8589, lng: 138.6135 },
  gepps_cross: { direction: "North", lat: -34.8421, lng: 138.5945 },
  kilburn: { direction: "North", lat: -34.8587, lng: 138.5851 },

  // Northeast
  modbury: { direction: "Northeast", lat: -34.8317, lng: 138.6885 },
  paradise: { direction: "Northeast", lat: -34.8737, lng: 138.6684 },
  campbelltown: { direction: "Northeast", lat: -34.883, lng: 138.6636 },
  athelstone: { direction: "Northeast", lat: -34.8708, lng: 138.7068 },
  tea_tree_gully: { direction: "Northeast", lat: -34.8167, lng: 138.7282 },
  golden_grove: { direction: "Northeast", lat: -34.7908, lng: 138.6986 },
  greenwith: { direction: "Northeast", lat: -34.765, lng: 138.7131 },

  // Northwest / West
  hindmarsh: { direction: "West", lat: -34.9062, lng: 138.5681 },
  brompton: { direction: "West", lat: -34.8952, lng: 138.5787 },
  woodville: { direction: "West", lat: -34.8791, lng: 138.5428 },
  findon: { direction: "West", lat: -34.9006, lng: 138.5313 },
  port_adelaide: { direction: "Northwest", lat: -34.846, lng: 138.5076 },
  semaphore: { direction: "Northwest", lat: -34.8398, lng: 138.4828 },
  wingfield: { direction: "Northwest", lat: -34.8409, lng: 138.5548 },
  largs_bay: { direction: "Northwest", lat: -34.8244, lng: 138.4864 },

  // South
  glenelg: { direction: "South", lat: -34.9806, lng: 138.5124 },
  plympton: { direction: "South", lat: -34.9626, lng: 138.5533 },
  marion: { direction: "South", lat: -35.0047, lng: 138.5578 },
  ascot_park: { direction: "South", lat: -34.9913, lng: 138.5566 },
  clovelly_park: { direction: "South", lat: -34.9994, lng: 138.5718 },
  edwardstown: { direction: "South", lat: -34.9803, lng: 138.5702 },

  // Southeast
  mount_barker: { direction: "Southeast", lat: -35.0648, lng: 138.8586 },
  hahndorf: { direction: "Southeast", lat: -35.0288, lng: 138.8089 },
  stirling: { direction: "Southeast", lat: -35.0063, lng: 138.7179 },
  aldgate: { direction: "Southeast", lat: -35.0162, lng: 138.7367 },
  crafers: { direction: "Southeast", lat: -34.9975, lng: 138.7034 },
  mitcham: { direction: "Southeast", lat: -34.9784, lng: 138.6212 },
  belair: { direction: "Southeast", lat: -35.0009, lng: 138.6207 },

  // Southwest
  reynella: { direction: "Southwest", lat: -35.0933, lng: 138.5396 },
  morphett_vale: { direction: "Southwest", lat: -35.1333, lng: 138.5235 },
  christies_beach: { direction: "Southwest", lat: -35.1384, lng: 138.4728 },
  noarlunga_centre: { direction: "Southwest", lat: -35.1438, lng: 138.4969 },
  hallett_cove: { direction: "Southwest", lat: -35.0796, lng: 138.5156 },
  seaford: { direction: "Southwest", lat: -35.1896, lng: 138.4754 },

  // Far North / Far South
  mawson_lakes: { direction: "Far North", lat: -34.8114, lng: 138.6143 },
  salisbury: { direction: "Far North", lat: -34.7616, lng: 138.6444 },
  elizabeth: { direction: "Far North", lat: -34.7196, lng: 138.6686 },
  munno_para: { direction: "Far North", lat: -34.6667, lng: 138.6843 },
  gawler: { direction: "Far North", lat: -34.5993, lng: 138.749 },
  victor_harbor: { direction: "Far South", lat: -35.5502, lng: 138.6211 },
  aldinga: { direction: "Far South", lat: -35.2792, lng: 138.4591 },
  willunga: { direction: "Far South", lat: -35.271, lng: 138.5546 },
};

function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

const demoOrders = [
  {
    id: "demo-1001",
    docket_no: "AN06561284",
    equipment_id: "ICXC1538P",
    customer_name: "Northside Medical Centre",
    address: "145 Main North Road",
    street_address: "145 Main North Road",
    state: "SA",
    postcode: "5082",
    country: "Australia",
    suburb: "Prospect",
    direction: "North",
    toner_code: "WT-B1",
    priority: "High",
    status: "Waiting",
    taken_by: null,
    taken_at: null,
    delivered_at: null,
    created_at: daysAgo(6),
    lat: -34.8849,
    lng: 138.5932,
    notes: "Waste toner alert",
  },
  {
    id: "demo-1002",
    docket_no: "DEMO-1002",
    equipment_id: "IRC3380-NE",
    customer_name: "Modbury Legal",
    address: "22 Smart Road",
    street_address: "22 Smart Road",
    state: "SA",
    postcode: "5092",
    country: "Australia",
    suburb: "Modbury",
    direction: "Northeast",
    toner_code: "Black toner",
    priority: "Normal",
    status: "Waiting",
    taken_by: null,
    taken_at: null,
    delivered_at: null,
    created_at: daysAgo(4),
    lat: -34.8317,
    lng: 138.6885,
    notes: "",
  },
  {
    id: "demo-1003",
    docket_no: "DEMO-1003",
    equipment_id: "HP-E77830-CBD",
    customer_name: "City Accounting Group",
    address: "88 Grenfell Street",
    street_address: "88 Grenfell Street",
    state: "SA",
    postcode: "5000",
    country: "Australia",
    suburb: "Adelaide",
    direction: "CBD",
    toner_code: "W9060MC Black",
    priority: "Normal",
    status: "Taken",
    taken_by: "Service",
    taken_at: new Date().toISOString(),
    delivered_at: null,
    created_at: daysAgo(2),
    lat: -34.9247,
    lng: 138.6067,
    notes: "Front reception",
  },
];

function emptyForm() {
  return {
    docket_no: "",
    equipment_id: "",
    customer_name: "",
    address: "",
    street_address: "",
    suburb: "",
    state: "SA",
    postcode: "",
    country: "Australia",
    direction: "",
    toner_code: "",
    priority: "Normal",
    notes: "",
    lat: "",
    lng: "",
  };
}

function normalizeSuburb(value = "") {
  return value.trim().toLowerCase().split(" ").filter(Boolean).join("_");
}

function waitingDays(createdAt) {
  const start = new Date(createdAt).getTime();
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.floor((Date.now() - start) / 86400000));
}

function formatDateAU(value) {
  const d = value ? new Date(value) : new Date();
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function toNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function latLngToWorldPixels(lat, lng, zoom) {
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const scale = TILE_SIZE * 2 ** zoom;
  const x = ((lng + 180) / 360) * scale;
  const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
  return { x, y };
}

function worldPixelsToTile(px) {
  return Math.floor(px / TILE_SIZE);
}

function worldPixelsToLatLng(x, y, zoom) {
  const scale = TILE_SIZE * 2 ** zoom;
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lng };
}

function clampZoom(value) {
  return Math.max(MIN_MAP_ZOOM, Math.min(MAX_MAP_ZOOM, value));
}

function directionLabel(direction = "") {
  if (direction === "Northeast") return "NE";
  if (direction === "Northwest") return "NW";
  if (direction === "Far North") return "FN";
  if (direction === "Far South") return "FS";
  if (direction === "Southeast") return "SE";
  if (direction === "Southwest") return "SW";
  return direction.slice(0, 2).toUpperCase() || "?";
}

function cleanAddress(value = "") {
  return value.trim().toLowerCase().split(" ").filter(Boolean).join(" ").replaceAll(",", "");
}

function displayAddress(order) {
  const street = order.street_address || order.address || "No street";
  const state = order.state || "SA";
  const country = order.country || "Australia";
  return [street, order.suburb, state, order.postcode, country].filter(Boolean).join(", ");
}

function navigationQuery(order) {
  const street = order.street_address || order.address || "";
  const state = order.state || "SA";
  const country = order.country || "Australia";
  return [street, order.suburb, state, order.postcode, country].filter(Boolean).join(", ");
}

function navigationUrl(provider, order) {
  const query = encodeURIComponent(navigationQuery(order));
  if (provider === "Apple Maps") return `http://maps.apple.com/?daddr=${query}`;
  if (provider === "Waze") return `https://waze.com/ul?q=${query}&navigate=yes`;
  return `https://www.google.com/maps/dir/?api=1&destination=${query}`;
}

function openNavigation(order, provider, suppressPrompt) {
  if (!navigationQuery(order).trim()) return;
  if (!suppressPrompt) {
    const confirmed = window.confirm("Navigation will open your selected map app. You can change the default map in Mine.");
    if (!confirmed) return;
  }
  window.open(navigationUrl(provider, order), "_blank", "noopener,noreferrer");
}

function addressGroupKey(order) {
  return [cleanAddress(order.street_address || order.address), normalizeSuburb(order.suburb), order.state || ""].join("|");
}

function hashString(value = "") {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function offsetLatLng(lat, lng, seed, strength = 0.006) {
  const angle = (hashString(seed) % 360) * (Math.PI / 180);
  const radius = ((hashString(seed + "radius") % 100) / 100) * strength + strength * 0.25;
  return {
    lat: lat + Math.sin(angle) * radius,
    lng: lng + Math.cos(angle) * radius,
  };
}

function groupOrdersForMap(orders) {
  const groups = new Map();
  orders.forEach((order) => {
    const key = addressGroupKey(order);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(order);
  });

  return Array.from(groups.entries()).map(([key, group]) => {
    const first = group[0];
    const baseLat = toNumber(first.lat, ADELAIDE_CENTER.lat);
    const baseLng = toNumber(first.lng, ADELAIDE_CENTER.lng);
    const adjusted = offsetLatLng(baseLat, baseLng, key, 0.0045);
    const urgentCount = group.filter((o) => o.priority === "High" || waitingDays(o.created_at) >= 5).length;
    const takenCount = group.filter((o) => o.status === "Taken").length;
    return {
      key,
      orders: group,
      primary: first,
      count: group.length,
      urgentCount,
      takenCount,
      lat: adjusted.lat,
      lng: adjusted.lng,
    };
  });
}

function runSelfTests() {
  const tests = [
    ["normalizeSuburb handles spaces", normalizeSuburb("  Mawson   Lakes ") === "mawson_lakes"],
    ["waitingDays never negative", waitingDays(new Date(Date.now() + 86400000).toISOString()) === 0],
    ["suburb default exists", suburbDefaults[normalizeSuburb("Mount Barker")].direction === "Southeast"],
    ["direction option includes Southwest", directionOptions.includes("Southwest")],
    ["tile projection produces finite x", Number.isFinite(latLngToWorldPixels(-34.9285, 138.6007, 11).x)],
    ["world pixel converts back to lat/lng", Number.isFinite(worldPixelsToLatLng(464000, 316000, 11).lat)],
  ];
  const failed = tests.filter((item) => !item[1]).map((item) => item[0]);
  if (failed.length > 0) console.warn("Toner Dispatch self-tests failed:", failed);
}

runSelfTests();

export default function TonerDispatchMVP() {
  const [orders, setOrders] = useState(demoOrders);
  const [equipment, setEquipment] = useState({});
  const [loading, setLoading] = useState(Boolean(supabase));
  const [tab, setTab] = useState("Map");
  const [historyFilters, setHistoryFilters] = useState({
    customer: "",
    from: "",
    to: "",
    model: "",
    staff: "",
  });
  const [area, setArea] = useState("All");
  const [staff, setStaff] = useState("Service");
  const [showAdd, setShowAdd] = useState(false);
  const [showPhotoImport, setShowPhotoImport] = useState(false);
  const [since, setSince] = useState(() => new Date().toISOString());
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm());
  const [mapProvider, setMapProviderState] = useState(() => getStoredPreference("toner_default_map", "Google Maps"));
  const [suppressNavigationPrompt, setSuppressNavigationPromptState] = useState(() => getStoredPreference("toner_nav_prompt", "show") === "hide");

  function setMapProvider(value) {
    setMapProviderState(value);
    setStoredPreference("toner_default_map", value);
  }

  function setSuppressNavigationPrompt(value) {
    setSuppressNavigationPromptState(value);
    setStoredPreference("toner_nav_prompt", value ? "hide" : "show");
  }

  useEffect(() => {
    if (!supabase) return;
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError("");
    const ordersResult = await supabase.from("dispatch_orders").select("*").order("created_at", { ascending: true });
    const equipmentResult = await supabase.from("equipment_master").select("*");

    if (ordersResult.error) setError(ordersResult.error.message);
    if (!ordersResult.error) setOrders(ordersResult.data || []);

    if (!equipmentResult.error) {
      const master = {};
      (equipmentResult.data || []).forEach((row) => {
        master[row.equipment_id] = row;
      });
      setEquipment(master);
    }
    setLoading(false);
  }

  const metrics = useMemo(() => {
    const sinceTime = new Date(since).getTime();
    const inCurrentPeriod = (o) => {
      const created = new Date(o.created_at).getTime();
      const taken = new Date(o.taken_at || 0).getTime();
      const delivered = new Date(o.delivered_at || 0).getTime();
      const courier = new Date(o.courier_at || 0).getTime();
      return created >= sinceTime || taken >= sinceTime || delivered >= sinceTime || courier >= sinceTime;
    };
    const scoped = orders.filter(inCurrentPeriod);
    const waiting = scoped.filter((o) => o.status === "Waiting");
    const taken = scoped.filter((o) => o.status === "Taken");
    const internal = scoped.filter((o) => o.status === "Delivered" && o.taken_by && o.taken_by !== "Courier");
    const courier = scoped.filter((o) => o.status === "Courier");
    const aging = waiting.filter((o) => o.priority === "High" || waitingDays(o.created_at) >= 5);
    return { waiting: waiting.length, taken: taken.length, internal: internal.length, courier: courier.length, aging: aging.length };
  }, [orders, since]);

  const areaCounts = useMemo(() => {
    const counts = {};
    directionOptions.forEach((d) => {
      counts[d] = 0;
    });
    orders.forEach((o) => {
      if (o.status === "Waiting") counts[o.direction] = (counts[o.direction] || 0) + 1;
    });
    return counts;
  }, [orders]);

  const visibleOrders = useMemo(() => {
    return orders
      .filter((o) => o.status !== "Delivered" && o.status !== "Courier")
      .filter((o) => (tab === "Mine" ? o.status === "Taken" && o.taken_by === staff : true))
      .filter((o) => (area === "All" ? true : o.direction === area))
      .sort((a, b) => {
        const ah = a.priority === "High" ? 1 : 0;
        const bh = b.priority === "High" ? 1 : 0;
        if (ah !== bh) return bh - ah;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
  }, [orders, tab, area, staff]);

  const historyOrders = useMemo(() => {
    const customer = historyFilters.customer.trim().toLowerCase();
    const model = historyFilters.model.trim().toLowerCase();
    const fromTime = historyFilters.from ? new Date(`${historyFilters.from}T00:00:00`).getTime() : null;
    const toTime = historyFilters.to ? new Date(`${historyFilters.to}T23:59:59`).getTime() : null;

    return orders
      .filter((o) => {
        const activity = new Date(o.delivered_at || o.courier_at || o.taken_at || o.created_at).getTime();
        if (fromTime && activity < fromTime) return false;
        if (toTime && activity > toTime) return false;
        if (customer && !(o.customer_name || "").toLowerCase().includes(customer)) return false;
        if (model) {
          const haystack = `${o.toner_code || ""} ${o.equipment_id || ""} ${o.docket_no || ""}`.toLowerCase();
          if (!haystack.includes(model)) return false;
        }
        if (historyFilters.staff && (o.taken_by || "") !== historyFilters.staff) return false;
        return true;
      })
      .sort((a, b) => new Date(b.delivered_at || b.courier_at || b.taken_at || b.created_at).getTime() - new Date(a.delivered_at || a.courier_at || a.taken_at || a.created_at).getTime());
  }, [orders, historyFilters]);

  function updateForm(field, value) {
    const next = { ...form, [field]: value };

    if (field === "equipment_id") {
      const key = value.trim().toUpperCase();
      const found = equipment[key];
      if (found) {
        next.equipment_id = found.equipment_id;
        next.customer_name = found.customer_name || "";
        next.address = found.address || found.street_address || "";
        next.street_address = found.street_address || found.address || "";
        next.state = found.state || "SA";
        next.postcode = found.postcode || "";
        next.country = found.country || "Australia";
        next.suburb = found.suburb || "";
        next.direction = found.direction || "";
        next.lat = found.lat || "";
        next.lng = found.lng || "";
      }
    }

    if (field === "suburb") {
      const defaults = suburbDefaults[normalizeSuburb(value)];
      if (defaults) {
        next.direction = defaults.direction;
        next.lat = String(defaults.lat);
        next.lng = String(defaults.lng);
      }
    }
    setForm(next);
  }

  async function addOrder() {
    const defaults = suburbDefaults[normalizeSuburb(form.suburb)] || {};
    const payload = {
      docket_no: form.docket_no.trim(),
      equipment_id: form.equipment_id.trim().toUpperCase(),
      customer_name: form.customer_name.trim(),
      address: (form.street_address || form.address).trim(),
      street_address: (form.street_address || form.address).trim(),
      suburb: form.suburb.trim(),
      state: (form.state || "SA").trim().toUpperCase(),
      postcode: form.postcode.trim(),
      country: (form.country || "Australia").trim(),
      direction: form.direction,
      toner_code: form.toner_code.trim(),
      priority: form.priority,
      status: "Waiting",
      taken_by: null,
      taken_at: null,
      delivered_at: null,
      created_at: new Date().toISOString(),
      lat: toNumber(form.lat || defaults.lat, ADELAIDE_CENTER.lat),
      lng: toNumber(form.lng || defaults.lng, ADELAIDE_CENTER.lng),
      notes: form.notes.trim(),
    };

    if (!payload.equipment_id || !payload.customer_name || !payload.suburb || !payload.direction || !payload.toner_code) return;

    if (supabase) {
      const insertResult = await supabase.from("dispatch_orders").insert(payload).select("*").single();
      if (insertResult.error) return setError(insertResult.error.message);

      await supabase.from("equipment_master").upsert({
        equipment_id: payload.equipment_id,
        customer_name: payload.customer_name,
        address: payload.address,
        street_address: payload.street_address,
        suburb: payload.suburb,
        state: payload.state,
        postcode: payload.postcode,
        country: payload.country,
        direction: payload.direction,
        lat: payload.lat,
        lng: payload.lng,
        updated_at: new Date().toISOString(),
      });

      setOrders((prev) => [...prev, insertResult.data]);
      setEquipment((prev) => ({ ...prev, [payload.equipment_id]: payload }));
    } else {
      const localRow = { ...payload, id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `local-${Date.now()}` };
      setOrders((prev) => [...prev, localRow]);
      setEquipment((prev) => ({ ...prev, [payload.equipment_id]: payload }));
    }

    setForm(emptyForm());
    setShowAdd(false);
  }

  async function updateOrder(id, patch) {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
    if (supabase && !String(id).startsWith("demo-")) {
      const result = await supabase.from("dispatch_orders").update(patch).eq("id", id);
      if (result.error) setError(result.error.message);
    }
  }

  function takeOrder(id) {
    updateOrder(id, { status: "Taken", taken_by: staff, taken_at: new Date().toISOString() });
  }

  function markCourier(id) {
    updateOrder(id, { status: "Courier", taken_by: "Courier", courier_at: new Date().toISOString() });
  }

  async function resetPeriod() {
    const resetAt = new Date().toISOString();
    setSince(resetAt);
    if (supabase) {
      await supabase.from("dispatch_resets").insert({ reset_at: resetAt, reset_by: staff, notes: "Manual reset from dispatch board" });
    }
  }

  async function deliverOrder(order) {
    const deliveredAt = new Date().toISOString();
    await updateOrder(order.id, { status: "Delivered", delivered_at: deliveredAt });

    if (supabase && order.equipment_id && !String(order.id).startsWith("demo-")) {
      await supabase.from("equipment_master").update({ last_delivery: deliveredAt, updated_at: deliveredAt }).eq("equipment_id", order.equipment_id);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-red-600">Toner Dispatch</div>
            <h1 className="text-lg font-black leading-tight sm:text-2xl">Daily Board</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPhotoImport(true)}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-900 shadow-sm active:scale-95"
            >
              Scan
            </button>
            <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 rounded-2xl bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-sm active:scale-95">
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-3 pb-28 pt-4 sm:px-4">
        {error && <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {!supabase && <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">Demo mode: add Supabase environment variables to save shared data.</div>}

        <section className="mb-3 grid grid-cols-5 gap-2">
          <Kpi label="Waiting" value={metrics.waiting} hot={metrics.waiting > 0} />
          <Kpi label="Taken" value={metrics.taken} />
          <Kpi label="Internal" value={metrics.internal} />
          <Kpi label="Courier" value={metrics.courier} />
          <Kpi label="Aging" value={metrics.aging} danger={metrics.aging > 0} />
        </section>

        <section className="mb-4 flex items-center justify-between gap-2 rounded-3xl border border-slate-200 bg-white p-3 text-sm shadow-sm">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Current period</div>
            <div className="font-black text-slate-950">Since {formatDateAU(since)}</div>
          </div>
          <button onClick={resetPeriod} className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-900">Reset</button>
        </section>

        <section className="mb-4 flex gap-2 overflow-x-auto pb-1">
          <AreaChip active={area === "All"} onClick={() => setArea("All")} label="All" count={metrics.waiting} />
          {directionOptions.map((d) => (
            <AreaChip key={d} active={area === d} onClick={() => setArea(d)} label={d} count={areaCounts[d] || 0} />
          ))}
        </section>

        <section className="mb-4 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
          <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500">Current staff</label>
          <select value={staff} onChange={(e) => setStaff(e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm font-bold text-slate-950 outline-none focus:border-red-500">
            {staffOptions.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </section>

        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">Loading dispatch data...</div>
        ) : tab === "Map" ? (
          <MapView orders={visibleOrders} area={area} mapProvider={mapProvider} suppressNavigationPrompt={suppressNavigationPrompt} onTake={takeOrder} onDeliver={deliverOrder} onCourier={markCourier} />
        ) : tab === "Mine" ? (
          <MineView staff={staff} setStaff={setStaff} mapProvider={mapProvider} setMapProvider={setMapProvider} suppressNavigationPrompt={suppressNavigationPrompt} setSuppressNavigationPrompt={setSuppressNavigationPrompt} orders={visibleOrders} onTake={takeOrder} onDeliver={deliverOrder} onCourier={markCourier} />
        ) : tab === "History" ? (
          <HistoryView orders={historyOrders} filters={historyFilters} setFilters={setHistoryFilters} />
        ) : (
          <OrderList orders={visibleOrders} mapProvider={mapProvider} suppressNavigationPrompt={suppressNavigationPrompt} onTake={takeOrder} onDeliver={deliverOrder} onCourier={markCourier} />
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 px-3 py-3 shadow-lg backdrop-blur">
        <div className="mx-auto grid max-w-5xl grid-cols-4 gap-2">
          <BottomTab active={tab === "Board"} label="Board" icon={<Package className="h-5 w-5" />} onClick={() => setTab("Board")} />
          <BottomTab active={tab === "Map"} label="Map" icon={<MapPin className="h-5 w-5" />} onClick={() => setTab("Map")} />
          <BottomTab active={tab === "Mine"} label="Mine" icon={<UserCheck className="h-5 w-5" />} onClick={() => setTab("Mine")} />
          <BottomTab active={tab === "History"} label="History" icon={<Search className="h-5 w-5" />} onClick={() => setTab("History")} />
        </div>
      </nav>

      {showAdd && <AddSheet form={form} updateForm={updateForm} addOrder={addOrder} close={() => setShowAdd(false)} />}
      {showPhotoImport && (
        <PhotoImportSheet
          close={() => setShowPhotoImport(false)}
          openManualEntry={() => {
            setShowPhotoImport(false);
            setShowAdd(true);
          }}
          onExtracted={(data) => {
            const suburbKey = normalizeSuburb(data.suburb || "");
            const defaults = suburbDefaults[suburbKey] || {};

            setForm({
              ...emptyForm(),
              docket_no: data.docket_no || "",
              equipment_id: data.equipment_id || "",
              customer_name: data.customer_name || "",
              address: data.street_address || "",
              street_address: data.street_address || "",
              suburb: data.suburb || "",
              state: data.state || "",
              postcode: data.postcode || "",
              country: data.country || "Australia",
              direction: defaults.direction || "",
              toner_code: data.toner_code || "",
              priority: data.priority || "Normal",
              notes: data.notes || "",
              lat: defaults.lat ? String(defaults.lat) : "",
              lng: defaults.lng ? String(defaults.lng) : "",
            });

            setShowPhotoImport(false);
            setShowAdd(true);
          }}
        />
      )}
    </div>
  );
}

function Kpi({ label, value, hot, danger }) {
  return (
    <div className={`rounded-3xl border p-3 shadow-sm ${danger ? "border-red-300 bg-red-50" : hot ? "border-red-200 bg-white" : "border-slate-200 bg-white"}`}>
      <div className={`text-2xl font-black ${danger ? "text-red-600" : "text-slate-950"}`}>{value}</div>
      <div className="mt-1 truncate text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}

function AreaChip({ active, label, count, onClick }) {
  return (
    <button onClick={onClick} className={`shrink-0 rounded-full border px-4 py-2 text-sm font-bold shadow-sm ${active ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-700"}`}>
      {label} <span className={active ? "ml-1 text-xs text-red-300" : "ml-1 text-xs text-red-600"}>{count}</span>
    </button>
  );
}

function BottomTab({ active, label, icon, onClick }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2 text-xs font-bold ${active ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600"}`}>
      {icon}
      {label}
    </button>
  );
}

function OrderList({ orders, mapProvider, suppressNavigationPrompt, onTake, onDeliver, onCourier }) {
  if (orders.length === 0) {
    return <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">No orders in this view.</div>;
  }

  const grouped = directionOptions
    .map((direction) => ({
      direction,
      items: orders.filter((order) => order.direction === direction),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="space-y-5">
      {grouped.map((group) => (
        <section key={group.direction} className="scroll-mt-32" id={`area-${group.direction.replaceAll(" ", "-")}`}>
          <div className="mb-2 flex items-center justify-between px-1">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-600">{group.direction}</h3>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-red-600">{group.items.length}</span>
          </div>
          <div className="space-y-3">
            {group.items.map((order) => (
              <OrderCard key={order.id} order={order} mapProvider={mapProvider} suppressNavigationPrompt={suppressNavigationPrompt} onTake={onTake} onDeliver={onDeliver} onCourier={onCourier} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function OrderCard({ order, mapProvider, suppressNavigationPrompt, onTake, onDeliver, onCourier }) {
  const days = waitingDays(order.created_at);
  const urgent = order.priority === "High" || days >= 5;

  return (
    <article className={`rounded-3xl border p-3.5 shadow-sm ${urgent ? "border-red-300 bg-red-50" : "border-slate-200 bg-white"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-base font-black text-slate-950">{order.equipment_id}</h2>
            {urgent && <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />}
          </div>
          <p className="mt-1 truncate text-sm font-bold text-slate-700">{order.customer_name}</p>
          {order.docket_no && <p className="mt-0.5 truncate text-[11px] font-bold text-slate-500">Docket {order.docket_no}</p>}
        </div>
        <div className="shrink-0 rounded-2xl bg-slate-100 px-3 py-2 text-center">
          <div className="text-lg font-black leading-none text-slate-950">{days}</div>
          <div className="text-[9px] font-bold uppercase text-slate-500">days</div>
        </div>
      </div>

      <div className="mt-3 space-y-2 text-xs text-slate-700">
        <Info icon={<MapPin className="h-3.5 w-3.5" />} text={displayAddress(order)} />
        <Info icon={<Package className="h-3.5 w-3.5" />} text={`${order.toner_code} · ${order.direction}`} />
        {order.taken_by && <Info icon={<UserCheck className="h-3.5 w-3.5" />} text={`Taken by ${order.taken_by}`} />}
        {order.notes && <div className="line-clamp-2 rounded-2xl bg-slate-100 px-3 py-2 text-xs text-slate-600">{order.notes}</div>}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          onClick={() => openNavigation(order, mapProvider, suppressNavigationPrompt)}
          className="rounded-2xl border border-slate-300 bg-white px-2 py-3 text-xs font-black text-slate-900 active:scale-[.98]"
        >
          Navigation
        </button>

        {order.status === "Waiting" ? (
          <>
            <button onClick={() => onTake(order.id)} className="rounded-2xl bg-red-600 px-2 py-3 text-xs font-black text-white active:scale-[.98]">Take</button>
            <button onClick={() => onCourier(order.id)} className="rounded-2xl bg-slate-950 px-2 py-3 text-xs font-black text-white active:scale-[.98]">Courier</button>
          </>
        ) : (
          <button onClick={() => onDeliver(order)} className="col-span-2 rounded-2xl bg-slate-950 px-2 py-3 text-xs font-black text-white active:scale-[.98]">Delivered</button>
        )}
      </div>
    </article>
  );
}

function Info({ icon, text }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0 text-red-600">{icon}</span>
      <span className="min-w-0 break-words">{text}</span>
    </div>
  );
}

function MapView({ orders, area, mapProvider, suppressNavigationPrompt, onTake, onDeliver, onCourier }) {
  const [center, setCenter] = useState(ADELAIDE_CENTER);
  const [zoom, setZoom] = useState(MAP_ZOOM);
  const [openMarkerKey, setOpenMarkerKey] = useState(null);
  const lastAreaRef = useRef("All");
  const pointersRef = useRef(new Map());
  const dragRef = useRef(null);
  const pinchRef = useRef(null);
  const map = useMemo(() => buildTileMap(center, zoom, 3), [center, zoom]);
  const groups = useMemo(() => groupOrdersForMap(orders), [orders]);

  useEffect(() => {
    if (lastAreaRef.current === area) return;
    lastAreaRef.current = area;
    const focus = directionFocus[area] || directionFocus.All;
    setCenter({ lat: focus.lat, lng: focus.lng });
    setZoom(focus.zoom);
    setOpenMarkerKey(null);
    pointersRef.current.clear();
    dragRef.current = null;
    pinchRef.current = null;
  }, [area]);

  function zoomIn() {
    setZoom((z) => clampZoom(z + 1));
  }

  function zoomOut() {
    setZoom((z) => clampZoom(z - 1));
  }

  function resetMap() {
    const focus = directionFocus[area] || directionFocus.All;
    setCenter({ lat: focus.lat, lng: focus.lng });
    setZoom(focus.zoom);
    setOpenMarkerKey(null);
    pointersRef.current.clear();
    dragRef.current = null;
    pinchRef.current = null;
  }

  function pointFromEvent(event) {
    return { x: event.clientX, y: event.clientY };
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function midpoint(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  function startDrag(point) {
    dragRef.current = {
      startPoint: point,
      startCenterPx: latLngToWorldPixels(center.lat, center.lng, zoom),
      zoom,
    };
    pinchRef.current = null;
  }

  function startPinch(points) {
    if (points.length < 2) return;
    const a = points[0];
    const b = points[1];
    const initialDistance = Math.max(1, distance(a, b));
    pinchRef.current = {
      initialDistance,
      initialMidpoint: midpoint(a, b),
      initialCenter: center,
      initialZoom: zoom,
    };
    dragRef.current = null;
  }

  function handleWheel(event) {
    event.preventDefault();
    setZoom((z) => clampZoom(z + (event.deltaY < 0 ? 1 : -1)));
  }

  function handlePointerDown(event) {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointersRef.current.set(event.pointerId, pointFromEvent(event));
    const points = Array.from(pointersRef.current.values());

    if (points.length >= 2) {
      startPinch(points);
    } else {
      startDrag(points[0]);
    }
  }

  function handlePointerMove(event) {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, pointFromEvent(event));
    const points = Array.from(pointersRef.current.values());

    if (points.length >= 2 && pinchRef.current) {
      const a = points[0];
      const b = points[1];
      const currentDistance = Math.max(1, distance(a, b));
      const currentMidpoint = midpoint(a, b);
      const scale = currentDistance / pinchRef.current.initialDistance;
      const nextZoom = clampZoom(Math.round(pinchRef.current.initialZoom + Math.log2(scale)));
      const baseCenterPx = latLngToWorldPixels(pinchRef.current.initialCenter.lat, pinchRef.current.initialCenter.lng, nextZoom);
      const dx = currentMidpoint.x - pinchRef.current.initialMidpoint.x;
      const dy = currentMidpoint.y - pinchRef.current.initialMidpoint.y;
      const nextPx = { x: baseCenterPx.x - dx, y: baseCenterPx.y - dy };

      setZoom(nextZoom);
      setCenter(worldPixelsToLatLng(nextPx.x, nextPx.y, nextZoom));
      return;
    }

    if (points.length === 1 && dragRef.current) {
      const point = points[0];
      const dx = point.x - dragRef.current.startPoint.x;
      const dy = point.y - dragRef.current.startPoint.y;
      const nextPx = {
        x: dragRef.current.startCenterPx.x - dx,
        y: dragRef.current.startCenterPx.y - dy,
      };
      setCenter(worldPixelsToLatLng(nextPx.x, nextPx.y, dragRef.current.zoom));
    }
  }

  function handlePointerUp(event) {
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    pointersRef.current.delete(event.pointerId);
    const points = Array.from(pointersRef.current.values());

    if (points.length >= 2) {
      startPinch(points);
    } else if (points.length === 1) {
      startDrag(points[0]);
    } else {
      dragRef.current = null;
      pinchRef.current = null;
    }
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <MapPin className="h-4 w-4 text-red-600" /> Adelaide dispatch map
            </div>
            <p className="mt-1 text-xs text-slate-500">One finger to move. Two fingers to zoom. Same address is grouped with a number.</p>
          </div>
          <button onClick={resetMap} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-900">Reset</button>
        </div>
      </div>

      <div
        className="relative h-[62vh] min-h-[460px] touch-none select-none overflow-hidden bg-slate-100"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <div className="absolute left-3 top-3 z-30 grid gap-2">
          <button onPointerDown={(e) => e.stopPropagation()} onClick={zoomIn} className="h-10 w-10 rounded-2xl bg-white text-xl font-black text-slate-950 shadow-md">+</button>
          <button onPointerDown={(e) => e.stopPropagation()} onClick={zoomOut} className="h-10 w-10 rounded-2xl bg-white text-xl font-black text-slate-950 shadow-md">−</button>
        </div>

        <div className="absolute left-1/2 top-1/2" style={{ width: map.size, height: map.size, transform: "translate(-50%, -50%)" }}>
          {map.tiles.map((tile) => (
            <img
              key={`${zoom}-${tile.x}-${tile.y}`}
              src={`https://a.tile.openstreetmap.org/${zoom}/${tile.x}/${tile.y}.png`}
              alt=""
              className="absolute select-none"
              style={{ left: tile.left, top: tile.top, width: TILE_SIZE, height: TILE_SIZE }}
              draggable={false}
            />
          ))}

          {groups.map((group) => {
            const point = latLngToWorldPixels(group.lat, group.lng, zoom);
            const left = point.x - map.origin.x;
            const top = point.y - map.origin.y;
            return <MapGroupMarker key={group.key} group={group} left={left} top={top} isOpen={openMarkerKey === group.key} setOpenMarkerKey={setOpenMarkerKey} mapProvider={mapProvider} suppressNavigationPrompt={suppressNavigationPrompt} onTake={onTake} onDeliver={onDeliver} onCourier={onCourier} />;
          })}
        </div>

        <div className="absolute bottom-2 right-2 rounded-lg bg-white/90 px-2 py-1 text-[10px] font-bold text-slate-800">
          © OpenStreetMap contributors · Zoom {zoom}
        </div>
      </div>
    </div>
  );
}

function buildTileMap(center, zoom, radius) {
  const centerPx = latLngToWorldPixels(center.lat, center.lng, zoom);
  const centerTileX = worldPixelsToTile(centerPx.x);
  const centerTileY = worldPixelsToTile(centerPx.y);
  const tiles = [];
  const tileCount = radius * 2 + 1;
  const size = tileCount * TILE_SIZE;
  const topLeftTileX = centerTileX - radius;
  const topLeftTileY = centerTileY - radius;
  const origin = { x: topLeftTileX * TILE_SIZE, y: topLeftTileY * TILE_SIZE };

  for (let x = centerTileX - radius; x <= centerTileX + radius; x += 1) {
    for (let y = centerTileY - radius; y <= centerTileY + radius; y += 1) {
      tiles.push({ x, y, left: (x - topLeftTileX) * TILE_SIZE, top: (y - topLeftTileY) * TILE_SIZE });
    }
  }

  return { tiles, size, origin };
}

function MapGroupMarker({ group, left, top, isOpen, setOpenMarkerKey, mapProvider, suppressNavigationPrompt, onTake, onDeliver, onCourier }) {
  const open = isOpen;
  const primary = group.primary;
  const urgent = group.urgentCount > 0;
  const color = group.takenCount === group.count ? "bg-slate-950" : urgent ? "bg-red-700" : "bg-red-500";
  const label = group.count > 1 ? String(group.count) : directionLabel(primary.direction);

  function stopMapEvent(event) {
    event.preventDefault();
    event.stopPropagation();
  }

  function handleTake(event, id) {
    stopMapEvent(event);
    onTake(id);
    setOpenMarkerKey(null);
  }

  function handleCourier(event, id) {
    stopMapEvent(event);
    onCourier(id);
    setOpenMarkerKey(null);
  }

  function handleDelivered(event, order) {
    stopMapEvent(event);
    onDeliver(order);
    setOpenMarkerKey(null);
  }

  return (
    <div className="absolute z-20" style={{ left, top }} onPointerDown={(e) => e.stopPropagation()}>
      <button
        onPointerDown={stopMapEvent}
        onClick={(e) => {
          stopMapEvent(e);
          setOpenMarkerKey(open ? null : group.key);
        }}
        className={`-translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white ${color} min-w-9 px-2 py-2 text-[11px] font-black text-white shadow-xl shadow-black/40`}
      >
        {label}
      </button>
      {open && (
        <div className="absolute left-3 top-3 w-72 rounded-2xl border border-slate-200 bg-white p-3 text-slate-950 shadow-2xl" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-black">{group.count > 1 ? `${group.count} orders at this address` : primary.equipment_id}</div>
              <div className="mt-1 text-xs font-bold text-slate-700">{primary.customer_name}</div>
              <div className="mt-1 text-xs text-slate-600">{displayAddress(primary)}</div>
            </div>
            {urgent && <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />}
          </div>
          <div className="mt-3 max-h-64 space-y-2 overflow-auto">
            {group.orders.map((order) => (
              <div key={order.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-2">
                <div className="text-xs font-black">{order.equipment_id}</div>
                <div className="mt-1 text-xs font-bold text-red-600">{order.toner_code}</div>
                <div className="mt-1 text-xs text-slate-600">{waitingDays(order.created_at)} days · {order.status}</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button type="button" onPointerDown={stopMapEvent} onClick={(e) => { stopMapEvent(e); openNavigation(order, mapProvider, suppressNavigationPrompt); }} className="col-span-2 flex items-center justify-center gap-1 rounded-xl border border-slate-300 bg-white px-2 py-2 text-xs font-black text-slate-900"><Navigation className="h-3 w-3" /> Navigate</button>
                  {order.status === "Waiting" ? (
                    <>
                      <button
                        type="button"
                        onPointerDown={stopMapEvent}
                        onClick={(e) => handleTake(e, order.id)}
                        className="rounded-xl bg-red-600 px-2 py-2 text-xs font-black text-white"
                      >
                        Take
                      </button>
                      <button
                        type="button"
                        onPointerDown={stopMapEvent}
                        onClick={(e) => handleCourier(e, order.id)}
                        className="rounded-xl bg-slate-900 px-2 py-2 text-xs font-black text-white"
                      >
                        Courier
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onPointerDown={stopMapEvent}
                      onClick={(e) => handleDelivered(e, order)}
                      className="col-span-2 rounded-xl bg-slate-950 px-2 py-2 text-xs font-black text-white"
                    >
                      Delivered
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PhotoImportSheet({ close, openManualEntry, onExtracted }) {
  const [imageName, setImageName] = useState("");
  const [imageBase64, setImageBase64] = useState("");
  const [mimeType, setMimeType] = useState("image/jpeg");
  const [busy, setBusy] = useState(false);
  const [scanError, setScanError] = useState("");
  const [preview, setPreview] = useState("");

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setImageName(file.name || "docket-photo.jpg");
    setMimeType(file.type || "image/jpeg");
    setScanError("");

    const compressed = await compressImageToBase64(file, 1600, 0.82);
    setImageBase64(compressed.base64);
    setMimeType(compressed.mimeType);
    setPreview(`data:${compressed.mimeType};base64,${compressed.base64}`);
  }

  async function recogniseDocket() {
    if (!imageBase64) {
      setScanError("Please take or upload a docket photo first.");
      return;
    }

    if (!supabase) {
      setScanError("Supabase is not connected. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
      return;
    }

    setBusy(true);
    setScanError("");

    const { data, error } = await supabase.functions.invoke("scan-docket", {
      body: {
        imageBase64,
        mimeType,
      },
    });

    setBusy(false);

    if (error) {
      setScanError(error.message || "Failed to scan docket.");
      return;
    }

    if (data?.error) {
      setScanError(data.error);
      return;
    }

    if (!data?.data) {
      setScanError("No extracted data returned.");
      return;
    }

    onExtracted(data.data);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/50 sm:items-center sm:justify-center">
      <div className="max-h-[92vh] w-full overflow-auto rounded-t-[2rem] border border-slate-200 bg-white p-4 shadow-2xl sm:max-w-2xl sm:rounded-[2rem]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-950">Scan Docket</h2>
            <p className="mt-1 text-xs text-slate-500">
              Take a photo of the delivery docket. The scan will extract Docket No, Deliver To, Equipment No, and product code.
            </p>
          </div>
          <button onClick={close} className="rounded-2xl bg-slate-100 p-2 text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="block rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />
          <div className="text-sm font-black text-slate-950">Tap to take/upload docket photo</div>
          <div className="mt-1 text-xs text-slate-500">{imageName || "No image selected"}</div>
        </label>

        {preview && (
          <div className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
            <img src={preview} alt="Docket preview" className="max-h-72 w-full object-contain" />
          </div>
        )}

        {scanError && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
            {scanError}
          </div>
        )}

        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          The scan will fill the Add Docket form. Please check the result before saving.
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button onClick={openManualEntry} className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-black text-slate-900">
            Manual Add
          </button>
          <button
            onClick={recogniseDocket}
            disabled={busy || !imageBase64}
            className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white disabled:bg-slate-200 disabled:text-slate-400"
          >
            {busy ? "Scanning..." : "Recognise"}
          </button>
        </div>
      </div>
    </div>
  );
}

function HistoryView({ orders, filters, setFilters }) {
  function updateFilter(field, value) {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }

  function clearFilters() {
    setFilters({ customer: "", from: "", to: "", model: "", staff: "" });
  }

  const summary = orders.reduce(
    (acc, order) => {
      if (order.status === "Delivered" && order.taken_by !== "Courier") acc.internal += 1;
      if (order.status === "Courier") acc.courier += 1;
      if (order.status === "Taken") acc.taken += 1;
      if (order.status === "Waiting") acc.waiting += 1;
      return acc;
    },
    { internal: 0, courier: 0, taken: 0, waiting: 0 }
  );

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-950">History</h2>
            <p className="mt-1 text-sm text-slate-500">Search by customer, date, toner/model, docket/equipment, or staff.</p>
          </div>
          <button onClick={clearFilters} className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-900">Clear</button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Customer" value={filters.customer} onChange={(v) => updateFilter("customer", v)} placeholder="Customer name" />
          <Field label="Model / Toner / Equipment" value={filters.model} onChange={(v) => updateFilter("model", v)} placeholder="WT-202 / 290459 / TG67B" />
          <Field label="From" type="date" value={filters.from} onChange={(v) => updateFilter("from", v)} />
          <Field label="To" type="date" value={filters.to} onChange={(v) => updateFilter("to", v)} />
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-black uppercase tracking-wider text-slate-500">Staff</span>
            <select value={filters.staff} onChange={(e) => updateFilter("staff", e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm font-bold text-slate-950 outline-none focus:border-red-500">
              <option value="">All staff</option>
              <option value="Courier">Courier</option>
              {staffOptions.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="grid grid-cols-4 gap-2">
        <Kpi label="Internal" value={summary.internal} />
        <Kpi label="Courier" value={summary.courier} />
        <Kpi label="Taken" value={summary.taken} />
        <Kpi label="Waiting" value={summary.waiting} />
      </section>

      <section className="space-y-3">
        {orders.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">No history records found.</div>
        ) : (
          orders.map((order) => <HistoryCard key={order.id} order={order} />)
        )}
      </section>
    </div>
  );
}

function HistoryCard({ order }) {
  const activityTime = order.delivered_at || order.courier_at || order.taken_at || order.created_at;
  const type = order.status === "Delivered" && order.taken_by !== "Courier" ? "Internal" : order.status === "Courier" ? "Courier" : order.status;
  const badgeClass = type === "Internal" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : type === "Courier" ? "bg-slate-100 text-slate-800 border-slate-200" : "bg-amber-50 text-amber-700 border-amber-200";

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-3.5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-black text-slate-950">{order.equipment_id}</h3>
            <span className={`rounded-full border px-2 py-1 text-[11px] font-black ${badgeClass}`}>{type}</span>
          </div>
          <p className="mt-1 truncate text-sm font-bold text-slate-700">{order.customer_name}</p>
          {order.docket_no && <p className="mt-0.5 text-[11px] font-bold text-slate-500">Docket {order.docket_no}</p>}
        </div>
        <div className="shrink-0 text-right text-[11px] font-bold text-slate-500">{formatDateAU(activityTime)}</div>
      </div>
      <div className="mt-2 space-y-1.5 text-xs text-slate-700">
        <Info icon={<MapPin className="h-3.5 w-3.5" />} text={displayAddress(order)} />
        <Info icon={<Package className="h-3.5 w-3.5" />} text={`${order.toner_code} · ${order.direction}`} />
        {order.taken_by && <Info icon={<UserCheck className="h-3.5 w-3.5" />} text={`By ${order.taken_by}`} />}
      </div>
    </article>
  );
}

function MineView({ staff, setStaff, mapProvider, setMapProvider, suppressNavigationPrompt, setSuppressNavigationPrompt, orders, onTake, onDeliver, onCourier }) {
  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-black text-slate-950">Mine</h2>
        <p className="mt-1 text-sm text-slate-500">Set your name, default map app, and navigation prompt preference.</p>

        <div className="mt-4 grid gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-black uppercase tracking-wider text-slate-500">Current staff</span>
            <select value={staff} onChange={(e) => setStaff(e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm font-bold text-slate-950 outline-none focus:border-red-500">
              {staffOptions.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-black uppercase tracking-wider text-slate-500">Default map app</span>
            <select value={mapProvider} onChange={(e) => setMapProvider(e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm font-bold text-slate-950 outline-none focus:border-red-500">
              {mapProviderOptions.map((m) => <option key={m}>{m}</option>)}
            </select>
          </label>

          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <input type="checkbox" checked={suppressNavigationPrompt} onChange={(e) => setSuppressNavigationPrompt(e.target.checked)} className="h-5 w-5 accent-red-600" />
            <span className="text-sm font-bold text-slate-800">Do not show navigation prompt again</span>
          </label>
        </div>
      </section>

      <section>
        <h3 className="mb-2 px-1 text-sm font-black uppercase tracking-wider text-slate-500">My taken deliveries</h3>
        <OrderList orders={orders} mapProvider={mapProvider} suppressNavigationPrompt={suppressNavigationPrompt} onTake={onTake} onDeliver={onDeliver} onCourier={onCourier} />
      </section>
    </div>
  );
}

function AddSheet({ form, updateForm, addOrder, close }) {
  const canSubmit = form.equipment_id && form.customer_name && form.suburb && form.direction && form.toner_code;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/50 sm:items-center sm:justify-center">
      <div className="max-h-[92vh] w-full overflow-auto rounded-t-[2rem] border border-slate-200 bg-white p-4 shadow-2xl sm:max-w-2xl sm:rounded-[2rem]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-950">Add Docket</h2>
            <p className="mt-1 text-xs text-slate-500">Enter Equipment ID first. Existing equipment will auto-fill customer and location.</p>
          </div>
          <button onClick={close} className="rounded-2xl bg-slate-100 p-2 text-slate-700"><X className="h-5 w-5" /></button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Docket No" value={form.docket_no} onChange={(v) => updateForm("docket_no", v)} placeholder="e.g. AN06561284" />
          <Field label="Equipment ID" value={form.equipment_id} onChange={(v) => updateForm("equipment_id", v)} icon={<Search className="h-4 w-4" />} placeholder="Machine / Equipment ID" />
          <Field label="Toner Code" value={form.toner_code} onChange={(v) => updateForm("toner_code", v)} icon={<Package className="h-4 w-4" />} placeholder="WT-B1 / W9060MC" />
          <Field label="Customer" value={form.customer_name} onChange={(v) => updateForm("customer_name", v)} placeholder="Customer name" />
          <Field label="Street address" value={form.street_address || form.address} onChange={(v) => updateForm("street_address", v)} placeholder="Street number and street name" />
          <Field label="Suburb" value={form.suburb} onChange={(v) => updateForm("suburb", v)} icon={<MapPin className="h-4 w-4" />} placeholder="Suburb" />
          <Field label="State" value={form.state} onChange={(v) => updateForm("state", v)} placeholder="SA / VIC / NSW" />
          <Field label="Postcode" value={form.postcode} onChange={(v) => updateForm("postcode", v)} placeholder="Postcode" />
          <Field label="Country" value={form.country} onChange={(v) => updateForm("country", v)} placeholder="Australia" />
          <Select label="Direction" value={form.direction} onChange={(v) => updateForm("direction", v)} options={["", ...directionOptions]} />
          <Select label="Priority" value={form.priority} onChange={(v) => updateForm("priority", v)} options={["Normal", "High"]} />
          <Field label="Notes" value={form.notes} onChange={(v) => updateForm("notes", v)} placeholder="Optional" />
          <Field label="Latitude" value={form.lat} onChange={(v) => updateForm("lat", v)} placeholder="Auto by suburb" />
          <Field label="Longitude" value={form.lng} onChange={(v) => updateForm("lng", v)} placeholder="Auto by suburb" />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button onClick={close} className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-black text-slate-900">Cancel</button>
          <button disabled={!canSubmit} onClick={addOrder} className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white disabled:bg-slate-200 disabled:text-slate-400">Save</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, icon, placeholder, type = "text" }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-black uppercase tracking-wider text-slate-500">{label}</span>
      <div className="relative">
        {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-red-600">{icon}</span>}
        <input type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm font-bold text-slate-950 outline-none placeholder:text-slate-400 focus:border-red-500 ${icon ? "pl-9" : ""}`} />
      </div>
    </label>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-black uppercase tracking-wider text-slate-500">{label}</span>
      <select value={value || ""} onChange={(e) => onChange(e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm font-bold text-slate-950 outline-none focus:border-red-500">
        {options.map((o) => <option key={o} value={o}>{o || "Select"}</option>)}
      </select>
    </label>
  );
}
function compressImageToBase64(file, maxSize = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas is not supported."));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      const mimeType = "image/jpeg";
      const dataUrl = canvas.toDataURL(mimeType, quality);
      const base64 = dataUrl.split(",")[1];

      resolve({ base64, mimeType });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image."));
    };

    img.src = objectUrl;
  });
}
