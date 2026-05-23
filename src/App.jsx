import React, { useEffect, useMemo, useRef, useState } from "react";
import { suburbDefaults, suburbOptions } from "./lib/saSuburbs";
import { createWorker } from "tesseract.js";
import {
  AlertTriangle,
  MapPin,
  Navigation,
  Package,
  Plus,
  Search,
  UserCheck,
  X,
} from "lucide-react";
import { supabase } from "./lib/supabaseClient";
import LoginScreen from "./components/LoginScreen";


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
    geocode_status: "pending",
    geocode_source: "none",
    geocode_formatted_address: "",
    geocode_place_id: "",
    geocode_location_type: "",
    geocoded_at: "",
    manual_location_override: false,
  };
}

function normalizeSuburb(value = "") {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .join("_");
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

function fullAddressForGeocode(source = {}) {
  const street = source.street_address || source.address || "";
  const state = source.state || "SA";
  const country = source.country || "Australia";
  return [street, source.suburb, state, source.postcode, country].filter(Boolean).join(", ");
}

function hasUsableLatLng(source = {}) {
  return Number.isFinite(Number(source.lat)) && Number.isFinite(Number(source.lng));
}

function shouldUseCachedLocation(record = {}) {
  return ["google_geocode", "manual_override"].includes(record.geocode_source) && hasUsableLatLng(record);
}

function navigationUrl(provider, order) {
  const destination = hasUsableLatLng(order)
    ? `${Number(order.lat)},${Number(order.lng)}`
    : navigationQuery(order);
  const query = encodeURIComponent(destination);
  if (provider === "Apple Maps") return `http://maps.apple.com/?daddr=${query}`;
  if (provider === "Waze") {
    if (hasCoords) return `https://waze.com/ul?ll=${query}&navigate=yes`;
    return `https://waze.com/ul?q=${query}&navigate=yes`;
  }
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
    const urgentCount = group.filter((o) => o.priority === "High" || waitingDays(o.created_at) >= 5).length;
    const takenCount = group.filter((o) => o.status === "Taken").length;
    return {
      key,
      orders: group,
      primary: first,
      count: group.length,
      urgentCount,
      takenCount,
      lat: baseLat,
      lng: baseLng,
    };
  });
}

function locationStatusLabel(order) {
  if (order.manual_location_override || order.geocode_source === "manual_override") return "manual confirmed";
  if (order.geocode_source === "google_geocode") return `Google ${order.geocode_location_type || "APPROXIMATE"}`;
  if (order.geocode_source === "suburb_default") return "suburb approximate";
  return "location unverified";
}

export default function TonerDispatchMVP() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(Boolean(supabase));

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
  const [staff, setStaff] = useState(() => {
    return getStoredPreference("toner_staff_name", "Aaron");
  });
  const [showAdd, setShowAdd] = useState(false);
  const [showPhotoImport, setShowPhotoImport] = useState(false);
  const [since, setSince] = useState(() => new Date().toISOString());
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm());
  const [savingOrder, setSavingOrder] = useState(false);
  const saveOrderLockRef = useRef(false);
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

  async function geocodeAddressWithGoogle(address) {
    if (!supabase || !address?.trim()) return null;
    const { data, error } = await supabase.functions.invoke("geocode-address", {
      body: { address: address.trim() },
    });
    if (error) return null;
    return data || null;
  }

  useEffect(() => {
  if (!supabase) {
    setAuthLoading(false);
    return;
  }

  supabase.auth.getSession().then(({ data }) => {
    setSession(data.session);
    setAuthLoading(false);
  });

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    setSession(session);

    if (!session) {
      localStorage.removeItem("toner_staff_name");
      setStaff("Aaron");
    }
  });

  return () => {
    data.subscription.unsubscribe();
  };
}, []);

useEffect(() => {
  if (!supabase || !session) return;
  loadData();
}, [session]);

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
        if (!row.last_delivery) return;
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
        next.geocode_status = found.geocode_status || "pending";
        next.geocode_source = found.geocode_source || "none";
        next.geocode_formatted_address = found.geocode_formatted_address || "";
        next.geocode_place_id = found.geocode_place_id || "";
        next.geocode_location_type = found.geocode_location_type || "";
        next.geocoded_at = found.geocoded_at || "";
        next.manual_location_override = Boolean(found.manual_location_override);
      }
    }

    if (field === "suburb") {
      const suburbKey = normalizeSuburb(value);
      const defaults = suburbDefaults[suburbKey];

      if (defaults) {
        next.suburb = value
          .trim()
          .split(" ")
          .filter(Boolean)
           .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
          .join(" ");

        next.direction = defaults.direction;
        next.lat = String(defaults.lat);
        next.lng = String(defaults.lng);
        next.geocode_source = "suburb_default";
        next.geocode_status = "pending";
        next.geocode_location_type = "APPROXIMATE";
        next.manual_location_override = false;
      } else {
        next.suburb = value;
      }
    }
    if (field === "lat" || field === "lng") {
      next.geocode_source = "manual_override";
      next.geocode_status = "success";
      next.manual_location_override = true;
      next.geocoded_at = new Date().toISOString();
    }
    setForm(next);
  }

  async function addOrder() {
  if (saveOrderLockRef.current) return;

  const defaults = suburbDefaults[normalizeSuburb(form.suburb)] || {};

  const equipmentKey = form.equipment_id.trim().toUpperCase();
  const cachedEquipment = equipment[equipmentKey] || null;
  const hasSuburbDefault = Number.isFinite(Number(defaults.lat)) && Number.isFinite(Number(defaults.lng));
  const fallbackLat = toNumber(form.lat || defaults.lat, ADELAIDE_CENTER.lat);
  const fallbackLng = toNumber(form.lng || defaults.lng, ADELAIDE_CENTER.lng);
  const isManualOverride = hasUsableLatLng(form) && (form.lat !== "" || form.lng !== "");

  const payload = {
    docket_no: form.docket_no.trim(),
    equipment_id: equipmentKey,
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
    created_by_name: staff,
    taken_by: null,
    taken_at: null,
    delivered_at: null,
    created_at: new Date().toISOString(),
    lat: fallbackLat,
    lng: fallbackLng,
    geocode_status: isManualOverride ? "success" : "pending",
    geocode_source: isManualOverride ? "manual_override" : hasSuburbDefault ? "suburb_default" : "none",
    geocode_formatted_address: null,
    geocode_place_id: null,
    geocode_location_type: null,
    geocoded_at: isManualOverride ? new Date().toISOString() : null,
    manual_location_override: isManualOverride,
    notes: form.notes.trim(),
  };

  if (
    !payload.equipment_id ||
    !payload.customer_name ||
    !payload.suburb ||
    !payload.direction ||
    !payload.toner_code
  ) {
    setError("Please complete Equipment ID, Customer, Suburb, Direction and Toner Code before saving.");
    return;
  }

  saveOrderLockRef.current = true;
  setSavingOrder(true);
  setError("");

  try {
    const geocodeAddress = fullAddressForGeocode(payload);
    if (cachedEquipment && shouldUseCachedLocation(cachedEquipment)) {
      payload.lat = Number(cachedEquipment.lat);
      payload.lng = Number(cachedEquipment.lng);
      payload.geocode_status = "success";
      payload.geocode_source = cachedEquipment.geocode_source;
      payload.geocode_formatted_address = cachedEquipment.geocode_formatted_address || null;
      payload.geocode_place_id = cachedEquipment.geocode_place_id || null;
      payload.geocode_location_type = cachedEquipment.geocode_location_type || null;
      payload.geocoded_at = cachedEquipment.geocoded_at || new Date().toISOString();
      payload.manual_location_override = cachedEquipment.geocode_source === "manual_override";
    } else if (hasSuburbDefault || isManualOverride) {
      const geocode = !isManualOverride ? await geocodeAddressWithGoogle(geocodeAddress) : null;
      if (geocode?.lat != null && geocode?.lng != null) {
        payload.lat = Number(geocode.lat);
        payload.lng = Number(geocode.lng);
        payload.geocode_status = "success";
        payload.geocode_source = "google_geocode";
        payload.geocode_formatted_address = geocode.formatted_address || null;
        payload.geocode_place_id = geocode.place_id || null;
        payload.geocode_location_type = geocode.location_type || null;
        payload.geocoded_at = new Date().toISOString();
        payload.manual_location_override = false;
      } else if (!isManualOverride) {
        payload.lat = fallbackLat;
        payload.lng = fallbackLng;
        payload.geocode_status = "failed";
        payload.geocode_source = "suburb_default";
        payload.manual_location_override = false;
      }
    }

    if (supabase) {
      const { data: authData } = await supabase.auth.getUser();
      const currentUser = authData?.user;

      const finalPayload = {
        ...payload,
        created_by: currentUser?.id || null,
      };

      const insertResult = await supabase
        .from("dispatch_orders")
        .insert(finalPayload)
        .select("*")
        .single();

      if (insertResult.error) {
        setError(insertResult.error.message);
        return;
      }

      setOrders((prev) => [...prev, insertResult.data]);
    } else {
      const localRow = {
        ...payload,
        id:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `local-${Date.now()}`,
      };

      setOrders((prev) => [...prev, localRow]);
    }

    setForm(emptyForm());
    setShowAdd(false);
  } finally {
    saveOrderLockRef.current = false;
    setSavingOrder(false);
  }
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
      const equipmentPayload = {
        equipment_id: (order.equipment_id || "").trim().toUpperCase(),
        customer_name: order.customer_name || "",
        address: order.address || order.street_address || "",
        street_address: order.street_address || order.address || "",
        suburb: order.suburb || "",
        state: order.state || "SA",
        postcode: order.postcode || "",
        country: order.country || "Australia",
        direction: order.direction || "",
        lat: order.lat,
        lng: order.lng,
        last_delivery: deliveredAt,
        updated_at: deliveredAt,
        geocode_status: order.geocode_status ?? null,
        geocode_source: order.geocode_source ?? null,
        geocode_formatted_address: order.geocode_formatted_address ?? null,
        geocode_place_id: order.geocode_place_id ?? null,
        geocode_location_type: order.geocode_location_type ?? null,
        geocoded_at: order.geocoded_at ?? null,
        manual_location_override: order.manual_location_override ?? false,
      };
      await supabase.from("equipment_master").upsert(equipmentPayload);
    }

    setEquipment((prev) => ({
      ...prev,
      [(order.equipment_id || "").trim().toUpperCase()]: {
        ...(prev[(order.equipment_id || "").trim().toUpperCase()] || {}),
        equipment_id: (order.equipment_id || "").trim().toUpperCase(),
        customer_name: order.customer_name || "",
        address: order.address || order.street_address || "",
        street_address: order.street_address || order.address || "",
        suburb: order.suburb || "",
        state: order.state || "SA",
        postcode: order.postcode || "",
        country: order.country || "Australia",
        direction: order.direction || "",
        lat: order.lat,
        lng: order.lng,
        last_delivery: deliveredAt,
        updated_at: deliveredAt,
        geocode_status: order.geocode_status ?? null,
        geocode_source: order.geocode_source ?? null,
        geocode_formatted_address: order.geocode_formatted_address ?? null,
        geocode_place_id: order.geocode_place_id ?? null,
        geocode_location_type: order.geocode_location_type ?? null,
        geocoded_at: order.geocoded_at ?? null,
        manual_location_override: order.manual_location_override ?? false,
      },
    }));
  }

  async function deleteOrder(order) {
  const confirmed = window.confirm(
    `Delete this docket?\n\n${order.equipment_id || ""}\n${order.customer_name || ""}\n${order.toner_code || ""}`
  );

  if (!confirmed) return;

  setOrders((prev) => prev.filter((o) => o.id !== order.id));

  if (supabase && !String(order.id).startsWith("demo-")) {
    const result = await supabase
      .from("dispatch_orders")
      .delete()
      .eq("id", order.id);

    if (result.error) {
      setError(result.error.message);
      await loadData();
    }
  }
}
  
  if (authLoading) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-700 font-bold">
      Checking login...
    </div>
  );
}

if (supabase && !session) {
  return (
    <LoginScreen
      onLogin={(_user, name) => {
        localStorage.setItem("toner_staff_name", name);
        setStaff(name);
      }}
    />
  );
}
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-40 shrink-0 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-red-600">Toner Dispatch</div>
            <h1 className="text-lg font-black leading-tight sm:text-2xl">Daily Board</h1>
          </div>
          <div className="flex items-center gap-2">
            {session && (
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  localStorage.removeItem("toner_staff_name");
                  setStaff("Aaron");
                }}
                className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm active:scale-95"
              >
                Logout
              </button>
            )}

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

      <main className="mx-auto w-full max-w-5xl flex-1 overflow-y-auto px-3 pb-4 pt-4 sm:px-4">
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
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
            Loading dispatch data...
          </div>
        ) : tab === "Map" ? (
          <MapView
            orders={visibleOrders}
            area={area}
            mapProvider={mapProvider}
            suppressNavigationPrompt={suppressNavigationPrompt}
            onTake={takeOrder}
            onDeliver={deliverOrder}
            onCourier={markCourier}
          />
        ) : tab === "Mine" ? (
          <MineView
            staff={staff}
            setStaff={setStaff}
            mapProvider={mapProvider}
            setMapProvider={setMapProvider}
            suppressNavigationPrompt={suppressNavigationPrompt}
            setSuppressNavigationPrompt={setSuppressNavigationPrompt}
            orders={visibleOrders}
            onTake={takeOrder}
            onDeliver={deliverOrder}
            onCourier={markCourier}
            onDelete={deleteOrder}
          />
        ) : tab === "History" ? (
          <HistoryView
            orders={historyOrders}
            filters={historyFilters}
            setFilters={setHistoryFilters}
          />
        ) : (
          <OrderList
            orders={visibleOrders}
            mapProvider={mapProvider}
            suppressNavigationPrompt={suppressNavigationPrompt}
            onTake={takeOrder}
            onDeliver={deliverOrder}
            onCourier={markCourier}
            onDelete={deleteOrder}
          />
        )}
      </main>

      <nav className="z-40 shrink-0 border-t border-slate-200 bg-white/95 px-3 py-3 shadow-lg backdrop-blur">
        <div className="mx-auto grid max-w-5xl grid-cols-4 gap-2">
          <BottomTab active={tab === "Board"} label="Board" icon={<Package className="h-5 w-5" />} onClick={() => setTab("Board")} />
          <BottomTab active={tab === "Map"} label="Map" icon={<MapPin className="h-5 w-5" />} onClick={() => setTab("Map")} />
          <BottomTab active={tab === "Mine"} label="Mine" icon={<UserCheck className="h-5 w-5" />} onClick={() => setTab("Mine")} />
          <BottomTab active={tab === "History"} label="History" icon={<Search className="h-5 w-5" />} onClick={() => setTab("History")} />
        </div>
      </nav>

      {showAdd && (
        <AddSheet
          form={form}
          updateForm={updateForm}
          addOrder={addOrder}
          saving={savingOrder}
          close={() => {
            if (!savingOrder) setShowAdd(false);
          }}
        />
      )}
      {showPhotoImport && (
        <PhotoImportSheet
          close={() => setShowPhotoImport(false)}
          openManualEntry={() => {
            setShowPhotoImport(false);
            setShowAdd(true);
          }}
          onExtracted={(data) => {
            const suburbRaw = data.suburb || "";
            const suburbKey = normalizeSuburb(suburbRaw);
            const defaults = suburbDefaults[suburbKey] || {};

            const suburbDisplay = suburbRaw
              ? suburbRaw
                  .trim()
                  .split(" ")
                  .filter(Boolean)
                  .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
                  .join(" ")
              : "";

            setForm({
              ...emptyForm(),
              docket_no: data.docket_no || "",
              equipment_id: data.equipment_id || "",
              customer_name: data.customer_name || "",
              address: data.street_address || "",
              street_address: data.street_address || "",
              suburb: suburbDisplay,
              state: data.state || "SA",
              postcode: data.postcode || "",
              country: data.country || "Australia",
              direction: defaults.direction || "",
              toner_code: data.toner_code || "",
              priority: data.priority || "Normal",
              notes: data.notes || "",
              lat: defaults.lat != null ? String(defaults.lat) : "",
              lng: defaults.lng != null ? String(defaults.lng) : "",
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

function OrderList({ orders, mapProvider, suppressNavigationPrompt, onTake, onDeliver, onCourier, onDelete }) {
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
              <OrderCard
                key={order.id}
                order={order}
                mapProvider={mapProvider}
                suppressNavigationPrompt={suppressNavigationPrompt}
                onTake={onTake}
                onDeliver={onDeliver}
                onCourier={onCourier}
                onDelete={onDelete}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function OrderCard({ order, mapProvider, suppressNavigationPrompt, onTake, onDeliver, onCourier, onDelete }) {
  const days = waitingDays(order.created_at);
  const urgent = order.priority === "High" || days >= 5;
  const [dragX, setDragX] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const startXRef = useRef(0);
  const draggingRef = useRef(false);

  function handleTouchStart(event) {
    startXRef.current = event.touches[0].clientX;
    draggingRef.current = true;
  }

  function handleTouchMove(event) {
    if (!draggingRef.current) return;

    const currentX = event.touches[0].clientX;
    const deltaX = currentX - startXRef.current;

    if (deltaX < 0) {
      setDragX(Math.max(deltaX, -96));
    } else if (isOpen) {
      setDragX(Math.min(-96 + deltaX, 0));
    }
  }

  function handleTouchEnd() {
    draggingRef.current = false;

    if (dragX <= -48) {
      setDragX(-96);
      setIsOpen(true);
    } else {
      setDragX(0);
      setIsOpen(false);
    }
  }

  function closeSwipe() {
    setDragX(0);
    setIsOpen(false);
  }

  return (
    <div className="relative overflow-hidden rounded-3xl">
      <div className="absolute inset-y-0 right-0 flex w-24 items-center justify-center bg-red-600">
        <button
          type="button"
          onClick={() => {
            closeSwipe();
            onDelete(order);
          }}
          className="h-full w-full text-sm font-black text-white"
        >
          Delete
        </button>
      </div>

      <article
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: draggingRef.current ? "none" : "transform 180ms ease",
        }}
        className={`relative rounded-3xl border p-3.5 shadow-sm ${
          urgent ? "border-red-300 bg-red-50" : "border-slate-200 bg-white"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-base font-black text-slate-950">{order.equipment_id}</h2>
              {urgent && <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />}
            </div>
            <p className="mt-1 truncate text-sm font-bold text-slate-700">{order.customer_name}</p>
            {order.docket_no && <p className="mt-0.5 truncate text-[11px] font-bold text-slate-500">Docket {order.docket_no}</p>}
            <p className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase text-slate-600">{locationStatusLabel(order)}</p>
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
              <button
                onClick={() => onTake(order.id)}
                className="rounded-2xl bg-red-600 px-2 py-3 text-xs font-black text-white active:scale-[.98]"
              >
                Take
              </button>
              <button
                onClick={() => onCourier(order.id)}
                className="rounded-2xl bg-slate-950 px-2 py-3 text-xs font-black text-white active:scale-[.98]"
              >
                Courier
              </button>
            </>
          ) : (
            <button
              onClick={() => onDeliver(order)}
              className="col-span-2 rounded-2xl bg-slate-950 px-2 py-3 text-xs font-black text-white active:scale-[.98]"
            >
              Delivered
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => onDelete(order)}
          className="mt-2 w-full rounded-2xl border border-red-200 bg-red-50 px-2 py-2 text-xs font-black text-red-700 sm:hidden"
        >
          Delete
        </button>
      </article>
    </div>
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
  const MAP_DRAG_SENSITIVITY = 0.35;
  const MAP_DRAG_SMOOTHING = 0.65;
  const [center, setCenter] = useState(ADELAIDE_CENTER);
  const [zoom, setZoom] = useState(MAP_ZOOM);
  const [openMarkerKey, setOpenMarkerKey] = useState(null);
  const lastAreaRef = useRef("All");
  const pointersRef = useRef(new Map());
  const dragRef = useRef(null);
  const pinchRef = useRef(null);
  const latestCenterRef = useRef(ADELAIDE_CENTER);
  const targetCenterRef = useRef(ADELAIDE_CENTER);
  const mapAnimationRef = useRef(null);
  const map = useMemo(() => buildTileMap(center, zoom, 3), [center, zoom]);
  const groups = useMemo(() => groupOrdersForMap(orders), [orders]);

  function stopMapAnimation() {
    if (mapAnimationRef.current != null) {
      cancelAnimationFrame(mapAnimationRef.current);
      mapAnimationRef.current = null;
    }
  }

  function setMapCenterImmediate(nextCenter) {
    stopMapAnimation();
    latestCenterRef.current = nextCenter;
    targetCenterRef.current = nextCenter;
    setCenter(nextCenter);
  }

  function animateMapToTarget() {
    const current = latestCenterRef.current;
    const target = targetCenterRef.current;
    const next = {
      lat: current.lat + (target.lat - current.lat) * MAP_DRAG_EASING,
      lng: current.lng + (target.lng - current.lng) * MAP_DRAG_EASING,
    };
    const isClose = Math.abs(target.lat - next.lat) < 0.00001 && Math.abs(target.lng - next.lng) < 0.00001;

    if (isClose) {
      latestCenterRef.current = target;
      setCenter(target);
      mapAnimationRef.current = null;
      return;
    }

    latestCenterRef.current = next;
    setCenter(next);
    mapAnimationRef.current = requestAnimationFrame(animateMapToTarget);
  }

  function setMapCenterSmooth(nextCenter) {
    targetCenterRef.current = nextCenter;
    if (mapAnimationRef.current == null) {
      mapAnimationRef.current = requestAnimationFrame(animateMapToTarget);
    }
  }

  useEffect(() => {
    latestCenterRef.current = center;
  }, [center]);

  useEffect(() => {
    return () => {
      stopMapAnimation();
    };
  }, []);

  useEffect(() => {
    if (lastAreaRef.current === area) return;
    lastAreaRef.current = area;
    const focus = directionFocus[area] || directionFocus.All;
    setMapCenterImmediate({ lat: focus.lat, lng: focus.lng });
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
    setMapCenterImmediate({ lat: focus.lat, lng: focus.lng });
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
      startCenterPx: latLngToWorldPixels(latestCenterRef.current.lat, latestCenterRef.current.lng, zoom),
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
    event.preventDefault();
    pointersRef.current.set(event.pointerId, pointFromEvent(event));
    moveMapFromPoints(Array.from(pointersRef.current.values()));
  }

  function moveMapFromPoints(points) {
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
      setMapCenterImmediate(worldPixelsToLatLng(nextPx.x, nextPx.y, nextZoom));
      return;
    }

    if (points.length === 1 && dragRef.current) {
      const point = points[0];
      const dx = (point.x - dragRef.current.startPoint.x) * MAP_DRAG_SENSITIVITY;
      const dy = (point.y - dragRef.current.startPoint.y) * MAP_DRAG_SENSITIVITY;
      const nextPx = {
        x: dragRef.current.startCenterPx.x - dx,
        y: dragRef.current.startCenterPx.y - dy,
      };
      const nextCenter = worldPixelsToLatLng(nextPx.x, nextPx.y, dragRef.current.zoom);
      setCenter((current) => ({
        lat: current.lat + (nextCenter.lat - current.lat) * MAP_DRAG_SMOOTHING,
        lng: current.lng + (nextCenter.lng - current.lng) * MAP_DRAG_SMOOTHING,
      }));
    }
  }

  function handleTouchStart(event) {
    event.preventDefault();
    pointersRef.current.clear();
    for (let i = 0; i < event.touches.length; i += 1) {
      const touch = event.touches[i];
      pointersRef.current.set(touch.identifier, { x: touch.clientX, y: touch.clientY });
    }
    const points = Array.from(pointersRef.current.values());
    if (points.length >= 2) startPinch(points);
    else if (points.length === 1) startDrag(points[0]);
  }

  function handleTouchMove(event) {
    event.preventDefault();
    pointersRef.current.clear();
    for (let i = 0; i < event.touches.length; i += 1) {
      const touch = event.touches[i];
      pointersRef.current.set(touch.identifier, { x: touch.clientX, y: touch.clientY });
    }
    moveMapFromPoints(Array.from(pointersRef.current.values()));
  }

  function handleTouchEnd(event) {
    event.preventDefault();
    pointersRef.current.clear();
    for (let i = 0; i < event.touches.length; i += 1) {
      const touch = event.touches[i];
      pointersRef.current.set(touch.identifier, { x: touch.clientX, y: touch.clientY });
    }
    const points = Array.from(pointersRef.current.values());
    if (points.length >= 2) startPinch(points);
    else if (points.length === 1) startDrag(points[0]);
    else {
      dragRef.current = null;
      pinchRef.current = null;
    }
  }

  function handleTouchStart(event) {
    event.preventDefault();
    pointersRef.current.clear();
    for (let i = 0; i < event.touches.length; i += 1) {
      const touch = event.touches[i];
      pointersRef.current.set(touch.identifier, { x: touch.clientX, y: touch.clientY });
    }
    const points = Array.from(pointersRef.current.values());
    if (points.length >= 2) startPinch(points);
    else if (points.length === 1) startDrag(points[0]);
  }

  function handleTouchMove(event) {
    event.preventDefault();
    pointersRef.current.clear();
    for (let i = 0; i < event.touches.length; i += 1) {
      const touch = event.touches[i];
      pointersRef.current.set(touch.identifier, { x: touch.clientX, y: touch.clientY });
    }
    moveMapFromPoints(Array.from(pointersRef.current.values()));
  }

  function handleTouchEnd(event) {
    event.preventDefault();
    pointersRef.current.clear();
    for (let i = 0; i < event.touches.length; i += 1) {
      const touch = event.touches[i];
      pointersRef.current.set(touch.identifier, { x: touch.clientX, y: touch.clientY });
    }
    const points = Array.from(pointersRef.current.values());
    if (points.length >= 2) startPinch(points);
    else if (points.length === 1) startDrag(points[0]);
    else {
      dragRef.current = null;
      pinchRef.current = null;
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
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        style={{ touchAction: "none", WebkitUserSelect: "none", userSelect: "none", WebkitTouchCallout: "none" }}
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
                <div className="mt-1 text-[10px] font-black uppercase text-slate-500">{locationStatusLabel(order)}</div>
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
function ocrDigitsOnly(value = "") {
  return value
    .toUpperCase()
    .replace(/O/g, "0")
    .replace(/Q/g, "0")
    .replace(/D/g, "0")
    .replace(/I/g, "1")
    .replace(/L/g, "1")
    .replace(/\|/g, "1")
    .replace(/S/g, "5")
    .replace(/Z/g, "2")
    .replace(/B/g, "8")
    .replace(/G/g, "6")
    .replace(/[^0-9]/g, "");
}

function normaliseDocketNo(value = "") {
  const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, "");

  if (cleaned.length < 4) return "";

  const prefix = cleaned.slice(0, 2).replace(/0/g, "O").replace(/1/g, "I");
  const digits = ocrDigitsOnly(cleaned.slice(2));

  if (!/^[A-Z]{2}$/.test(prefix)) return "";
  if (digits.length < 5) return "";

  return `${prefix}${digits}`;
}

function normaliseEquipmentNo(value = "") {
  const digits = ocrDigitsOnly(value);
  return digits.length >= 4 ? digits : "";
}

function extractDocketFieldsFromText(text = "") {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const fullText = lines.join("\n");

  function matchOne(patterns) {
    for (const pattern of patterns) {
      const match = fullText.match(pattern);
      if (match?.[1]) return match[1].trim();
    }
    return "";
  }

  const rawDocketNo = matchOne([
    /docket\s*(?:no|number|#)?\s*[:\-]?\s*([A-Z0-9\-\s]{6,20})/i,
    /(?:delivery|dispatch)\s*(?:no|number|#)\s*[:\-]?\s*([A-Z0-9\-\s]{6,20})/i,
    /\b([A-Z]{2}[A-Z0-9]{5,12})\b/i,
  ]);

  const docket_no = normaliseDocketNo(rawDocketNo);

  const rawEquipmentNo = matchOne([
    /equipment\s*(?:id|no|number)?\s*[:\-]?\s*([A-Z0-9\-\s]{4,20})/i,
    /equip(?:ment)?\s*(?:id|no|number)?\s*[:\-]?\s*([A-Z0-9\-\s]{4,20})/i,
    /machine\s*(?:id|no|number)?\s*[:\-]?\s*([A-Z0-9\-\s]{4,20})/i,
    /serial\s*(?:id|no|number)?\s*[:\-]?\s*([A-Z0-9\-\s]{4,20})/i,
  ]);

  const equipment_id = normaliseEquipmentNo(rawEquipmentNo);

  const toner_code = matchOne([
    /(?:toner|product|item|code)\s*(?:code|no|number)?\s*[:\-]?\s*([A-Z0-9\- ]{3,30})/i,
    /\b(WT-[A-Z0-9]+)\b/i,
    /\b(W\d{4,}[A-Z]{0,3})\b/i,
  ]);

  let customer_name = matchOne([
    /deliver\s*to\s*[:\-]?\s*(.+)/i,
    /customer\s*[:\-]?\s*(.+)/i,
    /client\s*[:\-]?\s*(.+)/i,
  ]);

  let street_address = matchOne([
    /address\s*[:\-]?\s*(.+)/i,
  ]);

  let suburb = "";
  let postcode = "";
  let state = "SA";
  let country = "Australia";

  const postcodeLine = lines.find((line) =>
    /\b(SA|VIC|NSW|QLD|WA|TAS|ACT|NT)\b\s+\d{4}\b/i.test(line)
  );

  if (postcodeLine) {
    const m = postcodeLine.match(/(.+?)\s+\b(SA|VIC|NSW|QLD|WA|TAS|ACT|NT)\b\s+(\d{4})\b/i);
    if (m) {
      suburb = m[1].trim();
      state = m[2].toUpperCase();
      postcode = m[3];
    }
  }
  if (!suburb && suburbOptions.length > 0) {
  const textForSearch = ` ${fullText.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;

  const matchedSuburb = suburbOptions.find((item) => {
    const label = item.label.toLowerCase();
    return textForSearch.includes(` ${label} `);
  });

  if (matchedSuburb) {
    suburb = matchedSuburb.label;
  }
}
  if (!street_address) {
    const possibleAddress = lines.find((line) =>
      /^\d+\s+[A-Za-z]/.test(line) &&
      /(road|rd|street|st|avenue|ave|drive|dr|court|ct|terrace|tce|highway|hwy|lane|ln)/i.test(line)
    );
    street_address = possibleAddress || "";
  }

  if (!customer_name) {
    const deliverIndex = lines.findIndex((line) => /deliver\s*to/i.test(line));
    if (deliverIndex >= 0 && lines[deliverIndex + 1]) {
      customer_name = lines[deliverIndex + 1];
    }
  }

  return {
    docket_no,
    equipment_id,
    customer_name,
    street_address,
    suburb,
    state,
    postcode,
    country,
    toner_code: toner_code.trim().toUpperCase(),
    priority: "Normal",
    notes: `OCR text:\n${fullText.slice(0, 1200)}`,
  };
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
  if (!preview) {
    setScanError("Please take or upload a docket photo first.");
    return;
  }

  setBusy(true);
  setScanError("");

  try {
    const worker = await createWorker("eng");

    const result = await worker.recognize(preview);
    await worker.terminate();

    const rawText = result?.data?.text || "";

    if (!rawText.trim()) {
      setScanError("No text was recognised. Please retake the photo with better lighting.");
      return;
    }

    const extracted = extractDocketFieldsFromText(rawText);

    if (!extracted.equipment_id && !extracted.docket_no && !extracted.toner_code) {
      setScanError("Text was recognised, but key fields were not found. Please use Manual Add.");
      return;
    }

    onExtracted(extracted);
  } catch (err) {
    setScanError(err?.message || "OCR failed. Please try again or use Manual Add.");
  } finally {
    setBusy(false);
  }
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
          Free OCR will read the docket on this phone. Please check the result before saving.
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

function MineView({
  staff,
  setStaff,
  mapProvider,
  setMapProvider,
  suppressNavigationPrompt,
  setSuppressNavigationPrompt,
  orders,
  onTake,
  onDeliver,
  onCourier,
  onDelete,
}) {
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
        <OrderList
          orders={orders}
          mapProvider={mapProvider}
          suppressNavigationPrompt={suppressNavigationPrompt}
          onTake={onTake}
          onDeliver={onDeliver}
          onCourier={onCourier}
          onDelete={onDelete}
        />
      </section>
    </div>
  );
}

function AddSheet({ form, updateForm, addOrder, close, saving }) {
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
          <SuburbSelect label="Suburb" value={form.suburb} onChange={(v) => updateForm("suburb", v)} />
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
          <button
            onClick={close}
            disabled={saving}
            className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-black text-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={!canSubmit || saving}
            onClick={addOrder}
            className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white disabled:bg-slate-200 disabled:text-slate-400"
          >
            {saving ? "Saving..." : "Save"}
          </button>
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

function SuburbSelect({ label, value, onChange }) {
  const [query, setQuery] = useState(value || "");
  const [open, setOpen] = useState(false);

  const hasSuburbs = suburbOptions.length > 0;

  const filteredSuburbs = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    if (!keyword) {
      return suburbOptions.slice(0, 12);
    }

    return suburbOptions
      .filter((suburb) => {
        const label = suburb.label.toLowerCase();
        const key = suburb.key.toLowerCase().replaceAll("_", " ");
        return label.includes(keyword) || key.includes(keyword);
      })
      .slice(0, 12);
  }, [query]);

  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  function chooseSuburb(suburb) {
    setQuery(suburb.label);
    setOpen(false);
    onChange(suburb.label);
  }

  return (
    <label className="relative block">
      <span className="mb-1 block text-xs font-black uppercase tracking-wider text-slate-500">
        {label}
      </span>

      <input
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        placeholder={hasSuburbs ? "Type suburb, e.g. Prospect" : "No suburbs loaded"}
        className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm font-bold text-slate-950 outline-none placeholder:text-slate-400 focus:border-red-500"
      />

      {!hasSuburbs && (
        <div className="mt-1 text-xs font-bold text-red-600">
          Suburb table is empty. Re-run Build SA suburbs in GitHub Actions.
        </div>
      )}

      {open && hasSuburbs && (
        <div className="absolute left-0 right-0 z-[70] mt-1 max-h-72 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
          {filteredSuburbs.length === 0 ? (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              className="w-full px-3 py-3 text-left text-sm font-bold text-slate-500"
            >
              No matching suburb
            </button>
          ) : (
            filteredSuburbs.map((suburb) => (
              <button
                key={suburb.key}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  chooseSuburb(suburb);
                }}
                className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-3 text-left last:border-b-0 active:bg-slate-100"
              >
                <span className="text-sm font-black text-slate-950">
                  {suburb.label}
                </span>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-black text-red-600">
                  {suburb.direction}
                </span>
              </button>
            ))
          )}
        </div>
      )}

      {open && (
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[60] cursor-default bg-transparent"
          aria-label="Close suburb suggestions"
        />
      )}
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
