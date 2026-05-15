import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Leaf } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({ component: Signup });

function Signup() {
  const nav = useNavigate();
  const [form, setForm] = useState({ shop: "", owner: "", phone: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);

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
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Shop created!");
    nav({ to: "/dashboard" });
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-muted/40">
      <Card className="w-full max-w-md p-8">
        <div className="flex items-center gap-2 mb-6">
          <div className="h-10 w-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
            <Leaf className="h-5 w-5" />
          </div>
          <span className="font-semibold text-lg">PharmaAgro</span>
        </div>
        <h1 className="text-2xl font-bold">Create your shop</h1>
        <p className="text-sm text-muted-foreground mt-1">Set up your tenant in under a minute</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-2"><Label>Shop Name</Label><Input required value={form.shop} onChange={set("shop")} /></div>
          <div className="space-y-2"><Label>Owner Name</Label><Input required value={form.owner} onChange={set("owner")} /></div>
          <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={set("phone")} /></div>
          <div className="space-y-2"><Label>Email</Label><Input type="email" required value={form.email} onChange={set("email")} /></div>
          <div className="space-y-2"><Label>Password</Label><Input type="password" required minLength={6} value={form.password} onChange={set("password")} /></div>
          <Button type="submit" disabled={loading} className="w-full">{loading ? "Creating..." : "Create Shop"}</Button>
        </form>
        <p className="text-sm text-center mt-6 text-muted-foreground">
          Already have a shop? <Link to="/login" className="text-primary font-medium">Sign in</Link>
        </p>
      </Card>
    </div>
  );
}
