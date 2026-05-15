import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useShop } from "@/hooks/useShop";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/ledger")({ component: Ledger });

type LedgerEntry = Tables<"ledger_entries">;

const emptyLedgerForm = { date: new Date().toISOString().slice(0, 10), party: "", type: "Credit", amount: 0, note: "" };

function Ledger() {
  const { data: shop } = useShop();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LedgerEntry | null>(null);
  const [form, setForm] = useState(emptyLedgerForm);

  const { data: rows = [] } = useQuery({
    queryKey: ["ledger", shop?.shop_id],
    enabled: !!shop?.shop_id,
    queryFn: async () => (await supabase.from("ledger_entries").select("*").order("date", { ascending: false })).data ?? [],
  });

  const closeForm = () => {
    setOpen(false);
    setEditing(null);
    setForm({ ...emptyLedgerForm, date: new Date().toISOString().slice(0, 10) });
  };

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("ledger_entries").insert({ ...form, shop_id: shop!.shop_id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Entry added"); closeForm(); qc.invalidateQueries({ queryKey: ["ledger"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async () => {
      if (!editing) throw new Error("Select an entry to edit");
      const { error } = await supabase.from("ledger_entries").update(form).eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Entry updated"); closeForm(); qc.invalidateQueries({ queryKey: ["ledger"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ledger_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ledger"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const startEdit = (entry: LedgerEntry) => {
    setEditing(entry);
    setForm({ date: entry.date, party: entry.party, type: entry.type, amount: Number(entry.amount), note: entry.note ?? "" });
    setOpen(true);
  };

  const totalCr = rows.filter((l) => l.type === "Credit").reduce((s, l) => s + Number(l.amount), 0);
  const totalDr = rows.filter((l) => l.type === "Debit").reduce((s, l) => s + Number(l.amount), 0);

  return (
    <div>
      <PageHeader title="Ledger / Accounts" description="All credit and debit transactions" actions={
        <Dialog open={open} onOpenChange={(next) => next ? setOpen(true) : closeForm()}>
          <DialogTrigger asChild><Button onClick={() => { setEditing(null); setForm({ ...emptyLedgerForm, date: new Date().toISOString().slice(0, 10) }); }}><Plus className="h-4 w-4 mr-2" />New Entry</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edit Ledger Entry" : "Add Ledger Entry"}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-2">
              <div className="space-y-2"><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              <div className="space-y-2"><Label>Type</Label>
                <select className="w-full h-10 border rounded-md px-2 bg-background" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option>Credit</option><option>Debit</option>
                </select>
              </div>
              <div className="space-y-2 col-span-2"><Label>Party</Label><Input value={form.party} onChange={(e) => setForm({ ...form, party: e.target.value })} /></div>
              <div className="space-y-2"><Label>Amount</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: +e.target.value })} /></div>
              <div className="space-y-2 col-span-2"><Label>Note</Label><Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={() => editing ? update.mutate() : create.mutate()} disabled={create.isPending || update.isPending}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      } />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="p-5"><p className="text-sm text-muted-foreground">Total Credit</p><p className="text-2xl font-bold text-success mt-1">Rs.{totalCr.toLocaleString()}</p></Card>
        <Card className="p-5"><p className="text-sm text-muted-foreground">Total Debit</p><p className="text-2xl font-bold text-destructive mt-1">Rs.{totalDr.toLocaleString()}</p></Card>
        <Card className="p-5"><p className="text-sm text-muted-foreground">Net Balance</p><p className="text-2xl font-bold mt-1">Rs.{(totalCr - totalDr).toLocaleString()}</p></Card>
      </div>
      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Date</TableHead><TableHead>Party</TableHead><TableHead>Type</TableHead>
            <TableHead>Note</TableHead><TableHead className="text-right">Amount</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No entries yet</TableCell></TableRow>}
            {rows.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="text-muted-foreground">{l.date}</TableCell>
                <TableCell className="font-medium">{l.party}</TableCell>
                <TableCell>
                  <Badge className={l.type === "Credit" ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}>{l.type}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{l.note}</TableCell>
                <TableCell className="text-right font-medium">Rs.{Number(l.amount).toLocaleString()}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button size="icon" variant="ghost" onClick={() => startEdit(l)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => del.mutate(l.id)}><Trash2 className="h-4 w-4" /></Button>
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
