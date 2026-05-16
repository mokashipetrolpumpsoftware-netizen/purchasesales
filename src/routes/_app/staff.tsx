import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/hooks/useShop";
import { Search } from "lucide-react";

export const Route = createFileRoute("/_app/staff")({ component: Staff });

function Staff() {
  const { data: shop } = useShop();
  const [search, setSearch] = useState("");
  const { data: rows = [] } = useQuery({
    queryKey: ["staff", shop?.shop_id],
    enabled: !!shop?.shop_id,
    queryFn: async () => {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, email");
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      return (profiles ?? []).map((p) => ({ ...p, role: roles?.find((r) => r.user_id === p.id)?.role ?? "staff" }));
    },
  });

  const filteredRows = rows.filter((staff) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return [staff.full_name, staff.email, staff.role].some((value) => (value ?? "").toLowerCase().includes(query));
  });

  return (
    <div>
      <PageHeader title="User Management" description="Shop staff and roles" />
      <Card className="p-3 sm:p-4 mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users by name, email, role..." className="pl-9" />
        </div>
      </Card>
      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead></TableRow></TableHeader>
          <TableBody>
            {filteredRows.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No users found</TableCell></TableRow>}
            {filteredRows.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8"><AvatarFallback className="bg-primary text-primary-foreground text-xs">{(s.full_name || s.email || "U").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                    <span className="font-medium">{s.full_name || "—"}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{s.email}</TableCell>
                <TableCell><Badge variant={s.role === "admin" ? "default" : "secondary"} className="capitalize">{s.role}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-xs text-muted-foreground p-4 border-t">Staff invites are sent by your Admin. New signups create their own shop tenant.</p>
      </Card>
    </div>
  );
}
