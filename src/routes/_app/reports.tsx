import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileText, Share2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useShop } from "@/hooks/useShop";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/_app/reports")({ component: Reports });

type Product = Tables<"products">;
type Sale = Tables<"sales">;
type SaleItem = Tables<"sale_items">;
type Purchase = Tables<"purchases">;
type PurchaseItem = Tables<"purchase_items">;
type LedgerEntry = Tables<"ledger_entries">;
type Customer = Tables<"customers">;
type Supplier = Tables<"suppliers">;
type Report = {
  id: string;
  title: string;
  description: string;
  group: string;
  columns: string[];
  rows: (string | number)[][];
  summary: { label: string; value: string }[];
};

function Reports() {
  const { data: shop } = useShop();
  const defaultPeriod = useMemo(() => getDefaultPeriod(), []);
  const [fromDate, setFromDate] = useState(defaultPeriod.from);
  const [toDate, setToDate] = useState(defaultPeriod.to);
  const [selected, setSelected] = useState<Report | null>(null);

  const enabled = !!shop?.shop_id;
  const { data: products = [] } = useQuery({ queryKey: ["products", shop?.shop_id], enabled, queryFn: async () => fetchRows<Product>("products") });
  const { data: sales = [] } = useQuery({ queryKey: ["sales", shop?.shop_id], enabled, queryFn: async () => fetchRows<Sale>("sales", "date", false) });
  const { data: saleItems = [] } = useQuery({ queryKey: ["sale_items", shop?.shop_id], enabled, queryFn: async () => fetchRows<SaleItem>("sale_items") });
  const { data: purchases = [] } = useQuery({ queryKey: ["purchases", shop?.shop_id], enabled, queryFn: async () => fetchRows<Purchase>("purchases", "date", false) });
  const { data: purchaseItems = [] } = useQuery({ queryKey: ["purchase_items", shop?.shop_id], enabled, queryFn: async () => fetchRows<PurchaseItem>("purchase_items") });
  const { data: ledgerEntries = [] } = useQuery({ queryKey: ["ledger", shop?.shop_id], enabled, queryFn: async () => fetchRows<LedgerEntry>("ledger_entries", "date", false) });
  const { data: customers = [] } = useQuery({ queryKey: ["customers", shop?.shop_id], enabled, queryFn: async () => fetchRows<Customer>("customers") });
  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers", shop?.shop_id], enabled, queryFn: async () => fetchRows<Supplier>("suppliers") });

  const filteredSales = sales.filter((sale) => isWithinPeriod(sale.date, fromDate, toDate));
  const filteredPurchases = purchases.filter((purchase) => isWithinPeriod(purchase.date, fromDate, toDate));
  const filteredLedger = ledgerEntries.filter((entry) => isWithinPeriod(entry.date, fromDate, toDate));
  const saleMap = new Map(sales.map((sale) => [sale.id, sale]));
  const purchaseMap = new Map(purchases.map((purchase) => [purchase.id, purchase]));
  const productMap = new Map(products.map((product) => [product.id, product]));
  const filteredSaleItems = saleItems.filter((item) => {
    const sale = saleMap.get(item.sale_id);
    return sale ? isWithinPeriod(sale.date, fromDate, toDate) : false;
  });
  const filteredPurchaseItems = purchaseItems.filter((item) => {
    const purchase = purchaseMap.get(item.purchase_id);
    return purchase ? isWithinPeriod(purchase.date, fromDate, toDate) : false;
  });

  const reports = useMemo(() => buildReports({
    products,
    sales: filteredSales,
    saleItems: filteredSaleItems,
    purchases: filteredPurchases,
    purchaseItems: filteredPurchaseItems,
    ledgerEntries: filteredLedger,
    customers,
    suppliers,
    saleMap,
    purchaseMap,
    productMap,
  }), [customers, filteredLedger, filteredPurchaseItems, filteredPurchases, filteredSaleItems, filteredSales, products, purchaseMap, saleMap, productMap, suppliers]);

  const totalSales = filteredSales.reduce((sum, sale) => sum + Number(sale.total), 0);
  const totalPurchases = filteredPurchases.reduce((sum, purchase) => sum + Number(purchase.total), 0);
  const stockValue = products.reduce((sum, product) => sum + Number(product.stock) * Number(product.purchase_price), 0);
  const lowStockCount = products.filter((product) => Number(product.stock) <= 10).length;

  const handleDownload = async (report: Report) => {
    const pdf = createReportPdf(report, fromDate, toDate);
    const fileName = fileNameFor(report);

    if (await isNativePlatform()) {
      const { Directory } = await import("@capacitor/filesystem");
      await writeNativePdf(pdf, fileName, Directory.Documents);
      toast.success("PDF saved on device");
      return;
    }

    pdf.save(fileName);
  };

  const handleShare = async (report: Report) => {
    const pdf = createReportPdf(report, fromDate, toDate);
    const fileName = fileNameFor(report);

    if (await isNativePlatform()) {
      const [{ Directory }, { Share }] = await Promise.all([import("@capacitor/filesystem"), import("@capacitor/share")]);
      const saved = await writeNativePdf(pdf, fileName, Directory.Cache);
      await Share.share({ title: report.title, text: `${report.title} report`, url: saved.uri, dialogTitle: "Share report PDF" });
      return;
    }

    const file = new File([pdf.output("blob")], fileName, { type: "application/pdf" });
    const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };

    if (navigator.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
      await navigator.share({ title: report.title, text: `${report.title} report`, files: [file] });
      return;
    }

    pdf.save(fileName);
    toast.info("PDF downloaded. Use your device share option to send it on WhatsApp.");
  };

  return (
    <div>
      <PageHeader title="Reports" description="Inventory, sales, purchase, profit and operational PDF reports" />

      <Card className="p-3 sm:p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 md:gap-4 items-end">
          <div className="space-y-2">
            <Label htmlFor="report-from">From date</Label>
            <Input id="report-from" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="report-to">To date</Label>
            <Input id="report-to" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          </div>
          <Button variant="outline" onClick={() => {
            const next = getDefaultPeriod();
            setFromDate(next.from);
            setToDate(next.to);
          }} className="w-full md:w-auto">Last 30 Days</Button>
        </div>
      </Card>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <SummaryCard label="Sales" value={`Rs.${money(totalSales)}`} />
        <SummaryCard label="Purchases" value={`Rs.${money(totalPurchases)}`} />
        <SummaryCard label="Stock Value" value={`Rs.${money(stockValue)}`} />
        <SummaryCard label="Low Stock Items" value={String(lowStockCount)} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4">
        {reports.map((report) => (
          <Card key={report.id} className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold leading-snug">{report.title}</h3>
                  <Badge variant="outline" className="shrink-0">{report.group}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{report.description}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:flex sm:shrink-0">
                <Button size="sm" variant="outline" onClick={() => setSelected(report)} className="px-2 sm:size-9 sm:p-0"><FileText className="h-4 w-4" /><span className="ml-1 sm:hidden">View</span></Button>
                <Button size="sm" variant="outline" onClick={() => handleShare(report)} className="px-2 sm:size-9 sm:p-0"><Share2 className="h-4 w-4" /><span className="ml-1 sm:hidden">Share</span></Button>
                <Button size="sm" variant="outline" onClick={() => handleDownload(report)} className="px-2 sm:size-9 sm:p-0"><Download className="h-4 w-4" /><span className="ml-1 sm:hidden">PDF</span></Button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
              {report.summary.slice(0, 4).map((item) => (
                <div key={item.label} className="rounded-md bg-muted p-2.5 sm:p-3 min-w-0">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="font-semibold mt-1 break-words text-sm sm:text-base">{item.value}</p>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-6xl max-h-[92vh] overflow-hidden p-3 sm:p-6">
          {selected && (
            <>
              <DialogHeader><DialogTitle>{selected.title}</DialogTitle></DialogHeader>
              <div className="space-y-4 overflow-hidden">
                <p className="text-sm text-muted-foreground">Period: {periodText(fromDate, toDate)}</p>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                  {selected.summary.map((item) => <SummaryCard key={item.label} label={item.label} value={item.value} />)}
                </div>
                <div className="max-h-[52vh] overflow-auto rounded-md border">
                  <Table className="min-w-[720px]">
                    <TableHeader><TableRow>{selected.columns.map((column) => <TableHead key={column}>{column}</TableHead>)}</TableRow></TableHeader>
                    <TableBody>
                      {selected.rows.length === 0 && <TableRow><TableCell colSpan={selected.columns.length} className="text-center text-muted-foreground py-8">No data for selected period</TableCell></TableRow>}
                      {selected.rows.map((row, index) => (
                        <TableRow key={index}>{row.map((cell, cellIndex) => <TableCell key={cellIndex}>{cell}</TableCell>)}</TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
              <DialogFooter className="grid grid-cols-2 gap-2 sm:flex">
                <Button variant="outline" onClick={() => handleShare(selected)} className="w-full sm:w-auto"><Share2 className="h-4 w-4 mr-2" />Share PDF</Button>
                <Button onClick={() => handleDownload(selected)} className="w-full sm:w-auto"><Download className="h-4 w-4 mr-2" />Download PDF</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return <Card className="p-3 sm:p-4 min-w-0"><p className="text-xs sm:text-sm text-muted-foreground">{label}</p><p className="text-base sm:text-xl font-bold mt-1 break-words">{value}</p></Card>;
}

async function fetchRows<T>(table: string, orderBy = "created_at", ascending = true) {
  const { data, error } = await supabase.from(table as never).select("*").order(orderBy, { ascending });
  if (error) throw error;
  return (data ?? []) as T[];
}

function buildReports(data: {
  products: Product[];
  sales: Sale[];
  saleItems: SaleItem[];
  purchases: Purchase[];
  purchaseItems: PurchaseItem[];
  ledgerEntries: LedgerEntry[];
  customers: Customer[];
  suppliers: Supplier[];
  saleMap: Map<string, Sale>;
  purchaseMap: Map<string, Purchase>;
  productMap: Map<string, Product>;
}): Report[] {
  const currentStockRows = data.products.map((p) => [p.name, p.category, p.batch ?? "-", p.expiry ?? "-", Number(p.stock), p.unit ?? "-", `Rs.${money(Number(p.purchase_price) * Number(p.stock))}`]);
  const lowStockRows = data.products.filter((p) => Number(p.stock) <= 10).map((p) => [p.name, p.category, Number(p.stock), p.unit ?? "-", p.batch ?? "-", p.expiry ?? "-"]);
  const expiringRows = data.products.filter((p) => isExpiredOrExpiring(p.expiry)).map((p) => [p.name, p.category, p.batch ?? "-", p.expiry ?? "-", Number(p.stock), expiryStatus(p.expiry)]);
  const stockLedgerRows = stockLedger(data);
  const stockInOutRows = productMovement(data);
  const salesSummaryRows = data.sales.map((s) => [s.date, s.invoice_no, s.customer_name ?? "Walk-in", s.status, `Rs.${money(Number(s.total))}`]);
  const purchaseSummaryRows = data.purchases.map((p) => [p.date, p.bill_no, p.supplier_name ?? "-", p.status, `Rs.${money(Number(p.total))}`]);
  const valuationRows = data.products.map((p) => [p.name, Number(p.stock), `Rs.${money(Number(p.purchase_price))}`, `Rs.${money(Number(p.selling_price))}`, `Rs.${money(Number(p.stock) * Number(p.purchase_price))}`, `Rs.${money(Number(p.stock) * Number(p.selling_price))}`]);
  const itemProfitRows = itemProfit(data);
  const purchaseVsConsumptionRows = purchaseVsConsumption(data);
  const dailySummaryRows = dailySummary(data);
  const pendingRows = data.customers.filter((c) => Number(c.due) > 0).map((c) => [c.name, c.phone ?? "-", `Rs.${money(Number(c.due))}`]);
  const supplierPendingRows = data.suppliers.filter((s) => Number(s.due) > 0).map((s) => [s.name, s.phone ?? "-", `Rs.${money(Number(s.due))}`]);
  const totalSales = data.sales.reduce((sum, sale) => sum + Number(sale.total), 0);
  const totalPurchases = data.purchases.reduce((sum, purchase) => sum + Number(purchase.total), 0);
  const totalStockValue = data.products.reduce((sum, product) => sum + Number(product.stock) * Number(product.purchase_price), 0);
  const totalProfit = itemProfitRows.reduce((sum, row) => sum + numberFromMoney(String(row[5])), 0);
  const customerPending = data.customers.reduce((sum, c) => sum + Number(c.due), 0);
  const supplierPayable = data.suppliers.reduce((sum, s) => sum + Number(s.due), 0);

  return [
    report("current-stock", "Current Stock", "Live stock available product-wise.", "Inventory", ["Product", "Category", "Batch", "Expiry", "Stock", "Unit", "Cost Value"], currentStockRows, [
      ["Items", data.products.length], ["Total Stock Value", `Rs.${money(totalStockValue)}`], ["Low Stock", lowStockRows.length], ["Expiry Alerts", expiringRows.length],
    ]),
    report("stock-ledger", "Stock Ledger", "Product-wise stock in and stock out movements.", "Inventory", ["Date", "Product", "Type", "Ref", "Qty In", "Qty Out", "Amount"], stockLedgerRows, [
      ["Movements", stockLedgerRows.length], ["Stock In", sumColumn(stockLedgerRows, 4)], ["Stock Out", sumColumn(stockLedgerRows, 5)], ["Net Qty", sumColumn(stockLedgerRows, 4) - sumColumn(stockLedgerRows, 5)],
    ]),
    report("stock-in-out", "Stock In/Out", "Combined movement summary for each item.", "Inventory", ["Product", "Purchased Qty", "Sold Qty", "Current Stock", "Unit"], stockInOutRows, [
      ["Items", stockInOutRows.length], ["Total In", sumColumn(stockInOutRows, 1)], ["Total Out", sumColumn(stockInOutRows, 2)], ["Current Stock", sumColumn(stockInOutRows, 3)],
    ]),
    report("low-stock", "Low Stock", "Items at or below 10 quantity.", "Alerts", ["Product", "Category", "Stock", "Unit", "Batch", "Expiry"], lowStockRows, [
      ["Low Stock Items", lowStockRows.length], ["Threshold", "10"], ["Action", "Reorder"], ["Report", "Active"],
    ]),
    report("purchase-summary", "Purchase Summary", "Purchases recorded in the selected period.", "Purchase", ["Date", "Bill No", "Supplier", "Status", "Total"], purchaseSummaryRows, [
      ["Bills", data.purchases.length], ["Amount", `Rs.${money(totalPurchases)}`], ["Suppliers", uniqueCount(data.purchases.map((p) => p.supplier_name ?? "-"))], ["Average", `Rs.${money(avg(totalPurchases, data.purchases.length))}`],
    ]),
    report("sales-summary", "Sales Summary", "Sales invoices recorded in the selected period.", "Sales", ["Date", "Invoice", "Customer", "Status", "Total"], salesSummaryRows, [
      ["Invoices", data.sales.length], ["Amount", `Rs.${money(totalSales)}`], ["Paid", data.sales.filter((s) => s.status === "Paid").length], ["Pending", data.sales.filter((s) => s.status === "Pending").length],
    ]),
    report("inventory-valuation", "Inventory Valuation", "Cost and selling value of current inventory.", "Inventory", ["Product", "Stock", "Cost Price", "Selling Price", "Cost Value", "Selling Value"], valuationRows, [
      ["Cost Value", `Rs.${money(totalStockValue)}`], ["Selling Value", `Rs.${money(data.products.reduce((sum, p) => sum + Number(p.stock) * Number(p.selling_price), 0))}`], ["Items", data.products.length], ["Method", "Current stock"],
    ]),
    report("damage-expiry", "Damage/Expiry", "Expired and near-expiry stock. Damage tracking table is not configured yet.", "Alerts", ["Product", "Category", "Batch", "Expiry", "Stock", "Status"], expiringRows, [
      ["Expiry Alerts", expiringRows.length], ["Damage Records", "Not configured"], ["Window", "60 days"], ["Action", "Review"],
    ]),
    report("item-profit", "Item-wise Profit", "Estimated profit using sale price minus product purchase price.", "Profit", ["Product", "Sold Qty", "Sales", "Cost", "Profit / Loss", "Profit Value"], itemProfitRows, [
      ["Items Sold", itemProfitRows.length], ["Sales", `Rs.${money(totalSales)}`], ["Profit", `Rs.${money(totalProfit)}`], ["Basis", "Estimated"],
    ]),
    report("physical-vs-system", "Physical vs System Stock", "Requires physical count entries to compare against system stock.", "Inventory", ["Product", "System Stock", "Physical Stock", "Difference", "Status"], placeholderRows(["Physical stock count module not configured yet."]), [
      ["System Items", data.products.length], ["Physical Counts", "Not configured"], ["Differences", "-"], ["Status", "Needs count"],
    ]),
    report("shift-inventory", "Shift-wise Inventory", "Requires shift opening/closing stock entries.", "Operations", ["Shift", "Opening Stock", "Stock In", "Stock Out", "Closing Stock"], placeholderRows(["Shift-wise stock tracking not configured yet."]), [
      ["Shifts", "Not configured"], ["Stock In", "-"], ["Stock Out", "-"], ["Status", "Needs shift data"],
    ]),
    report("tank-dispatch", "Tank/Dispatch Reconciliation", "Requires tank and dispatch records. Useful for petrol/fuel style inventory.", "Operations", ["Tank", "Opening", "Receipt", "Dispatch", "Closing", "Difference"], placeholderRows(["Tank/dispatch records are not configured in this app yet."]), [
      ["Tanks", "Not configured"], ["Dispatches", "Not configured"], ["Difference", "-"], ["Status", "Needs records"],
    ]),
    report("purchase-vs-consumption", "Purchase vs Consumption", "Purchased quantity compared with sold/consumed quantity.", "Inventory", ["Product", "Purchased Qty", "Consumed Qty", "Balance Qty", "Purchase Value", "Sales Value"], purchaseVsConsumptionRows, [
      ["Items", purchaseVsConsumptionRows.length], ["Purchased Qty", sumColumn(purchaseVsConsumptionRows, 1)], ["Consumed Qty", sumColumn(purchaseVsConsumptionRows, 2)], ["Balance Qty", sumColumn(purchaseVsConsumptionRows, 3)],
    ]),
    report("low-stock-alerts", "Low Stock Alerts", "Action report for reorder planning.", "Alerts", ["Product", "Category", "Stock", "Unit", "Batch", "Expiry"], lowStockRows, [
      ["Alerts", lowStockRows.length], ["Threshold", "10"], ["PDF", "Ready"], ["WhatsApp Share", "Ready"],
    ]),
    report("profitability", "Profitability", "Sales, purchase and estimated gross profit for the selected period.", "Profit", ["Metric", "Amount"], [["Sales", `Rs.${money(totalSales)}`], ["Purchases", `Rs.${money(totalPurchases)}`], ["Estimated Item Profit", `Rs.${money(totalProfit)}`], ["Customer Pending", `Rs.${money(customerPending)}`], ["Supplier Payable", `Rs.${money(supplierPayable)}`]], [
      ["Sales", `Rs.${money(totalSales)}`], ["Purchases", `Rs.${money(totalPurchases)}`], ["Profit", `Rs.${money(totalProfit)}`], ["Pending", `Rs.${money(customerPending)}`],
    ]),
    report("employee-audit", "Employee Audit Logs", "Requires user activity/audit log table.", "Operations", ["Date", "Employee", "Action", "Reference", "Amount"], placeholderRows(["Employee audit log table is not configured yet."]), [
      ["Logs", "Not configured"], ["Users", "-"], ["Actions", "-"], ["Status", "Needs audit table"],
    ]),
    report("daily-dashboard", "Daily Summary Dashboard", "Day-wise sales, purchase, credit and collection summary.", "Dashboard", ["Date", "Sales", "Purchases", "Customer Debit", "Customer Credit"], dailySummaryRows, [
      ["Days", dailySummaryRows.length], ["Sales", `Rs.${money(totalSales)}`], ["Purchases", `Rs.${money(totalPurchases)}`], ["Ledger Entries", data.ledgerEntries.length],
    ]),
    // report("whatsapp-pdf", "WhatsApp/PDF Automated Reports", "All reports can be downloaded or shared. Fully automatic scheduled WhatsApp needs a backend/API.", "Automation", ["Report", "Download", "Share", "Automation"], [["All Reports", "Ready", "Ready", "Manual share ready"], ["Scheduled WhatsApp", "Needs backend", "Needs WhatsApp API", "Not configured"]], [
    //   ["PDF", "Ready"], ["Android Share", "Ready"], ["Web Share", "Ready"], ["Auto WhatsApp", "Needs API"],
    // ]),
    report("customer-pending", "Customer Pending Collection", "Customer-wise udhari amount pending for collection.", "Ledger", ["Customer", "Phone", "Pending Amount"], pendingRows, [
      ["Customers", pendingRows.length], ["Pending", `Rs.${money(customerPending)}`], ["Report", "Ready"], ["Share", "Ready"],
    ]),
    report("supplier-payable", "Supplier Payable", "Supplier-wise udhari amount payable.", "Ledger", ["Supplier", "Phone", "Payable Amount"], supplierPendingRows, [
      ["Suppliers", supplierPendingRows.length], ["Payable", `Rs.${money(supplierPayable)}`], ["Report", "Ready"], ["Share", "Ready"],
    ]),
  ];
}

function report(id: string, title: string, description: string, group: string, columns: string[], rows: (string | number)[][], summaryRows: (string | number)[][]): Report {
  return { id, title, description, group, columns, rows, summary: summaryRows.map(([label, value]) => ({ label: String(label), value: String(value) })) };
}

function stockLedger(data: Parameters<typeof buildReports>[0]) {
  const purchaseRows = data.purchaseItems.map((item) => {
    const purchase = data.purchaseMap.get(item.purchase_id);
    return [purchase?.date ?? "-", item.product_name ?? "-", "Stock In", purchase?.bill_no ?? "-", Number(item.qty), 0, `Rs.${money(Number(item.amount))}`];
  });
  const saleRows = data.saleItems.map((item) => {
    const sale = data.saleMap.get(item.sale_id);
    return [sale?.date ?? "-", item.product_name ?? "-", "Stock Out", sale?.invoice_no ?? "-", 0, Number(item.qty), `Rs.${money(Number(item.amount))}`];
  });
  return [...purchaseRows, ...saleRows].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
}

function productMovement(data: Parameters<typeof buildReports>[0]) {
  const names = new Set([...data.products.map((p) => p.name), ...data.purchaseItems.map((i) => i.product_name ?? "-"), ...data.saleItems.map((i) => i.product_name ?? "-")]);
  return Array.from(names).sort().map((name) => {
    const product = data.products.find((p) => p.name === name);
    const inQty = data.purchaseItems.filter((i) => i.product_name === name).reduce((sum, i) => sum + Number(i.qty), 0);
    const outQty = data.saleItems.filter((i) => i.product_name === name).reduce((sum, i) => sum + Number(i.qty), 0);
    return [name, inQty, outQty, Number(product?.stock ?? 0), product?.unit ?? "-"];
  });
}

function itemProfit(data: Parameters<typeof buildReports>[0]) {
  const grouped = new Map<string, { qty: number; sales: number; cost: number }>();
  data.saleItems.forEach((item) => {
    const product = item.product_id ? data.productMap.get(item.product_id) : undefined;
    const name = item.product_name ?? product?.name ?? "-";
    const current = grouped.get(name) ?? { qty: 0, sales: 0, cost: 0 };
    current.qty += Number(item.qty);
    current.sales += Number(item.amount);
    current.cost += Number(item.qty) * Number(product?.purchase_price ?? 0);
    grouped.set(name, current);
  });
  return Array.from(grouped.entries()).map(([name, value]) => {
    const profit = value.sales - value.cost;
    return [name, value.qty, `Rs.${money(value.sales)}`, `Rs.${money(value.cost)}`, profit >= 0 ? "Profit" : "Loss", `Rs.${money(profit)}`];
  });
}

function purchaseVsConsumption(data: Parameters<typeof buildReports>[0]) {
  return productMovement(data).map((row) => {
    const name = String(row[0]);
    const purchaseValue = data.purchaseItems.filter((i) => i.product_name === name).reduce((sum, i) => sum + Number(i.amount), 0);
    const saleValue = data.saleItems.filter((i) => i.product_name === name).reduce((sum, i) => sum + Number(i.amount), 0);
    return [name, row[1], row[2], Number(row[1]) - Number(row[2]), `Rs.${money(purchaseValue)}`, `Rs.${money(saleValue)}`];
  });
}

function dailySummary(data: Parameters<typeof buildReports>[0]) {
  const dates = new Set([...data.sales.map((s) => s.date), ...data.purchases.map((p) => p.date), ...data.ledgerEntries.map((l) => l.date)]);
  return Array.from(dates).sort().map((date) => {
    const sales = data.sales.filter((s) => s.date === date).reduce((sum, s) => sum + Number(s.total), 0);
    const purchases = data.purchases.filter((p) => p.date === date).reduce((sum, p) => sum + Number(p.total), 0);
    const debit = data.ledgerEntries.filter((l) => l.date === date && l.type === "Debit").reduce((sum, l) => sum + Number(l.amount), 0);
    const credit = data.ledgerEntries.filter((l) => l.date === date && l.type === "Credit").reduce((sum, l) => sum + Number(l.amount), 0);
    return [date, `Rs.${money(sales)}`, `Rs.${money(purchases)}`, `Rs.${money(debit)}`, `Rs.${money(credit)}`];
  });
}

function createReportPdf(report: Report, fromDate: string, toDate: string) {
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const width = pdf.internal.pageSize.getWidth();
  pdf.setFontSize(18);
  pdf.text(report.title, width / 2, 42, { align: "center" });
  pdf.setFontSize(11);
  pdf.text(`Period: ${periodText(fromDate, toDate)}`, width / 2, 62, { align: "center" });

  autoTable(pdf, {
    startY: 84,
    head: [report.summary.map((item) => item.label)],
    body: [report.summary.map((item) => item.value)],
    theme: "grid",
    styles: { halign: "center", fontSize: 10 },
  });

  autoTable(pdf, {
    startY: 145,
    head: [report.columns],
    body: report.rows.length ? report.rows : [["No data for selected period"]],
    theme: "grid",
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42] },
    styles: { fontSize: 9, cellPadding: 6 },
  });

  return pdf;
}

async function isNativePlatform() {
  const { Capacitor } = await import("@capacitor/core");
  return Capacitor.isNativePlatform();
}

async function writeNativePdf(pdf: jsPDF, fileName: string, directory: unknown) {
  const { Filesystem } = await import("@capacitor/filesystem");
  return Filesystem.writeFile({
    path: fileName,
    data: pdf.output("datauristring").split(",")[1] ?? "",
    directory: directory as never,
    recursive: true,
  });
}

function fileNameFor(report: Report) {
  return `${report.id}-report.pdf`;
}

function getDefaultPeriod() {
  const today = new Date();
  const from = new Date(today);
  from.setDate(today.getDate() - 30);
  return { from: toDateInputValue(from), to: toDateInputValue(today) };
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function periodText(fromDate: string, toDate: string) {
  if (fromDate && toDate) return `${fromDate} to ${toDate}`;
  if (fromDate) return `From ${fromDate}`;
  if (toDate) return `Up to ${toDate}`;
  return "All dates";
}

function isWithinPeriod(date: string, fromDate: string, toDate: string) {
  if (fromDate && date < fromDate) return false;
  if (toDate && date > toDate) return false;
  return true;
}

function isExpiredOrExpiring(expiry: string | null) {
  if (!expiry) return false;
  const days = (new Date(expiry).getTime() - new Date().getTime()) / 86400000;
  return days <= 60;
}

function expiryStatus(expiry: string | null) {
  if (!expiry) return "-";
  return new Date(expiry) < new Date() ? "Expired" : "Expiring Soon";
}

function placeholderRows(messages: string[]) {
  return messages.map((message) => [message]);
}

function money(value: number) {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function avg(total: number, count: number) {
  return count ? total / count : 0;
}

function uniqueCount(values: string[]) {
  return new Set(values).size;
}

function sumColumn(rows: (string | number)[][], index: number) {
  return rows.reduce((sum, row) => sum + Number(row[index] || 0), 0);
}

function numberFromMoney(value: string) {
  return Number(value.replace(/[^0-9.-]/g, "")) || 0;
}
