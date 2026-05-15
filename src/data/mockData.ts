export const shopProfile = {
  name: "GreenLeaf Pharmacy & Agro",
  owner: "Rajesh Kumar",
  email: "rajesh@greenleaf.com",
  license: "PHARM-2024-IN-89231",
  gst: "29ABCDE1234F1Z5",
  address: "12 MG Road, Bangalore, Karnataka 560001",
  phone: "+91 98765 43210",
};

export const dashboardStats = {
  todaySales: 24850,
  stockValue: 487320,
  expiringSoon: 18,
  pendingPayments: 36420,
};

export const salesChartData = [
  { day: "Mon", sales: 12400 },
  { day: "Tue", sales: 18200 },
  { day: "Wed", sales: 15600 },
  { day: "Thu", sales: 22100 },
  { day: "Fri", sales: 28900 },
  { day: "Sat", sales: 31200 },
  { day: "Sun", sales: 24850 },
];

export const recentSales = [
  { id: "INV-1042", customer: "Anita Sharma", date: "2026-05-05", amount: 1240, status: "Paid" },
  { id: "INV-1041", customer: "Mohan Patel", date: "2026-05-05", amount: 3420, status: "Paid" },
  { id: "INV-1040", customer: "Priya Reddy", date: "2026-05-04", amount: 890, status: "Pending" },
  { id: "INV-1039", customer: "Suresh Kumar", date: "2026-05-04", amount: 5680, status: "Paid" },
  { id: "INV-1038", customer: "Geeta Nair", date: "2026-05-03", amount: 2150, status: "Paid" },
];

export type Product = {
  id: string;
  name: string;
  category: "Medicine" | "Fertilizer" | "Seeds" | "Pesticide";
  batch: string;
  expiry: string;
  mrp: number;
  purchase: number;
  selling: number;
  stock: number;
  unit: string;
};

export const products: Product[] = [
  { id: "P001", name: "Paracetamol 500mg", category: "Medicine", batch: "B2401", expiry: "2026-08-15", mrp: 35, purchase: 22, selling: 32, stock: 240, unit: "tablet" },
  { id: "P002", name: "Amoxicillin 250mg", category: "Medicine", batch: "B2402", expiry: "2026-06-10", mrp: 95, purchase: 60, selling: 88, stock: 8, unit: "tablet" },
  { id: "P003", name: "Cough Syrup 100ml", category: "Medicine", batch: "B2403", expiry: "2027-01-22", mrp: 120, purchase: 78, selling: 110, stock: 45, unit: "bottle" },
  { id: "P004", name: "Urea Fertilizer", category: "Fertilizer", batch: "F0112", expiry: "2028-03-01", mrp: 320, purchase: 240, selling: 295, stock: 180, unit: "kg" },
  { id: "P005", name: "Hybrid Tomato Seeds", category: "Seeds", batch: "S2210", expiry: "2026-05-20", mrp: 180, purchase: 120, selling: 165, stock: 12, unit: "packet" },
  { id: "P006", name: "Neem Pesticide", category: "Pesticide", batch: "PS0904", expiry: "2027-09-04", mrp: 450, purchase: 320, selling: 410, stock: 36, unit: "litre" },
  { id: "P007", name: "Vitamin D3 Tabs", category: "Medicine", batch: "B2404", expiry: "2026-05-30", mrp: 220, purchase: 140, selling: 200, stock: 4, unit: "tablet" },
  { id: "P008", name: "DAP Fertilizer", category: "Fertilizer", batch: "F0118", expiry: "2028-11-12", mrp: 1450, purchase: 1180, selling: 1380, stock: 65, unit: "kg" },
];

export const customers = [
  { id: "C001", name: "Anita Sharma", phone: "+91 98111 22334", email: "anita@mail.com", due: 0 },
  { id: "C002", name: "Mohan Patel", phone: "+91 98222 33445", email: "mohan@mail.com", due: 1240 },
  { id: "C003", name: "Priya Reddy", phone: "+91 98333 44556", email: "priya@mail.com", due: 890 },
  { id: "C004", name: "Suresh Kumar", phone: "+91 98444 55667", email: "suresh@mail.com", due: 0 },
];

export const suppliers = [
  { id: "S001", name: "MediWorld Distributors", phone: "+91 80111 11111", email: "sales@mediworld.com", due: 24500 },
  { id: "S002", name: "AgroLife Supplies", phone: "+91 80222 22222", email: "info@agrolife.com", due: 0 },
  { id: "S003", name: "PharmaPlus Wholesale", phone: "+91 80333 33333", email: "buy@pharmaplus.com", due: 11920 },
];

export const purchases = [
  { id: "PUR-201", supplier: "MediWorld Distributors", date: "2026-05-01", items: 12, amount: 38450, status: "Received" },
  { id: "PUR-200", supplier: "AgroLife Supplies", date: "2026-04-28", items: 8, amount: 21800, status: "Received" },
  { id: "PUR-199", supplier: "PharmaPlus Wholesale", date: "2026-04-25", items: 15, amount: 52340, status: "Pending" },
];

export const ledger = [
  { id: "L1", date: "2026-05-05", party: "Anita Sharma", type: "Credit", amount: 1240, note: "Invoice INV-1042" },
  { id: "L2", date: "2026-05-04", party: "MediWorld", type: "Debit", amount: 38450, note: "Purchase PUR-201" },
  { id: "L3", date: "2026-05-03", party: "Priya Reddy", type: "Credit", amount: 890, note: "Invoice INV-1040 (pending)" },
  { id: "L4", date: "2026-05-02", party: "AgroLife", type: "Debit", amount: 21800, note: "Purchase PUR-200" },
];

export const staff = [
  { id: "U1", name: "Rajesh Kumar", email: "rajesh@greenleaf.com", role: "Admin" },
  { id: "U2", name: "Sunita Joshi", email: "sunita@greenleaf.com", role: "Staff" },
  { id: "U3", name: "Arjun Mehta", email: "arjun@greenleaf.com", role: "Staff" },
];
