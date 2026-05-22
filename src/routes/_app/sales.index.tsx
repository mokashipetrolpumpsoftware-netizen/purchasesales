import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useShop } from "@/hooks/useShop";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/_app/sales/")({ component: Sales });

type Sale = Tables<"sales">;

const emptyEditForm = { customer_id: "", date: "", total: 0, status: "Paid" };

function Sales() {
  const { data: shop } = useShop();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Sale | null>(null);
  const [form, setForm] = useState(emptyEditForm);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [invoiceFilter, setInvoiceFilter] = useState("");

  const { data: rows = [] } = useQuery({
    queryKey: ["sales", shop?.shop_id],
    enabled: !!shop?.shop_id,
    queryFn: async () => (await supabase.from("sales").select("*").order("date", { ascending: false })).data ?? [],
  });
  const { data: customers = [] } = useQuery({
    queryKey: ["customers", shop?.shop_id],
    enabled: !!shop?.shop_id,
    queryFn: async () => (await supabase.from("customers").select("*").order("name")).data ?? [],
  });

  const adjustCustomerDue = async (customerId: string | null, amount: number) => {
    if (!customerId || amount === 0) return;
    const { data: customer, error } = await supabase.from("customers").select("due").eq("id", customerId).single();
    if (error) throw error;
    const { error: updateError } = await supabase.from("customers").update({ due: Math.max(0, Number(customer.due) + amount) }).eq("id", customerId);
    if (updateError) throw updateError;
  };

  const update = useMutation({
    mutationFn: async () => {
      if (!editing) throw new Error("Select an invoice to edit");
      if (form.status === "Pending" && !form.customer_id) throw new Error("Pending sale needs a customer");
      const customer = customers.find((c) => c.id === form.customer_id);
      const oldPendingAmount = editing.status === "Pending" ? -Number(editing.total) : 0;
      const newPendingAmount = form.status === "Pending" ? Number(form.total) : 0;
      await adjustCustomerDue(editing.customer_id, oldPendingAmount);
      await adjustCustomerDue(form.customer_id || null, newPendingAmount);
      const { error } = await supabase.from("sales").update({
        customer_id: customer?.id ?? null,
        customer_name: customer?.name ?? "Walk-in",
        date: form.date,
        total: form.total,
        status: form.status,
      }).eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Invoice updated");
      setOpen(false);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (sale: Sale) => {
      const { data: items, error: itemsError } = await supabase.from("sale_items").select("product_id, qty").eq("sale_id", sale.id);
      if (itemsError) throw itemsError;
      for (const item of items ?? []) {
        if (!item.product_id) continue;
        const { data: product, error: productError } = await supabase.from("products").select("stock").eq("id", item.product_id).single();
        if (productError) throw productError;
        const { error: stockError } = await supabase.from("products").update({ stock: Number(product.stock) + Number(item.qty) }).eq("id", item.product_id);
        if (stockError) throw stockError;
      }
      if (sale.status === "Pending") await adjustCustomerDue(sale.customer_id, -Number(sale.total));
      const { error } = await supabase.from("sales").delete().eq("id", sale.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Invoice deleted");
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startEdit = (sale: Sale) => {
    setEditing(sale);
    setForm({ customer_id: sale.customer_id ?? "", date: sale.date, total: Number(sale.total), status: sale.status });
    setOpen(true);
  };

  const filteredRows = rows.filter((sale) => {
    const invoiceMatch = sale.invoice_no.toLowerCase().includes(invoiceFilter.trim().toLowerCase());
    const fromMatch = !fromDate || sale.date >= fromDate;
    const toMatch = !toDate || sale.date <= toDate;
    return invoiceMatch && fromMatch && toMatch;
  });
  const filteredTotal = filteredRows.reduce((sum, sale) => sum + Number(sale.total), 0);

  const downloadReport = () => {
    if (!filteredRows.length) {
      toast.error("No invoices found for selected filters");
      return;
    }

    const pdf = createSalesReportPdf(filteredRows, fromDate, toDate, invoiceFilter);
    pdf.save("sales-invoice-report.pdf");
  };

  return (
    <div>
      <PageHeader title="Sales" description="All invoices" actions={<Button asChild><Link to="/sales/new"><Plus className="h-4 w-4 mr-2" />New Invoice</Link></Button>} />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Invoice</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-2"><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <div className="space-y-2"><Label>Total</Label><Input type="text" inputMode="decimal" value={form.total} onChange={(e) => setForm({ ...form, total: +e.target.value })} /></div>
            <div className="space-y-2"><Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Paid">Paid</SelectItem><SelectItem value="Pending">Pending</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Customer</Label>
              <Select value={form.customer_id || "walk-in"} onValueChange={(v) => setForm({ ...form, customer_id: v === "walk-in" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="walk-in">Walk-in</SelectItem>
                  {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={() => update.mutate()} disabled={update.isPending}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Card className="p-3 sm:p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto] gap-3 md:gap-4 items-end">
          <div className="space-y-2">
            <Label htmlFor="sales-from">From date</Label>
            <Input id="sales-from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sales-to">To date</Label>
            <Input id="sales-to" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sales-invoice">Invoice number</Label>
            <Input id="sales-invoice" value={invoiceFilter} onChange={(e) => setInvoiceFilter(e.target.value)} placeholder="INV-000001" />
          </div>
          <div className="grid grid-cols-2 gap-2 md:flex">
            <Button variant="outline" onClick={() => {
              setFromDate("");
              setToDate("");
              setInvoiceFilter("");
            }}>Clear</Button>
            <Button onClick={downloadReport}><Download className="h-4 w-4 mr-2" />Report</Button>
          </div>
        </div>
        <div className="mt-3 text-sm text-muted-foreground">
          Showing {filteredRows.length} invoice{filteredRows.length === 1 ? "" : "s"} | Total Rs.{filteredTotal.toLocaleString()}
        </div>
      </Card>
      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Invoice</TableHead><TableHead>Customer</TableHead><TableHead>Date</TableHead>
            <TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filteredRows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No invoices found</TableCell></TableRow>}
            {filteredRows.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.invoice_no}</TableCell>
                <TableCell>{s.customer_name || "Walk-in"}</TableCell>
                <TableCell className="text-muted-foreground">{s.date}</TableCell>
                <TableCell className="text-right">Rs.{Number(s.total).toLocaleString()}</TableCell>
                <TableCell><Badge variant={s.status === "Paid" ? "default" : "secondary"}>{s.status}</Badge></TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button size="icon" variant="ghost" onClick={() => startEdit(s)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => del.mutate(s)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function createSalesReportPdf(rows: Sale[], fromDate: string, toDate: string, invoiceFilter: string) {
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const width = pdf.internal.pageSize.getWidth();
  const total = rows.reduce((sum, sale) => sum + Number(sale.total), 0);

  pdf.setFontSize(18);
  pdf.text("Sales Invoice Report", width / 2, 42, { align: "center" });
  pdf.setFontSize(11);
  pdf.text(`Period: ${periodText(fromDate, toDate)}${invoiceFilter.trim() ? ` | Invoice: ${invoiceFilter.trim()}` : ""}`, width / 2, 62, { align: "center" });

  autoTable(pdf, {
    startY: 84,
    head: [["Invoices", "Total Amount", "Paid", "Pending"]],
    body: [[
      rows.length,
      `Rs.${money(total)}`,
      rows.filter((sale) => sale.status === "Paid").length,
      rows.filter((sale) => sale.status === "Pending").length,
    ]],
    theme: "grid",
    styles: { halign: "center", fontSize: 10 },
  });

  autoTable(pdf, {
    startY: 145,
    head: [["Invoice", "Date", "Customer", "Subtotal", "Discount", "Tax", "Total", "Status"]],
    body: rows.map((sale) => [
      sale.invoice_no,
      sale.date,
      sale.customer_name ?? "Walk-in",
      `Rs.${money(Number(sale.subtotal))}`,
      `Rs.${money(Number(sale.discount))}`,
      `Rs.${money(Number(sale.tax))}`,
      `Rs.${money(Number(sale.total))}`,
      sale.status,
    ]),
    theme: "grid",
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42] },
    styles: { fontSize: 9, cellPadding: 6 },
  });

  return pdf;
}

function periodText(fromDate: string, toDate: string) {
  if (fromDate && toDate) return `${fromDate} to ${toDate}`;
  if (fromDate) return `From ${fromDate}`;
  if (toDate) return `Up to ${toDate}`;
  return "All dates";
}

function money(value: number) {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
