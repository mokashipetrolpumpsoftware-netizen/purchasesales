import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { HandCoins, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useShop } from "@/hooks/useShop";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/suppliers")({ component: Suppliers });

type Supplier = Tables<"suppliers">;

const emptySupplierForm = { name: "", phone: "", email: "", due: 0 };
const todayInputValue = () => new Date().toISOString().slice(0, 10);

function Suppliers() {
  const { data: shop } = useShop();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState(emptySupplierForm);
  const [search, setSearch] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [paySupplier, setPaySupplier] = useState<Supplier | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payDate, setPayDate] = useState(todayInputValue());

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

  const pay = useMutation({
    mutationFn: async () => {
      if (!paySupplier) throw new Error("Select a supplier");
      if (payAmount <= 0) throw new Error("Enter amount to pay");
      const { data: latestSupplier, error: supplierError } = await supabase.from("suppliers").select("due").eq("id", paySupplier.id).single();
      if (supplierError) throw supplierError;
      const currentDue = Number(latestSupplier.due);
      if (payAmount > currentDue) throw new Error("Payment amount cannot be more than payable");
      const { error: updateError } = await supabase.from("suppliers").update({ due: currentDue - payAmount }).eq("id", paySupplier.id);
      if (updateError) throw updateError;
      const { error: ledgerError } = await supabase.from("ledger_entries").insert({
        shop_id: shop!.shop_id,
        party: paySupplier.name,
        type: "Debit",
        amount: payAmount,
        date: payDate,
        note: "Supplier payment",
      });
      if (ledgerError) throw ledgerError;
    },
    onSuccess: () => {
      toast.success("Supplier payment recorded");
      setPayOpen(false);
      setPaySupplier(null);
      setPayAmount(0);
      setPayDate(todayInputValue());
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      qc.invalidateQueries({ queryKey: ["ledger"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startEdit = (supplier: Supplier) => {
    setEditing(supplier);
    setForm({ name: supplier.name, phone: supplier.phone ?? "", email: supplier.email ?? "", due: Number(supplier.due) });
    setOpen(true);
  };

  const startPayment = (supplier: Supplier) => {
    setPaySupplier(supplier);
    setPayAmount(Number(supplier.due));
    setPayDate(todayInputValue());
    setPayOpen(true);
  };

  const filteredRows = rows.filter((supplier) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return [supplier.name, supplier.phone, supplier.email].some((value) => (value ?? "").toLowerCase().includes(query));
  });

  return (
    <div>
      <PageHeader title="Suppliers" description="Manage suppliers and outstanding payables" actions={
        <Dialog open={open} onOpenChange={(next) => next ? setOpen(true) : closeForm()}>
          <DialogTrigger asChild><Button onClick={() => { setEditing(null); setForm(emptySupplierForm); }}><Plus className="h-4 w-4 mr-2" />Add Supplier</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edit Supplier" : "Add Supplier"}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={10} /></div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="space-y-2"><Label>Due (Rs.)</Label><Input type="text" inputMode="decimal" value={form.due} onChange={(e) => setForm({ ...form, due: +e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={() => editing ? update.mutate() : create.mutate()} disabled={create.isPending || update.isPending}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      } />
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Pay Supplier</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="font-medium">{paySupplier?.name}</p>
              <p className="text-sm text-muted-foreground">Current payable: Rs.{Number(paySupplier?.due ?? 0).toLocaleString()}</p>
            </div>
            <div className="space-y-2">
              <Label>Payment Date</Label>
              <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Amount (Rs.)</Label>
              <Input type="text" inputMode="decimal" min={1} max={Number(paySupplier?.due ?? 0)} value={payAmount} onChange={(e) => setPayAmount(+e.target.value)} />
            </div>
          </div>
          <DialogFooter><Button onClick={() => pay.mutate()} disabled={pay.isPending}>Pay</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Card className="p-3 sm:p-4 mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search suppliers by name, phone, email..." className="pl-9" />
        </div>
      </Card>
      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Email</TableHead><TableHead className="text-right">Due (Payable)</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {filteredRows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No suppliers found</TableCell></TableRow>}
            {filteredRows.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{s.phone}</TableCell>
                <TableCell className="text-muted-foreground">{s.email}</TableCell>
                <TableCell className={`text-right ${Number(s.due) > 0 ? "text-warning font-semibold" : ""}`}>Rs.{Number(s.due).toLocaleString()}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" disabled={Number(s.due) <= 0} onClick={() => startPayment(s)}>
                      <HandCoins className="h-4 w-4 mr-1" />Pay
                    </Button>
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
