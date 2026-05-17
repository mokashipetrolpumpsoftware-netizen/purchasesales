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
import { openSmsMessage } from "@/lib/sms";
import { openWhatsAppMessage } from "@/lib/whatsapp";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/customers")({ component: Customers });

type Customer = Tables<"customers">;

const emptyCustomerForm = { name: "", phone: "", email: "", due: 0 };
const todayInputValue = () => new Date().toISOString().slice(0, 10);

function Customers() {
  const { data: shop } = useShop();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyCustomerForm);
  const [collectOpen, setCollectOpen] = useState(false);
  const [collectCustomer, setCollectCustomer] = useState<Customer | null>(null);
  const [collectAmount, setCollectAmount] = useState(0);
  const [collectDate, setCollectDate] = useState(todayInputValue());
  const [search, setSearch] = useState("");

  const { data: rows = [] } = useQuery({
    queryKey: ["customers", shop?.shop_id],
    enabled: !!shop?.shop_id,
    queryFn: async () => (await supabase.from("customers").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const closeForm = () => {
    setOpen(false);
    setEditing(null);
    setForm(emptyCustomerForm);
  };

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("customers").insert({ ...form, shop_id: shop!.shop_id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Customer added"); closeForm(); qc.invalidateQueries({ queryKey: ["customers"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async () => {
      if (!editing) throw new Error("Select a customer to edit");
      const { error } = await supabase.from("customers").update(form).eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Customer updated"); closeForm(); qc.invalidateQueries({ queryKey: ["customers"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const collect = useMutation({
    mutationFn: async () => {
      if (!collectCustomer) throw new Error("Select a customer");
      if (collectAmount <= 0) throw new Error("Enter amount to collect");
      const { data: latestCustomer, error: customerError } = await supabase.from("customers").select("due").eq("id", collectCustomer.id).single();
      if (customerError) throw customerError;
      const currentDue = Number(latestCustomer.due);
      if (collectAmount > currentDue) throw new Error("Collection amount cannot be more than due");
      const { error: updateError } = await supabase.from("customers").update({ due: currentDue - collectAmount }).eq("id", collectCustomer.id);
      if (updateError) throw updateError;
      const { error: ledgerError } = await supabase.from("ledger_entries").insert({
        shop_id: shop!.shop_id,
        party: collectCustomer.name,
        type: "Credit",
        amount: collectAmount,
        date: collectDate,
        note: "Customer due collection",
      });
      if (ledgerError) throw ledgerError;
      const remainingDue = currentDue - collectAmount;
      const message = [
        `Hello ${collectCustomer.name},`,
        "Payment received successfully.",
        "",
        `Collection date: ${collectDate}`,
        `Message time: ${new Date().toLocaleString("en-IN")}`,
        `Received amount: Rs.${collectAmount.toLocaleString()}`,
        `Remaining pending amount: Rs.${remainingDue.toLocaleString()}`,
        `Payment status: ${remainingDue > 0 ? "Pending" : "Paid"}`,
      ].join("\n");
      return collectCustomer.phone ? { phone: collectCustomer.phone, message } : null;
    },
    onSuccess: (notification) => {
      toast.success("Payment collected");
      if (notification) {
        const whatsappOpened = openWhatsAppMessage(notification.phone, notification.message);
        const smsOpened = openSmsMessage(notification.phone, notification.message);
        if (!whatsappOpened || !smsOpened) toast.warning("Customer phone number missing for message");
      }
      if (!notification && collectCustomer) toast.warning("Customer phone number missing for message");
      setCollectOpen(false);
      setCollectCustomer(null);
      setCollectAmount(0);
      setCollectDate(todayInputValue());
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["ledger"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startEdit = (customer: Customer) => {
    setEditing(customer);
    setForm({ name: customer.name, phone: customer.phone ?? "", email: customer.email ?? "", due: Number(customer.due) });
    setOpen(true);
  };

  const startCollection = (customer: Customer) => {
    setCollectCustomer(customer);
    setCollectAmount(Number(customer.due));
    setCollectDate(todayInputValue());
    setCollectOpen(true);
  };

  const filteredRows = rows.filter((customer) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return [customer.name, customer.phone, customer.email].some((value) => (value ?? "").toLowerCase().includes(query));
  });

  return (
    <div>
      <PageHeader title="Customers" description="Customer directory & dues" actions={
        <Dialog open={open} onOpenChange={(next) => next ? setOpen(true) : closeForm()}>
          <DialogTrigger asChild><Button onClick={() => { setEditing(null); setForm(emptyCustomerForm); }}><Plus className="h-4 w-4 mr-2" />Add Customer</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edit Customer" : "Add Customer"}</DialogTitle></DialogHeader>
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
      <Dialog open={collectOpen} onOpenChange={setCollectOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Collect Payment</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="font-medium">{collectCustomer?.name}</p>
              <p className="text-sm text-muted-foreground">Current due: Rs.{Number(collectCustomer?.due ?? 0).toLocaleString()}</p>
            </div>
            <div className="space-y-2">
            <div className="space-y-2">
              <Label>Collection Date</Label>
              <Input type="date" value={collectDate} onChange={(e) => setCollectDate(e.target.value)} />
            </div>
              <Label>Amount (Rs.)</Label>
              <Input type="text" inputMode="decimal" min={1} max={Number(collectCustomer?.due ?? 0)} value={collectAmount} onChange={(e) => setCollectAmount(+e.target.value)} />
            </div>

          </div>
          <DialogFooter><Button onClick={() => collect.mutate()} disabled={collect.isPending}>Collect</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Card className="p-3 sm:p-4 mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customers by name, phone, email..." className="pl-9" />
        </div>
      </Card>
      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Email</TableHead><TableHead className="text-right">Due</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {filteredRows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No customers found</TableCell></TableRow>}
            {filteredRows.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.phone}</TableCell>
                <TableCell className="text-muted-foreground">{c.email}</TableCell>
                <TableCell className={`text-right ${Number(c.due) > 0 ? "text-destructive font-semibold" : ""}`}>Rs.{Number(c.due).toLocaleString()}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" disabled={Number(c.due) <= 0} onClick={() => startCollection(c)}>
                      <HandCoins className="h-4 w-4 mr-1" />Collect
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => startEdit(c)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => del.mutate(c.id)}><Trash2 className="h-4 w-4" /></Button>
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
