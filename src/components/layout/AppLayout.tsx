import { Outlet, useNavigate } from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Bell, LogOut, Search } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppCopyright } from "@/components/AppCopyright";

export function AppLayout({ children }: { children?: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const nav = useNavigate();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, email, shops(name)")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const initials = (profile?.full_name || user?.email || "U")
    .split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full overflow-x-hidden bg-muted/30">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-2 sm:gap-3 border-b bg-card px-3 sm:px-4 sticky top-0 z-10">
            <SidebarTrigger />
            <div className="relative hidden md:block flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search..." className="pl-9 h-9 bg-muted/50 border-0" />
            </div>
            <div className="ml-auto flex items-center gap-1.5 sm:gap-3">
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback>
                </Avatar>
                <div className="hidden md:flex flex-col leading-tight">
                  <span className="text-sm font-medium">{profile?.full_name || user?.email}</span>
                  <span className="text-xs text-muted-foreground">{(profile as any)?.shops?.name || "Shop"}</span>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={async () => { await signOut(); nav({ to: "/login" }); }}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>
          <main className="flex-1 min-w-0 overflow-auto p-3 sm:p-4 lg:p-6">
            {children ?? <Outlet />}
            <AppCopyright variant="copyright" className="mt-8 border-t pt-4" />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
