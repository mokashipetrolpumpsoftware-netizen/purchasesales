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
import { Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useShop } from "@/hooks/useShop";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/sales/")({ component: Sales });

type Sale = Tables<"sales">;

const emptyEditForm = { customer_id: "", date: "", total: 0, status: "Paid" };

function Sales() {
  const { data: shop } = useShop();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Sale | null>(null);
  const [form, setForm] = useState(emptyEditForm);

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

  return (
    <div>
      <PageHeader title="Sales" description="All invoices" actions={<Button asChild><Link to="/sales/new"><Plus className="h-4 w-4 mr-2" />New Invoice</Link></Button>} />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Invoice</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-2"><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <div className="space-y-2"><Label>Total</Label><Input type="number" value={form.total} onChange={(e) => setForm({ ...form, total: +e.target.value })} /></div>
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
      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Invoice</TableHead><TableHead>Customer</TableHead><TableHead>Date</TableHead>
            <TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No invoices yet</TableCell></TableRow>}
            {rows.map((s) => (
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
