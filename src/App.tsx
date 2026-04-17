import { useState } from "react";
import productRaw from "./data/mock-product.json";
import productionRaw from "./data/mock-production.json";



type Product = {
  id: string;
  name: string;
  stock: number;
  min_stock: number;
  max_stock: number;
  unit: string;
  piece_per_package: number;
  piece_per_tray: number;
  factory_id: number;
  station: { "1": number; "2": number; "3": number };
  CreatedAt: string;
  UpdatedAt: string;
  DeletedAt: string | null;
};

type ProductionRecord = {
  ID: number;
  planning_id: number;
  product_id: string;
  factory_id: number;
  import_quantity: number;
  lost_quantity: number;
  export_quantity: number;
  status: "finished" | "processing" | "init";
  station: number;
  shipping_time: string;
  start_time: string;
  end_time: string;
  CreatedAt: string;
};

type ProblemType = "วัตถุดิบหมด" | "เครื่องเสีย" | "ไหม้";
type StationKey = "1" | "2" | "3";
type CardStatus = "ปกติ" | "มีปัญหา";

function formatShippingTime(t: string): string {
  return t.slice(0, 5);
}

function formatDate(iso: string): string {
  if (!iso || iso.startsWith("0001")) return "-";
  return new Date(iso).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default function App() {
  const products = productRaw.products as Product[];
  const productions = productionRaw.data as ProductionRecord[];

  const [station, setStation] = useState<StationKey>("1");
  const [productFilter, setProductFilter] = useState("");
  const [factoryFilter, setFactoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [shippingFilter, setShippingFilter] = useState("");
  const [sendTray, setSendTray] = useState<{ [key: number]: string }>({});
  const [cardStatuses, setCardStatuses] = useState<{ [key: number]: CardStatus }>({});

  const [modalOpen, setModalOpen] = useState(false);
  const [modalProductionId, setModalProductionId] = useState<number | null>(null);
  const [problemType, setProblemType] = useState<ProblemType | "">("");
  const [problemQty, setProblemQty] = useState("");

  const stations: StationKey[] = ["1", "2", "3"];

  type CardData = {
    productionId: number;
    product: Product;
    production: ProductionRecord;
    remainingTrays: number;
  };

  const cardDataList: CardData[] = productions
    .filter((pr) => pr.station === Number(station))
    .map((pr) => {
      const product = products.find((p) => p.id === pr.product_id);
      if (!product) return null;
      const remainingTrays = Math.floor(
        product.station[station] / product.piece_per_tray
      );
      return { productionId: pr.ID, product, production: pr, remainingTrays };
    })
    .filter((x): x is CardData => x !== null);

  // cardDataList ทั้งหมด (ไม่กรอง station ซ้ำ) สำหรับหา modalCard
  const allCardDataList: CardData[] = productions
    .map((pr) => {
      const product = products.find((p) => p.id === pr.product_id);
      if (!product) return null;
      const st = pr.station.toString() as StationKey;
      const remainingTrays = Math.floor(
        (product.station[st] ?? 0) / product.piece_per_tray
      );
      return { productionId: pr.ID, product, production: pr, remainingTrays };
    })
    .filter((x): x is CardData => x !== null);

  const filtered = cardDataList.filter(({ product, production, productionId }) => {
    const prodDate = production.CreatedAt?.slice(0, 10) ?? "";
    const cardStatus: CardStatus = cardStatuses[productionId] ?? "ปกติ";
    return (
      (!productFilter || product.name === productFilter) &&
      (!factoryFilter || product.factory_id.toString() === factoryFilter) &&
      (!statusFilter || cardStatus === statusFilter) &&
      (!dateFilter || prodDate === dateFilter) &&
      (!shippingFilter || formatShippingTime(production.shipping_time) === shippingFilter)
    );
  });

  const uniqueProducts = [...new Set(products.map((p) => p.name))];
  const uniqueFactories = [...new Set(products.map((p) => p.factory_id))];
  const uniqueShipping = [
    ...new Set(productions.map((p) => formatShippingTime(p.shipping_time))),
  ].sort();

  const handleSend = (card: CardData) => {
    const { product, production, remainingTrays, productionId } = card;
    const rawVal = sendTray[productionId];
    if (rawVal === undefined || rawVal === "") {
      alert("กรุณากรอกจำนวนถาดที่จะส่ง");
      return;
    }
    const tray = Number(rawVal);
    if (tray < 0 || tray > remainingTrays) {
      alert("จำนวนไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง");
      return;
    }
    const pieces = tray * product.piece_per_tray;
    alert(
      `ProductName: ${product.name}\n` +
      `Shipping Time: ${formatShippingTime(production.shipping_time)}\n` +
      `Factory: ${product.factory_id}\n` +
      `จำนวนถาดที่ส่ง: ${tray}\n` +
      `จำนวนชิ้นที่ส่ง: ${pieces}\n` +
      `Station ที่ส่ง: ${station}\n` +
      `เวลาที่ส่ง: ${new Date().toLocaleString("th-TH")}`
    );
  };

  // ── เปิด Modal ─────────────────────────────────────────────────────────────
  const openProblemModal = (productionId: number) => {
    setModalProductionId(productionId);
    setProblemType("");
    setProblemQty("");
    setModalOpen(true);
  };

  const handleProblemConfirm = () => {
    // หา card จาก allCardDataList แทน (ไม่ขึ้นกับ station filter)
    const card = allCardDataList.find((c) => c.productionId === modalProductionId);
    if (!card) return;

    if (!problemType) {
      alert("กรุณาเลือกหัวข้อปัญหา");
      return;
    }
    if (!problemQty) {
      alert("กรุณากรอกจำนวนชิ้นที่มีปัญหา");
      return;
    }
    const qty = Number(problemQty);
    if (qty < 0 || qty > card.product.stock) {
      alert("จำนวนชิ้นที่มีปัญหาต้องไม่เกินจำนวนชิ้นทั้งหมด");
      return;
    }

    setCardStatuses((prev) => ({
      ...prev,
      [card.productionId]: "มีปัญหา",
    }));

    setModalOpen(false);
    alert(
      `✅ แจ้งปัญหาสำเร็จ\n` +
      `สินค้า: ${card.product.name}\n` +
      `หัวข้อปัญหา: ${problemType}\n` +
      `จำนวนชิ้นที่มีปัญหา: ${qty}\n` +
      `สถานะ: มีปัญหา`
    );
  };

  const statusClass: Record<CardStatus, string> = {
    ปกติ: "bg-green-100 text-green-700",
    มีปัญหา: "bg-red-100 text-red-600",
  };

  // หา modalCard จาก allCardDataList
  const modalCard = allCardDataList.find((c) => c.productionId === modalProductionId);

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">

      {/* Station Tabs */}
      <div className="flex gap-2">
        {stations.map((s) => (
          <button
            key={s}
            onClick={() => setStation(s)}
            className={`px-5 py-2 rounded-xl font-medium transition-colors text-sm ${
              station === s
                ? "bg-blue-500 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Station {s}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select className="border rounded-lg p-2 text-sm" value={productFilter} onChange={(e) => setProductFilter(e.target.value)}>
          <option value="">Product ทั้งหมด</option>
          {uniqueProducts.map((n) => <option key={n}>{n}</option>)}
        </select>

        <select className="border rounded-lg p-2 text-sm" value={factoryFilter} onChange={(e) => setFactoryFilter(e.target.value)}>
          <option value="">Factory ทั้งหมด</option>
          {uniqueFactories.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>

        <select className="border rounded-lg p-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">สถานะทั้งหมด</option>
          <option value="ปกติ">ปกติ</option>
          <option value="มีปัญหา">มีปัญหา</option>
        </select>

        <input type="date" className="border rounded-lg p-2 text-sm" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />

        <select className="border rounded-lg p-2 text-sm" value={shippingFilter} onChange={(e) => setShippingFilter(e.target.value)}>
          <option value="">Shipping Time ทั้งหมด</option>
          {uniqueShipping.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>

      {filtered.length === 0 && (
        <p className="text-gray-400 text-sm text-center py-10">ไม่พบข้อมูล</p>
      )}

      {/* Cards */}
      {filtered.map((card) => {
        const { product, production, remainingTrays, productionId } = card;
        const cardStatus: CardStatus = cardStatuses[productionId] ?? "ปกติ";
        return (
          <div key={productionId} className="border rounded-xl p-4 shadow-sm space-y-3 bg-white">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-semibold text-base leading-snug">{product.name}</h2>
              <span className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${statusClass[cardStatus]}`}>
                {cardStatus}
              </span>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
              <span>Shipping Time: <span className="text-gray-700 font-medium">{formatShippingTime(production.shipping_time)}</span></span>
              <span>Factory: <span className="text-gray-700 font-medium">{product.factory_id}</span></span>
              <span>วันที่: <span className="text-gray-700 font-medium">{formatDate(production.CreatedAt)}</span></span>
              <span>หน่วย: <span className="text-gray-700 font-medium">{product.unit}</span></span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: "จำนวนชิ้นทั้งหมด", value: production.import_quantity },
                { label: "จำนวนผลิตได้",      value: production.export_quantity },
                { label: "จำนวนเสีย",         value: production.lost_quantity, danger: true },
                { label: "จำนวนถาด",          value: remainingTrays },
              ].map(({ label, value, danger }) => (
                <div key={label} className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className="text-xs text-gray-400 mb-1">{label}</p>
                  <p className={`text-lg font-semibold ${danger ? "text-red-500" : "text-gray-800"}`}>{value}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="จำนวนถาด"
                  min={0}
                  max={remainingTrays}
                  className="border rounded-lg p-2 text-sm w-32"
                  value={sendTray[productionId] ?? ""}
                  onChange={(e) => setSendTray({ ...sendTray, [productionId]: e.target.value })}
                />
                <button
                  onClick={() => handleSend(card)}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  ส่งสินค้า
                </button>
              </div>
              <button
                onClick={() => openProblemModal(productionId)}
                className="w-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                แจ้งปัญหา
              </button>
            </div>
          </div>
        );
      })}

      {/* ── Problem Modal ──────────────────────────────────────────────────── */}
      {modalOpen && (
  <div
    className="modal-overlay"
    onClick={(e) => {
      if (e.target === e.currentTarget) setModalOpen(false);
    }}
  >
    <div className="modal-box">
      <h2>แจ้งปัญหา</h2>

      {/* Select */}
      <select
        value={problemType}
        onChange={(e) => setProblemType(e.target.value as ProblemType)}
      >
        <option value="">เลือกหัวข้อปัญหา</option>
        <option value="วัตถุดิบหมด">วัตถุดิบหมด</option>
        <option value="เครื่องเสีย">เครื่องเสีย</option>
        <option value="ไหม้">ไหม้</option>
      </select>

      {/* Input */}
      <input
        type="number"
        placeholder="จำนวน (ชิ้น)"
        value={problemQty}
        onChange={(e) => setProblemQty(e.target.value)}
      />

      {/* Buttons */}
      <div className="modal-actions">
        <button
          className="btn-close"
          onClick={() => setModalOpen(false)}
        >
          ปิด
        </button>

        <button
          className="btn-submit"
          onClick={handleProblemConfirm}
        >
          แจ้งปัญหา
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  );
}