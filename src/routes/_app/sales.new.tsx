import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/hooks/useShop";
import { openSmsMessage } from "@/lib/sms";
import { openWhatsAppMessage } from "@/lib/whatsapp";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/sales/new")({ component: NewSale });

type Item = { productId: string; qty: string; price: string };
type PaymentType = "cash" | "udhari";

function NewSale() {
  const nav = useNavigate();
  const { data: shop } = useShop();
  const qc = useQueryClient();
  const [customerId, setCustomerId] = useState("");
  const [paymentType, setPaymentType] = useState<PaymentType>("cash");
  const [discount, setDiscount] = useState(0);
  const [gst, setGst] = useState(5);
  const [items, setItems] = useState<Item[]>([]);

  const { data: products = [] } = useQuery({
    queryKey: ["products", shop?.shop_id],
    enabled: !!shop?.shop_id,
    queryFn: async () => (await supabase.from("products").select("*").order("name")).data ?? [],
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers", shop?.shop_id],
    enabled: !!shop?.shop_id,
    queryFn: async () => (await supabase.from("customers").select("*").order("name")).data ?? [],
  });

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const lines = items.map((i) => {
    const p = products.find((x) => x.id === i.productId);
    const qty = Number(i.qty) || 0;
    const price = Number(i.price) || 0;
    return { ...(p as any), qty, price, total: p ? price * qty : 0 };
  });
  const subtotal = lines.reduce((s, l) => s + l.total, 0);
  const discAmt = (subtotal * discount) / 100;
  const taxable = subtotal - discAmt;
  const gstAmt = (taxable * gst) / 100;
  const total = taxable + gstAmt;
  const shopName = (shop as any)?.shops?.name ?? "our shop";

  const save = useMutation({
    mutationFn: async () => {
      if (!items.length) throw new Error("Add at least one item");
      if (lines.some((line) => !line.id || line.qty <= 0)) throw new Error("Enter valid quantity");
      if (lines.some((line) => line.price <= 0)) throw new Error("Enter valid rate");
      if (paymentType === "udhari" && !selectedCustomer) throw new Error("Select a customer for udhari sale");
      const invoice_no = `INV-${Date.now().toString().slice(-6)}`;
      const status = paymentType === "cash" ? "Paid" : "Pending";
      const { data: sale, error } = await supabase.from("sales").insert({
        shop_id: shop!.shop_id,
        invoice_no,
        customer_id: selectedCustomer?.id ?? null,
        customer_name: selectedCustomer?.name ?? "Walk-in",
        subtotal,
        discount: discAmt,
        tax: gstAmt,
        total,
        status,
      }).select().single();
      if (error) throw error;
      const itemRows = lines.map((l) => ({ sale_id: sale.id, product_id: l.id, product_name: l.name, qty: l.qty, price: l.price, amount: l.total }));
      const { error: itemsError } = await supabase.from("sale_items").insert(itemRows);
      if (itemsError) throw itemsError;
      if (paymentType === "udhari" && selectedCustomer) {
        const { data: latestCustomer, error: customerError } = await supabase
          .from("customers")
          .select("due")
          .eq("id", selectedCustomer.id)
          .single();
        if (customerError) throw customerError;
        const { error: dueError } = await supabase
          .from("customers")
          .update({ due: Number(latestCustomer.due) + total })
          .eq("id", selectedCustomer.id);
        if (dueError) throw dueError;
        const { error: ledgerError } = await supabase.from("ledger_entries").insert({
          shop_id: shop!.shop_id,
          party: selectedCustomer.name,
          type: "Debit",
          amount: total,
          note: `Invoice ${invoice_no} pending`,
        });
        if (ledgerError) throw ledgerError;
      }
      // decrement stock
      for (const l of lines) {
        const { error: stockError } = await supabase.from("products").update({ stock: Number(l.stock) - l.qty }).eq("id", l.id);
        if (stockError) throw stockError;
      }
      const dateTime = new Date().toLocaleString("en-IN");
      const itemDetails = lines.map((l) => `${l.name} x ${l.qty} @ Rs.${l.price.toLocaleString()} = Rs.${l.total.toLocaleString()}`).join("\n");
      const message = [
        `Hello ${selectedCustomer?.name ?? "Customer"},`,
        `Thank you for shopping at ${shopName}.`,
        "",
        `Invoice: ${invoice_no}`,
        `Date/Time: ${dateTime}`,
        `Customer: ${selectedCustomer?.name ?? "Walk-in"}`,
        "",
        "Items:",
        itemDetails,
        "",
        `Subtotal: Rs.${subtotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
        `Discount: Rs.${discAmt.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
        `GST: Rs.${gstAmt.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
        `Total: Rs.${total.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
        `Payment status: ${status}`,
      ].join("\n");
      return selectedCustomer?.phone ? { phone: selectedCustomer.phone, message } : null;
    },
    onSuccess: (notification) => {
      toast.success("Invoice saved");
      if (notification) {
        const whatsappOpened = openWhatsAppMessage(notification.phone, notification.message);
        const smsOpened = openSmsMessage(notification.phone, notification.message);
        if (!whatsappOpened || !smsOpened) toast.warning("Customer phone number missing for message");
      }
      if (!notification && selectedCustomer) toast.warning("Customer phone number missing for message");
      qc.invalidateQueries();
      nav({ to: "/sales" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader title="New Invoice" description="Create a sales invoice" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-3 sm:p-5 lg:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="space-y-2">
              <Label>Customer</Label>
              <Select value={customerId || "walk-in"} onValueChange={(v) => setCustomerId(v === "walk-in" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Walk-in customer" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="walk-in">Walk-in customer</SelectItem>
                  {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}{c.phone ? ` - ${c.phone}` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Payment</Label>
              <Select value={paymentType} onValueChange={(v) => setPaymentType(v as PaymentType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash - paid now</SelectItem>
                  <SelectItem value="udhari">Udhari - pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
            <h3 className="font-semibold">Items</h3>
            <Button size="sm" variant="outline" className="w-full sm:w-auto" disabled={!products.length} onClick={() => setItems([...items, { productId: products[0].id, qty: "1", price: String(products[0].selling_price) }])}>
              <Plus className="h-4 w-4 mr-1" />Add Item
            </Button>
          </div>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Product</TableHead><TableHead>Stock</TableHead>
              <TableHead>Qty</TableHead><TableHead>Rate</TableHead><TableHead className="text-right">Total</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {lines.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">{products.length ? "Click Add Item" : "Add products first"}</TableCell></TableRow>}
              {lines.map((l, idx) => (
                <TableRow key={idx}>
                  <TableCell className="min-w-[200px]">
                    <Select value={l.id} onValueChange={(v) => {
                      const product = products.find((p) => p.id === v);
                      const c = [...items];
                      c[idx].productId = v;
                      c[idx].price = String(product?.selling_price ?? "");
                      setItems(c);
                    }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} — {p.batch}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell><span className={Number(l.stock) < 10 ? "text-destructive" : ""}>{l.stock}</span></TableCell>
                  <TableCell><Input type="text" inputMode="decimal" className="w-24" value={items[idx].qty} onChange={(e) => { const c = [...items]; c[idx].qty = e.target.value; setItems(c); }} /></TableCell>
                  <TableCell><Input type="text" inputMode="decimal" className="w-28" value={items[idx].price} onChange={(e) => { const c = [...items]; c[idx].price = e.target.value; setItems(c); }} /></TableCell>
                  <TableCell className="text-right">₹{l.total.toLocaleString()}</TableCell>
                  <TableCell><Button size="icon" variant="ghost" onClick={() => setItems(items.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <Card className="p-3 sm:p-5 h-fit">
          <h3 className="font-semibold mb-4">Bill Summary</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm"><span>Subtotal</span><span>₹{subtotal.toLocaleString()}</span></div>
            <div className="flex items-center justify-between gap-2 text-sm"><span>Discount (%)</span><Input type="text" inputMode="decimal" className="w-20 h-8" value={discount} onChange={(e) => setDiscount(+e.target.value)} /></div>
            <div className="flex items-center justify-between gap-2 text-sm"><span>GST (%)</span><Input type="text" inputMode="decimal" className="w-20 h-8" value={gst} onChange={(e) => setGst(+e.target.value)} /></div>
            <div className="border-t pt-3 flex justify-between font-semibold text-lg"><span>Total</span><span>₹{total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
            <Button className="w-full" onClick={() => save.mutate()} disabled={save.isPending}>Save Invoice</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
