import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { PageHeader } from "@/components/PageHeader";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/hooks/useShop";

export const Route = createFileRoute("/_app/reports")({ component: Reports });

function Reports() {
  const { data: shop } = useShop();
  const { data: sales = [] } = useQuery({ queryKey: ["sales", shop?.shop_id], enabled: !!shop?.shop_id, queryFn: async () => (await supabase.from("sales").select("*")).data ?? [] });

  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const ds = d.toISOString().slice(0, 10);
    return { day: d.toLocaleDateString(undefined, { weekday: "short" }), sales: sales.filter((s) => s.date === ds).reduce((a, s) => a + Number(s.total), 0) };
  });

  return (
    <div>
      <PageHeader title="Reports" description="Sales, purchase, stock and expiry analytics" />
      <Tabs defaultValue="sales">
        <TabsList>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="purchase">Purchase</TabsTrigger>
          <TabsTrigger value="stock">Stock</TabsTrigger>
        </TabsList>
        <TabsContent value="sales">
          <Card className="p-5">
            <h3 className="font-semibold mb-4">Sales — Last 7 Days</h3>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={days}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Bar dataKey="sales" fill="var(--primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </TabsContent>
        <TabsContent value="purchase"><Card className="p-8 text-center text-muted-foreground">Purchase report — supplier-wise totals.</Card></TabsContent>
        <TabsContent value="stock"><Card className="p-8 text-center text-muted-foreground">Stock report — current valuation by category.</Card></TabsContent>
      </Tabs>
    </div>
  );
}
