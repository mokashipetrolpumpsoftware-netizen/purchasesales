import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, EyeOff, Leaf } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AppCopyright } from "@/components/AppCopyright";
export const Route = createFileRoute("/login")({ component: Login });
function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    nav({ to: email.trim().toLowerCase() === "admin@purchasesales.com" ? "/admin" : "/dashboard" });
  }
  async function onGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/dashboard" },
    });
    if (error) toast.error(error.message);
  }
  async function onForgotPassword() {
    const targetEmail = resetEmail.trim() || email.trim();
    if (!targetEmail) return toast.error("Enter your email first");
    setResetLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResetLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Password reset link sent to your email");
    setResetOpen(false);
  }
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
        <div className="flex items-center gap-2">
          <Leaf className="h-7 w-7" />
          <span className="font-semibold text-xl">PharmaAgro</span>
        </div>
        <div>
          <h2 className="text-4xl font-bold leading-tight">Manage your pharmacy & agro store with confidence.</h2>
          <p className="mt-4 text-primary-foreground/80 text-lg">Multi-tenant inventory, billing, expiry tracking and reports.</p>
        </div>
        <AppCopyright variant="copyright" className="text-primary-foreground/80" />
      </div>
      <div className="flex flex-col items-center justify-center gap-6 p-6">
        <AppCopyright variant="contact" className="w-full max-w-md lg:hidden" />
        <Card className="w-full max-w-md p-5 sm:p-8">
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to your shop dashboard</p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <div className="relative">
                <Input type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} className="pr-10" />
                <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2" onClick={() => setShowPassword((value) => !value)}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  <span className="sr-only">{showPassword ? "Hide password" : "Show password"}</span>
                </Button>
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="button" variant="link" className="h-auto p-0 text-sm" onClick={() => { setResetEmail(email); setResetOpen(true); }}>
                Forgot password?
              </Button>
            </div>
            <Button type="submit" disabled={loading} className="w-full">{loading ? "Signing in..." : "Sign In"}</Button>
          </form>
          <Button variant="outline" className="w-full mt-3" onClick={onGoogle}>Continue with Google</Button>
          <p className="text-sm text-center mt-6 text-muted-foreground">
            New shop? <Link to="/signup" className="text-primary font-medium">Create one</Link>
          </p>
        </Card>
        <AppCopyright variant="copyright" className="w-full max-w-md lg:hidden" />
      </div>
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset Password</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Enter your account email. We will send a password reset link.</p>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={resetEmail} onChange={(event) => setResetEmail(event.target.value)} placeholder="you@example.com" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>Cancel</Button>
            <Button onClick={onForgotPassword} disabled={resetLoading}>{resetLoading ? "Sending..." : "Send Reset Link"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
