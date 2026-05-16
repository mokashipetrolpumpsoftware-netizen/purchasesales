import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useShop } from "@/hooks/useShop";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/purchases")({ component: Purchases });

type Purchase = Tables<"purchases">;

const emptyCreateForm = { supplier_id: "", product_id: "", batch: "", expiry: "", qty: 1, price: 0 };
const emptyEditForm = { bill_no: "", supplier_id: "", date: "", total: 0, status: "Received" };

function Purchases() {
  const { data: shop } = useShop();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Purchase | null>(null);
  const [form, setForm] = useState(emptyCreateForm);
  const [editForm, setEditForm] = useState(emptyEditForm);

  const { data: rows = [] } = useQuery({
    queryKey: ["purchases", shop?.shop_id],
    enabled: !!shop?.shop_id,
    queryFn: async () => (await supabase.from("purchases").select("*").order("date", { ascending: false })).data ?? [],
  });
  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers", shop?.shop_id], enabled: !!shop?.shop_id, queryFn: async () => (await supabase.from("suppliers").select("*")).data ?? [] });
  const { data: products = [] } = useQuery({ queryKey: ["products", shop?.shop_id], enabled: !!shop?.shop_id, queryFn: async () => (await supabase.from("products").select("*")).data ?? [] });

  const create = useMutation({
    mutationFn: async () => {
      const supplier = suppliers.find((s) => s.id === form.supplier_id);
      const product = products.find((p) => p.id === form.product_id);
      if (!supplier || !product) throw new Error("Select supplier and product");
      const total = form.qty * form.price;
      const bill_no = `PUR-${Date.now().toString().slice(-6)}`;
      const { data: purchase, error } = await supabase.from("purchases").insert({
        shop_id: shop!.shop_id, bill_no, supplier_id: supplier.id, supplier_name: supplier.name, total, status: "Received",
      }).select().single();
      if (error) throw error;
      const { error: itemError } = await supabase.from("purchase_items").insert({
        purchase_id: purchase.id, product_id: product.id, product_name: product.name,
        batch: form.batch, expiry: form.expiry || null, qty: form.qty, price: form.price, amount: total,
      });
      if (itemError) throw itemError;
      const { error: stockError } = await supabase.from("products").update({ stock: Number(product.stock) + form.qty, batch: form.batch || product.batch, expiry: form.expiry || product.expiry }).eq("id", product.id);
      if (stockError) throw stockError;
    },
    onSuccess: () => { toast.success("Purchase recorded"); setOpen(false); setForm(emptyCreateForm); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async () => {
      if (!editing) throw new Error("Select a purchase to edit");
      const supplier = suppliers.find((s) => s.id === editForm.supplier_id);
      const { error } = await supabase.from("purchases").update({
        bill_no: editForm.bill_no,
        supplier_id: supplier?.id ?? null,
        supplier_name: supplier?.name ?? null,
        date: editForm.date,
        total: editForm.total,
        status: editForm.status,
      }).eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Purchase updated"); setEditOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["purchases"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("purchases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Purchase deleted"); qc.invalidateQueries({ queryKey: ["purchases"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const startEdit = (purchase: Purchase) => {
    setEditing(purchase);
    setEditForm({
      bill_no: purchase.bill_no,
      supplier_id: purchase.supplier_id ?? "",
      date: purchase.date,
      total: Number(purchase.total),
      status: purchase.status,
    });
    setEditOpen(true);
  };

  return (
    <div>
      <PageHeader title="Purchases" description="Stock-in entries from suppliers" actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New Purchase</Button></DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>Add Purchase Entry</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2"><Label>Supplier</Label>
                <Select value={form.supplier_id} onValueChange={(v) => setForm({ ...form, supplier_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>{suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Product</Label>
                <Select value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                  <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Batch</Label><Input value={form.batch} onChange={(e) => setForm({ ...form, batch: e.target.value })} /></div>
                <div className="space-y-2"><Label>Expiry</Label><Input type="date" value={form.expiry} onChange={(e) => setForm({ ...form, expiry: e.target.value })} /></div>
                <div className="space-y-2"><Label>Quantity</Label><Input type="number" value={form.qty} onChange={(e) => setForm({ ...form, qty: +e.target.value })} /></div>
                <div className="space-y-2"><Label>Cost Price</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: +e.target.value })} /></div>
              </div>
              <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">Stock will be auto-updated upon save</div>
            </div>
            <DialogFooter><Button onClick={() => create.mutate()} disabled={create.isPending}>Save Purchase</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      } />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Edit Purchase</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-2"><Label>Bill No.</Label><Input value={editForm.bill_no} onChange={(e) => setEditForm({ ...editForm, bill_no: e.target.value })} /></div>
            <div className="space-y-2"><Label>Date</Label><Input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} /></div>
            <div className="space-y-2 col-span-2"><Label>Supplier</Label>
              <Select value={editForm.supplier_id || "none"} onValueChange={(v) => setEditForm({ ...editForm, supplier_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No supplier</SelectItem>
                  {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Total</Label><Input type="number" value={editForm.total} onChange={(e) => setEditForm({ ...editForm, total: +e.target.value })} /></div>
            <div className="space-y-2"><Label>Status</Label><Input value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={() => update.mutate()} disabled={update.isPending}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Bill</TableHead><TableHead>Supplier</TableHead><TableHead>Date</TableHead>
            <TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No purchases yet</TableCell></TableRow>}
            {rows.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.bill_no}</TableCell>
                <TableCell>{p.supplier_name}</TableCell>
                <TableCell className="text-muted-foreground">{p.date}</TableCell>
                <TableCell className="text-right">Rs.{Number(p.total).toLocaleString()}</TableCell>
                <TableCell><Badge>{p.status}</Badge></TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button size="icon" variant="ghost" onClick={() => startEdit(p)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => del.mutate(p.id)}><Trash2 className="h-4 w-4" /></Button>
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
