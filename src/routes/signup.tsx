import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Clock, Eye, EyeOff, Leaf, Mail, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AppCopyright } from "@/components/AppCopyright";

export const Route = createFileRoute("/signup")({ component: Signup });

function Signup() {
  const nav = useNavigate();
  const [form, setForm] = useState({ shop: "", owner: "", phone: "", email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [registeredShop, setRegisteredShop] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: window.location.origin + "/dashboard",
        data: { shop_name: form.shop, full_name: form.owner, phone: form.phone },
      },
    });
    await supabase.auth.signOut();
    setLoading(false);
    if (error) return toast.error(error.message);
    setRegisteredShop(form.shop);
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  if (registeredShop) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-muted/40 p-4">
        <AppCopyright variant="contact" className="w-full max-w-md" />
        <Card className="w-full max-w-md overflow-hidden">
          <div className="bg-green-600 px-6 py-8 text-center text-white">
            <CheckCircle2 className="mx-auto h-12 w-12" />
            <h1 className="mt-4 text-2xl font-bold">Registration Successful!</h1>
            <p className="mt-3 text-sm text-white/90">Thank you for registering with Purchase Sales Management System</p>
          </div>
          <div className="space-y-5 p-5">
            <p className="text-center text-sm text-muted-foreground">Your account has been created successfully.</p>
            <div className="rounded-lg bg-muted p-4">
              <span className="text-sm text-muted-foreground">Shop: </span>
              <span className="font-semibold">{registeredShop}</span>
            </div>
            <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-center text-yellow-900">
              <Clock className="mx-auto h-5 w-5" />
              <h2 className="mt-2 font-semibold">Waiting for Admin Approval</h2>
              <p className="mt-2 text-sm">Your account is currently pending approval from the administrator. You will be able to login once your account is approved.</p>
              <p className="mt-3 flex items-center justify-center gap-2 text-xs"><Mail className="h-3 w-3" />You will receive confirmation after approval.</p>
            </div>
            <div className="rounded-lg bg-blue-50 p-4 text-blue-950">
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><Phone className="h-4 w-4" />For any queries, please contact admin:</p>
              <a className="block rounded-md bg-white px-3 py-2 text-sm font-medium text-blue-700" href="tel:+919284834754">+91 92848 34754</a>
              <a className="mt-2 block rounded-md bg-white px-3 py-2 text-sm font-medium text-blue-700" href="tel:+919823251105">+91 98232 51105</a>
            </div>
            <Button className="w-full" onClick={() => nav({ to: "/login" })}>Go to Login Page</Button>
            <p className="text-center text-xs text-muted-foreground">You will be able to login after admin approval</p>
          </div>
        </Card>
        <AppCopyright variant="copyright" className="w-full max-w-md" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6 bg-muted/40">
      <AppCopyright variant="contact" className="w-full max-w-md" />
      <Card className="w-full max-w-md p-5 sm:p-8">
        <div className="flex items-center gap-2 mb-6">
          <div className="h-10 w-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
            <Leaf className="h-5 w-5" />
          </div>
          <span className="font-semibold text-lg">PharmaAgro</span>
        </div>
        <h1 className="text-2xl font-bold">Create your shop</h1>
        <p className="text-sm text-muted-foreground mt-1">Your shop will start after admin approval</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-2"><Label>Shop Name</Label><Input required value={form.shop} onChange={set("shop")} /></div>
          <div className="space-y-2"><Label>Owner Name</Label><Input required value={form.owner} onChange={set("owner")} /></div>
          <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={set("phone")} /></div>
          <div className="space-y-2"><Label>Email</Label><Input type="email" required value={form.email} onChange={set("email")} /></div>
          <div className="space-y-2">
            <Label>Password</Label>
            <div className="relative">
              <Input type={showPassword ? "text" : "password"} required minLength={6} value={form.password} onChange={set("password")} className="pr-10" />
              <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2" onClick={() => setShowPassword((value) => !value)}>
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                <span className="sr-only">{showPassword ? "Hide password" : "Show password"}</span>
              </Button>
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full">{loading ? "Creating..." : "Create Shop"}</Button>
        </form>
        <p className="text-sm text-center mt-6 text-muted-foreground">
          Already have a shop? <Link to="/login" className="text-primary font-medium">Sign in</Link>
        </p>
      </Card>
      <AppCopyright variant="copyright" className="w-full max-w-md" />
    </div>
  );
}
