import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { TrendingUp, Package, AlertTriangle, IndianRupee } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { PageHeader } from "@/components/PageHeader";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/hooks/useShop";

export const Route = createFileRoute("/_app/dashboard")({ component: Dashboard });

function Dashboard() {
  const { data: shop } = useShop();
  const enabled = !!shop?.shop_id;

  const { data: products = [] } = useQuery({ queryKey: ["products", shop?.shop_id], enabled, queryFn: async () => (await supabase.from("products").select("*")).data ?? [] });
  const { data: sales = [] } = useQuery({ queryKey: ["sales", shop?.shop_id], enabled, queryFn: async () => (await supabase.from("sales").select("*").order("date", { ascending: false })).data ?? [] });
  const { data: customers = [] } = useQuery({ queryKey: ["customers", shop?.shop_id], enabled, queryFn: async () => (await supabase.from("customers").select("*")).data ?? [] });

  const today = new Date().toISOString().slice(0, 10);
  const todaySales = sales.filter((s) => s.date === today).reduce((a, s) => a + Number(s.total), 0);
  const stockValue = products.reduce((a, p) => a + Number(p.selling_price) * Number(p.stock), 0);
  const expiringSoon = products.filter((p) => p.expiry && (new Date(p.expiry).getTime() - Date.now()) / 86400000 < 60).length;
  const pending = customers.reduce((a, c) => a + Number(c.due), 0);

  // Build last 7 days chart
  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const ds = d.toISOString().slice(0, 10);
    return { day: d.toLocaleDateString(undefined, { weekday: "short" }), sales: sales.filter((s) => s.date === ds).reduce((a, s) => a + Number(s.total), 0) };
  });

  const stats = [
    { label: "Today's Sales", value: `₹${todaySales.toLocaleString()}`, icon: IndianRupee },
    { label: "Stock Value", value: `₹${Math.round(stockValue).toLocaleString()}`, icon: Package },
    { label: "Expiring Soon", value: expiringSoon, icon: AlertTriangle },
    { label: "Pending Payments", value: `₹${pending.toLocaleString()}`, icon: TrendingUp },
  ];

  return (
    <div>
      <PageHeader title="Dashboard" description={`Welcome to ${(shop as any)?.shops?.name ?? "your shop"}`} actions={<Button asChild><Link to="/sales/new">New Invoice</Link></Button>} />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-3 sm:p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className="text-lg sm:text-2xl font-bold mt-2 break-words">{s.value}</p>
              </div>
              <div className="h-9 w-9 sm:h-10 sm:w-10 shrink-0 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><s.icon className="h-5 w-5" /></div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
        <Card className="p-3 sm:p-5 lg:col-span-2">
          <h3 className="font-semibold mb-4">Sales — Last 7 Days</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={days}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Line type="monotone" dataKey="sales" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-3 sm:p-5">
          <h3 className="font-semibold mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <Button asChild variant="outline" className="w-full justify-start"><Link to="/inventory">Add Product</Link></Button>
            <Button asChild variant="outline" className="w-full justify-start"><Link to="/purchases">Add Purchase</Link></Button>
            <Button asChild variant="outline" className="w-full justify-start"><Link to="/customers">Add Customer</Link></Button>
            <Button asChild variant="outline" className="w-full justify-start"><Link to="/alerts">Check Expiring Stock</Link></Button>
          </div>
        </Card>
      </div>

      <Card className="p-3 sm:p-5 mt-6">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h3 className="font-semibold">Recent Sales</h3>
          <Button asChild variant="ghost" size="sm"><Link to="/sales">View all</Link></Button>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Customer</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {sales.slice(0, 5).map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.invoice_no}</TableCell>
                <TableCell>{s.customer_name || "Walk-in"}</TableCell>
                <TableCell className="text-muted-foreground">{s.date}</TableCell>
                <TableCell className="text-right">₹{Number(s.total).toLocaleString()}</TableCell>
                <TableCell><Badge variant={s.status === "Paid" ? "default" : "secondary"}>{s.status}</Badge></TableCell>
              </TableRow>
            ))}
            {sales.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No sales yet</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
