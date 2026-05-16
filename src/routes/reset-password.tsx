import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Eye, EyeOff, Leaf } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({ component: ResetPassword });

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    if (password !== confirmPassword) return toast.error("Passwords do not match");

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) return toast.error(error.message);
    toast.success("Password updated. Please sign in again.");
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-5 sm:p-8">
        <div className="flex items-center gap-2 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Leaf className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Set New Password</h1>
            <p className="text-sm text-muted-foreground">Create a new password for your account</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>New Password</Label>
            <div className="relative">
              <Input type={showPassword ? "text" : "password"} required value={password} onChange={(event) => setPassword(event.target.value)} className="pr-10" />
              <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2" onClick={() => setShowPassword((value) => !value)}>
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                <span className="sr-only">{showPassword ? "Hide password" : "Show password"}</span>
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Confirm Password</Label>
            <Input type={showPassword ? "text" : "password"} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
          </div>
          <Button type="submit" disabled={loading} className="w-full">{loading ? "Updating..." : "Update Password"}</Button>
        </form>

        <p className="text-sm text-center mt-6 text-muted-foreground">
          Remember password? <Link to="/login" className="text-primary font-medium">Sign in</Link>
        </p>
      </Card>
    </div>
  );
}
