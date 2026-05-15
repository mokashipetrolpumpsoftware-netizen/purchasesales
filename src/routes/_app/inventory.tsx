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
import { Plus, Search, AlertTriangle, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useShop } from "@/hooks/useShop";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/inventory")({ component: Inventory });

const empty = { name: "", category: "Medicine", batch: "", expiry: "", mrp: 0, purchase_price: 0, selling_price: 0, stock: 0, unit: "tablet" };
type Product = Tables<"products">;

function Inventory() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(empty);
  const { data: shop } = useShop();
  const qc = useQueryClient();

  const { data: products = [] } = useQuery({
    queryKey: ["products", shop?.shop_id],
    enabled: !!shop?.shop_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const closeForm = () => {
    setOpen(false);
    setEditing(null);
    setForm(empty);
  };

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("products").insert({ ...form, shop_id: shop!.shop_id, expiry: form.expiry || null });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Product added"); closeForm(); qc.invalidateQueries({ queryKey: ["products"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async () => {
      if (!editing) throw new Error("Select a product to edit");
      const { error } = await supabase.from("products").update({ ...form, expiry: form.expiry || null }).eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Product updated"); closeForm(); qc.invalidateQueries({ queryKey: ["products"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("products").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["products"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const today = new Date();
  const isExpiringSoon = (d: string | null) => d && (new Date(d).getTime() - today.getTime()) / (86400000) < 60;
  const filtered = products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));

  const startEdit = (product: Product) => {
    setEditing(product);
    setForm({
      name: product.name,
      category: product.category,
      batch: product.batch ?? "",
      expiry: product.expiry ?? "",
      mrp: Number(product.mrp),
      purchase_price: Number(product.purchase_price),
      selling_price: Number(product.selling_price),
      stock: Number(product.stock),
      unit: product.unit ?? "",
    });
    setOpen(true);
  };

  return (
    <div>
      <PageHeader title="Inventory" description="Manage medicines and agro products" actions={
        <Dialog open={open} onOpenChange={(next) => next ? setOpen(true) : closeForm()}>
          <DialogTrigger asChild><Button onClick={() => { setEditing(null); setForm(empty); }}><Plus className="h-4 w-4 mr-2" />Add Product</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{editing ? "Edit Product" : "Add Product"}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-2">
              <div className="space-y-2"><Label>Product Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="space-y-2"><Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Medicine">Medicine</SelectItem><SelectItem value="Fertilizer">Fertilizer</SelectItem>
                    <SelectItem value="Seeds">Seeds</SelectItem><SelectItem value="Pesticide">Pesticide</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Batch</Label><Input value={form.batch} onChange={(e) => setForm({ ...form, batch: e.target.value })} /></div>
              <div className="space-y-2"><Label>Expiry</Label><Input type="date" value={form.expiry} onChange={(e) => setForm({ ...form, expiry: e.target.value })} /></div>
              <div className="space-y-2"><Label>MRP (Rs.)</Label><Input type="number" value={form.mrp} onChange={(e) => setForm({ ...form, mrp: +e.target.value })} /></div>
              <div className="space-y-2"><Label>Purchase Price (Rs.)</Label><Input type="number" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: +e.target.value })} /></div>
              <div className="space-y-2"><Label>Selling Price (Rs.)</Label><Input type="number" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: +e.target.value })} /></div>
              <div className="space-y-2"><Label>Stock</Label><Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: +e.target.value })} /></div>
              <div className="space-y-2"><Label>Unit</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={() => editing ? update.mutate() : create.mutate()} disabled={create.isPending || update.isPending}>Save Product</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      } />

      <Card className="p-4 mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search products..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead><TableHead>Category</TableHead><TableHead>Batch</TableHead>
              <TableHead>Expiry</TableHead><TableHead className="text-right">MRP</TableHead>
              <TableHead className="text-right">Selling</TableHead><TableHead className="text-right">Stock</TableHead><TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No products yet</TableCell></TableRow>}
            {filtered.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell><Badge variant="outline">{p.category}</Badge></TableCell>
                <TableCell className="text-muted-foreground">{p.batch}</TableCell>
                <TableCell>
                  <span className={isExpiringSoon(p.expiry) ? "text-destructive font-medium flex items-center gap-1" : ""}>
                    {isExpiringSoon(p.expiry) && <AlertTriangle className="h-3 w-3" />}{p.expiry || "-"}
                  </span>
                </TableCell>
                <TableCell className="text-right">Rs.{p.mrp}</TableCell>
                <TableCell className="text-right">Rs.{p.selling_price}</TableCell>
                <TableCell className="text-right">
                  <span className={Number(p.stock) < 10 ? "text-destructive font-semibold" : ""}>{p.stock} {p.unit}</span>
                </TableCell>
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
