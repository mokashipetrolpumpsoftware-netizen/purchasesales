import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, PackageX } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/hooks/useShop";

export const Route = createFileRoute("/_app/alerts")({ component: Alerts });

function Alerts() {
  const { data: shop } = useShop();
  const { data: products = [] } = useQuery({
    queryKey: ["products", shop?.shop_id],
    enabled: !!shop?.shop_id,
    queryFn: async () => (await supabase.from("products").select("*")).data ?? [],
  });

  const today = new Date();
  const expiring = products.filter((p) => p.expiry && (new Date(p.expiry).getTime() - today.getTime()) / 86400000 < 90);
  const lowStock = products.filter((p) => Number(p.stock) < 15);

  return (
    <div>
      <PageHeader title="Expiry & Alerts" description="Critical inventory issues that need attention" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-3 sm:p-5 border-destructive/30 bg-destructive/5">
          <div className="flex items-center gap-2 mb-4"><AlertTriangle className="h-5 w-5 text-destructive" /><h3 className="font-semibold">Expiring Soon ({expiring.length})</h3></div>
          <Table>
            <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Batch</TableHead><TableHead>Expiry</TableHead></TableRow></TableHeader>
            <TableBody>
              {expiring.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.batch}</TableCell>
                  <TableCell><Badge variant="destructive">{p.expiry}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
        <Card className="p-3 sm:p-5 border-warning/30 bg-warning/5">
          <div className="flex items-center gap-2 mb-4"><PackageX className="h-5 w-5 text-warning" /><h3 className="font-semibold">Low Stock ({lowStock.length})</h3></div>
          <Table>
            <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Stock</TableHead></TableRow></TableHeader>
            <TableBody>
              {lowStock.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell><Badge variant="outline">{p.category}</Badge></TableCell>
                  <TableCell className="text-right font-semibold text-destructive">{p.stock} {p.unit}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
