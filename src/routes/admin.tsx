import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, LogOut, Search, ShieldCheck, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { AppCopyright } from "@/components/AppCopyright";

export const Route = createFileRoute("/admin")({ component: AdminConsole });

type ShopRow = {
  id: string;
  name: string;
  owner_name: string | null;
  phone: string | null;
  address: string | null;
  created_at: string;
  is_approved: boolean;
  is_enabled: boolean;
  approved_at: string | null;
  approved_by: string | null;
};

function AdminConsole() {
  const { user, loading, signOut } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const isAdmin = user?.email?.toLowerCase() === "admin@purchasesales.com";

  const { data: shops = [], isLoading } = useQuery({
    queryKey: ["platform-shops"],
    enabled: !!user && isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("shops").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as ShopRow[];
    },
  });

  const updateShop = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<ShopRow> }) => {
      const { error } = await supabase.from("shops").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Shop updated");
      qc.invalidateQueries({ queryKey: ["platform-shops"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const filteredShops = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return shops;
    return shops.filter((shop) => [shop.name, shop.owner_name, shop.phone, shop.address].some((value) => (value ?? "").toLowerCase().includes(query)));
  }, [search, shops]);

  const logout = async () => {
    await signOut();
    nav({ to: "/login" });
  };

  if (!loading && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
        <Card className="max-w-md p-6 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" />
          <h1 className="mt-4 text-xl font-semibold">Admin access only</h1>
          <p className="mt-2 text-sm text-muted-foreground">Please login with the platform admin account.</p>
          <Button className="mt-5 w-full" onClick={() => nav({ to: "/login" })}>Go to Login</Button>
          <AppCopyright variant="copyright" className="mt-6" />
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 p-3 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold"><ShieldCheck className="h-6 w-6 text-primary" />PurchaseSales Admin</h1>
            <p className="text-sm text-muted-foreground">Approve, disable and manage registered shops</p>
          </div>
          <Button variant="outline" onClick={logout}><LogOut className="mr-2 h-4 w-4" />Logout</Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Summary label="Total Shops" value={shops.length} />
          <Summary label="Pending" value={shops.filter((shop) => !shop.is_approved).length} />
          <Summary label="Approved" value={shops.filter((shop) => shop.is_approved).length} />
          <Summary label="Disabled" value={shops.filter((shop) => !shop.is_enabled).length} />
        </div>

        <Card className="p-3 sm:p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search shops..." className="pl-9" />
          </div>
        </Card>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shop</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(isLoading || loading) && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Loading shops...</TableCell></TableRow>}
              {!isLoading && filteredShops.length === 0 && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No shops found</TableCell></TableRow>}
              {filteredShops.map((shop) => (
                <TableRow key={shop.id}>
                  <TableCell>
                    <div className="font-medium">{shop.name}</div>
                    <div className="text-xs text-muted-foreground">{shop.address || "-"}</div>
                  </TableCell>
                  <TableCell>{shop.owner_name || "-"}</TableCell>
                  <TableCell>{shop.phone || "-"}</TableCell>
                  <TableCell>{new Date(shop.created_at).toLocaleDateString("en-IN")}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={shop.is_approved ? "default" : "secondary"}>{shop.is_approved ? "Approved" : "Pending"}</Badge>
                      <Badge variant={shop.is_enabled ? "outline" : "destructive"}>{shop.is_enabled ? "Enabled" : "Disabled"}</Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      {!shop.is_approved ? (
                        <Button size="sm" onClick={() => updateShop.mutate({ id: shop.id, patch: { is_approved: true, is_enabled: true } })}>
                          <Check className="mr-1 h-4 w-4" />Approve
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => updateShop.mutate({ id: shop.id, patch: { is_approved: false } })}>
                          <X className="mr-1 h-4 w-4" />Disapprove
                        </Button>
                      )}
                      <Button size="sm" variant={shop.is_enabled ? "destructive" : "outline"} onClick={() => updateShop.mutate({ id: shop.id, patch: { is_enabled: !shop.is_enabled } })}>
                        {shop.is_enabled ? "Disable" : "Enable"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
        <AppCopyright variant="copyright" className="pt-2" />
      </div>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return <Card className="p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></Card>;
}
