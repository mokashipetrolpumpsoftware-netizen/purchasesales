import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useShop } from "@/hooks/useShop";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/suppliers")({ component: Suppliers });

type Supplier = Tables<"suppliers">;

const emptySupplierForm = { name: "", phone: "", email: "", due: 0 };

function Suppliers() {
  const { data: shop } = useShop();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState(emptySupplierForm);

  const { data: rows = [] } = useQuery({
    queryKey: ["suppliers", shop?.shop_id],
    enabled: !!shop?.shop_id,
    queryFn: async () => (await supabase.from("suppliers").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const closeForm = () => {
    setOpen(false);
    setEditing(null);
    setForm(emptySupplierForm);
  };

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("suppliers").insert({ ...form, shop_id: shop!.shop_id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Supplier added"); closeForm(); qc.invalidateQueries({ queryKey: ["suppliers"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async () => {
      if (!editing) throw new Error("Select a supplier to edit");
      const { error } = await supabase.from("suppliers").update(form).eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Supplier updated"); closeForm(); qc.invalidateQueries({ queryKey: ["suppliers"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["suppliers"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const startEdit = (supplier: Supplier) => {
    setEditing(supplier);
    setForm({ name: supplier.name, phone: supplier.phone ?? "", email: supplier.email ?? "", due: Number(supplier.due) });
    setOpen(true);
  };

  return (
    <div>
      <PageHeader title="Suppliers" description="Manage suppliers and outstanding payables" actions={
        <Dialog open={open} onOpenChange={(next) => next ? setOpen(true) : closeForm()}>
          <DialogTrigger asChild><Button onClick={() => { setEditing(null); setForm(emptySupplierForm); }}><Plus className="h-4 w-4 mr-2" />Add Supplier</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edit Supplier" : "Add Supplier"}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="space-y-2"><Label>Due (Rs.)</Label><Input type="number" value={form.due} onChange={(e) => setForm({ ...form, due: +e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={() => editing ? update.mutate() : create.mutate()} disabled={create.isPending || update.isPending}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      } />
      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Email</TableHead><TableHead className="text-right">Due (Payable)</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No suppliers yet</TableCell></TableRow>}
            {rows.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{s.phone}</TableCell>
                <TableCell className="text-muted-foreground">{s.email}</TableCell>
                <TableCell className={`text-right ${Number(s.due) > 0 ? "text-warning font-semibold" : ""}`}>Rs.{Number(s.due).toLocaleString()}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button size="icon" variant="ghost" onClick={() => startEdit(s)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => del.mutate(s.id)}><Trash2 className="h-4 w-4" /></Button>
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
