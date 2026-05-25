import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.jsx";
let text = readFileSync(appPath, "utf8");

function replaceOnce(oldText, newText, label) {
  if (text.includes(newText)) return;
  if (!text.includes(oldText)) {
    throw new Error(`Missing block: ${label}`);
  }
  text = text.replace(oldText, newText);
}

const oldDays = `function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}
`;

const newDays = `${oldDays}
function startOfTodayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
`;

if (!text.includes("function startOfTodayIso()")) {
  replaceOnce(oldDays, newDays, "startOfTodayIso");
}

text = text.replace(
  '  const [since, setSince] = useState(() => new Date().toISOString());',
  '  const [since, setSince] = useState(() => startOfTodayIso());'
);

replaceOnce(
  '  const [equipment, setEquipment] = useState({});\n',
  '  const [equipment, setEquipment] = useState({});\n  const [returnedConsumables, setReturnedConsumables] = useState([]);\n',
  "returnedConsumables state"
);

replaceOnce(
  '  const [showPhotoImport, setShowPhotoImport] = useState(false);\n',
  '  const [showPhotoImport, setShowPhotoImport] = useState(false);\n  const [showReturnForm, setShowReturnForm] = useState(false);\n',
  "showReturnForm state"
);

const oldLoad = `    const ordersResult = await supabase.from("dispatch_orders").select("*").order("created_at", { ascending: true });
    const equipmentResult = await supabase.from("equipment_master").select("*");

    if (ordersResult.error) setError(ordersResult.error.message);
    if (!ordersResult.error) setOrders(ordersResult.data || []);
`;

const newLoad = `    const ordersResult = await supabase.from("dispatch_orders").select("*").order("created_at", { ascending: true });
    const equipmentResult = await supabase.from("equipment_master").select("*");
    const resetResult = await supabase
      .from("dispatch_resets")
      .select("reset_at")
      .order("reset_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const returnedResult = await supabase
      .from("returned_consumables")
      .select("*")
      .order("returned_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (ordersResult.error) setError(ordersResult.error.message);
    if (!ordersResult.error) setOrders(ordersResult.data || []);
    if (!resetResult.error && resetResult.data?.reset_at) {
      setSince(resetResult.data.reset_at);
    } else {
      setSince(startOfTodayIso());
    }
    if (!returnedResult.error) setReturnedConsumables(returnedResult.data || []);
`;

replaceOnce(oldLoad, newLoad, "loadData queries");

const helperAnchor = '  async function resetPeriod() {\n';
const helperBlock = `  async function addReturnedConsumable(record) {
    const payload = {
      customer_name: record.customer_name.trim(),
      item_description: record.item_description.trim(),
      returned_date: record.returned_date || new Date().toISOString().slice(0, 10),
      staff_name: staff,
      notes: (record.notes || "").trim(),
      created_at: new Date().toISOString(),
    };

    if (!payload.customer_name || !payload.item_description || !payload.returned_date) {
      setError("Please complete customer, returned item and date.");
      return false;
    }

    if (supabase) {
      const result = await supabase
        .from("returned_consumables")
        .insert(payload)
        .select("*")
        .single();

      if (result.error) {
        setError(result.error.message);
        return false;
      }

      setReturnedConsumables((prev) => [result.data, ...prev]);
    } else {
      setReturnedConsumables((prev) => [
        {
          ...payload,
          id:
            typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : \`return-\${Date.now()}\`,
        },
        ...prev,
      ]);
    }

    setShowReturnForm(false);
    return true;
  }

  function exportReturnedConsumablesCsv() {
    const headers = ["Date", "Staff", "Customer", "Returned item", "Notes", "Created at"];
    const escapeCsv = (value) => {
      const valueText = String(value ?? "");
      if (/[",\\n\\r]/.test(valueText)) return \`"\${valueText.replaceAll('"', '""')}"\`;
      return valueText;
    };

    const rows = returnedConsumables.map((item) => [
      item.returned_date || "",
      item.staff_name || "",
      item.customer_name || "",
      item.item_description || "",
      item.notes || "",
      item.created_at || "",
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = \`returned-consumables-\${new Date().toISOString().slice(0, 10)}.csv\`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

`;

if (!text.includes("async function addReturnedConsumable")) {
  replaceOnce(helperAnchor, helperBlock + helperAnchor, "returned helpers");
}

text = text.replace(
  `            onCourier={markCourier}
            onDelete={deleteOrder}
          />`,
  `            onCourier={markCourier}
            onDelete={deleteOrder}
            onOpenReturnForm={() => setShowReturnForm(true)}
          />`
);

text = text.replace(
  `          <HistoryView
            orders={historyOrders}
            filters={historyFilters}
            setFilters={setHistoryFilters}
          />`,
  `          <HistoryView
            orders={historyOrders}
            filters={historyFilters}
            setFilters={setHistoryFilters}
            returnedConsumables={returnedConsumables}
            onExportReturnedConsumables={exportReturnedConsumablesCsv}
          />`
);

const modalAnchor = `      {showPhotoImport && (
        <PhotoImportSheet`;
const modalInsert = `      {showReturnForm && (
        <ReturnConsumableSheet
          staff={staff}
          onSave={addReturnedConsumable}
          close={() => setShowReturnForm(false)}
        />
      )}
`;

if (!text.includes("showReturnForm &&")) {
  replaceOnce(modalAnchor, modalInsert + modalAnchor, "return modal");
}

text = text.replace(
  "function HistoryView({ orders, filters, setFilters }) {",
  "function HistoryView({ orders, filters, setFilters, returnedConsumables = [], onExportReturnedConsumables }) {"
);

text = text.replace(
  '<button onClick={clearFilters} className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-900">Clear</button>',
  `<div className="flex shrink-0 gap-2">
            <button
              onClick={onExportReturnedConsumables}
              disabled={!returnedConsumables.length}
              className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
            >
              Export returns
            </button>
            <button onClick={clearFilters} className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-900">Clear</button>
          </div>`
);

text = text.replace(
  `  onCourier,
  onDelete,
}) {`,
  `  onCourier,
  onDelete,
  onOpenReturnForm,
}) {`
);

text = text.replace(
  `      <section>
        <h3 className="mb-2 px-1 text-sm font-black uppercase tracking-wider text-slate-500">My taken deliveries</h3>`,
  `      <section>
        <div className="mb-2 flex items-center justify-between gap-2 px-1">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-500">My taken deliveries</h3>
          <button
            type="button"
            onClick={onOpenReturnForm}
            className="rounded-2xl bg-red-600 px-3 py-2 text-xs font-black text-white shadow-sm active:scale-95"
          >
            Record return
          </button>
        </div>`
);

const componentAnchor = "function AddSheet({ form, updateForm, addOrder, close, saving }) {";
const returnSheet = `function ReturnConsumableSheet({ staff, onSave, close }) {
  const [form, setForm] = useState({
    customer_name: "",
    item_description: "",
    returned_date: new Date().toISOString().slice(0, 10),
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    const ok = await onSave(form);
    if (!ok) setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/50 sm:items-center sm:justify-center">
      <div className="max-h-[92vh] w-full overflow-auto rounded-t-[2rem] border border-slate-200 bg-white p-4 shadow-2xl sm:max-w-xl sm:rounded-[2rem]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-950">Record returned consumables</h2>
            <p className="mt-1 text-xs text-slate-500">For staff commission records. Staff: {staff}</p>
          </div>
          <button onClick={close} disabled={saving} className="rounded-2xl bg-slate-100 p-2 text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-3">
          <Field label="Customer / Organisation" value={form.customer_name} onChange={(v) => update("customer_name", v)} placeholder="e.g. City Accounting Group" />
          <Field label="Returned consumables" value={form.item_description} onChange={(v) => update("item_description", v)} placeholder="e.g. 2 x W9060MC Black, 1 x WT-B1" />
          <Field label="Date" type="date" value={form.returned_date} onChange={(v) => update("returned_date", v)} />
          <Field label="Notes" value={form.notes} onChange={(v) => update("notes", v)} placeholder="Optional" />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button onClick={close} disabled={saving} className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-black text-slate-900 disabled:bg-slate-100 disabled:text-slate-400">Cancel</button>
          <button type="button" disabled={saving || !form.customer_name.trim() || !form.item_description.trim()} onClick={handleSave} className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white disabled:bg-slate-200 disabled:text-slate-400">
            {saving ? "Saving..." : "Save return"}
          </button>
        </div>
      </div>
    </div>
  );
}

`;

if (!text.includes("function ReturnConsumableSheet")) {
  replaceOnce(componentAnchor, returnSheet + componentAnchor, "ReturnConsumableSheet");
}

writeFileSync(appPath, text);
console.log("Returned consumables patch applied");
