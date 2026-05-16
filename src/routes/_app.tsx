import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { useShop } from "@/hooks/useShop";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Clock, LogOut, Mail, Phone } from "lucide-react";

export const Route = createFileRoute("/_app")({ component: AppGate });

function AppGate() {
  const { user, loading } = useAuth();
  const { data: shop, isLoading: shopLoading } = useShop();
  const nav = useNavigate();
  const isPlatformAdmin = user?.email?.toLowerCase() === "admin@purchasesales.com";

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
    if (!loading && isPlatformAdmin) nav({ to: "/admin" });
  }, [isPlatformAdmin, user, loading, nav]);

  if (loading || !user || (!isPlatformAdmin && shopLoading)) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;
  }

  const shopDetails = (shop as any)?.shops;
  if (!isPlatformAdmin && (!shopDetails?.is_approved || !shopDetails?.is_enabled)) {
    return <ApprovalPending shopName={shopDetails?.name ?? "Your Shop"} disabled={shopDetails?.is_enabled === false} />;
  }

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}

function ApprovalPending({ shopName, disabled }: { shopName: string; disabled: boolean }) {
  const nav = useNavigate();
  const { signOut } = useAuth();

  const logout = async () => {
    await signOut();
    nav({ to: "/login" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md overflow-hidden">
        <div className="bg-green-600 px-6 py-8 text-center text-white">
          <CheckCircle2 className="mx-auto h-12 w-12" />
          <h1 className="mt-4 text-2xl font-bold">{disabled ? "Account Disabled" : "Registration Successful!"}</h1>
          <p className="mt-3 text-sm text-white/90">Your purchase sales account has been created successfully.</p>
        </div>
        <div className="space-y-5 p-5">
          <div className="rounded-lg bg-muted p-4">
            <span className="text-sm text-muted-foreground">Shop: </span>
            <span className="font-semibold">{shopName}</span>
          </div>

          <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-center text-yellow-900">
            <Clock className="mx-auto h-5 w-5" />
            <h2 className="mt-2 font-semibold">{disabled ? "Access Disabled" : "Waiting for Admin Approval"}</h2>
            <p className="mt-2 text-sm">
              {disabled
                ? "Please contact the administrator to enable your account."
                : "Your account is currently pending approval from the administrator. You will be able to login once your account is approved."}
            </p>
            {!disabled && <p className="mt-3 flex items-center justify-center gap-2 text-xs"><Mail className="h-3 w-3" />You will receive confirmation after approval.</p>}
          </div>

          <div className="rounded-lg bg-blue-50 p-4 text-blue-950">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><Phone className="h-4 w-4" />For any queries, please contact admin:</p>
            <a className="block rounded-md bg-white px-3 py-2 text-sm font-medium text-blue-700" href="tel:+919284834754">+91 92848 34754</a>
            <a className="mt-2 block rounded-md bg-white px-3 py-2 text-sm font-medium text-blue-700" href="tel:+919823251105">+91 98232 51105</a>
          </div>

          <Button className="w-full" onClick={logout}><LogOut className="mr-2 h-4 w-4" />Go to Login Page</Button>
          <p className="text-center text-xs text-muted-foreground">You will be able to login after admin approval</p>
        </div>
      </Card>
    </div>
  );
}
