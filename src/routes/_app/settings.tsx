import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Upload, Leaf } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useShop } from "@/hooks/useShop";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_app/settings")({ component: Settings });

function Settings() {
  const { data: shop } = useShop();
  const qc = useQueryClient();
  const s = (shop as any)?.shops;
  const [form, setForm] = useState({ name: "", owner_name: "", license: "", gst: "", phone: "", address: "" });

  useEffect(() => {
    if (s) setForm({ name: s.name || "", owner_name: s.owner_name || "", license: s.license || "", gst: s.gst || "", phone: s.phone || "", address: s.address || "" });
  }, [s]);

  async function save() {
    const { error } = await supabase.from("shops").update(form).eq("id", shop!.shop_id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["my-shop"] });
  }

  return (
    <div>
      <PageHeader title="Settings" description="Shop profile and configuration" />
      <Card className="p-6 max-w-3xl">
        <div className="flex items-center gap-4 mb-6 pb-6 border-b">
          <div className="h-20 w-20 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Leaf className="h-10 w-10" /></div>
          <div>
            <h3 className="font-semibold">Shop Logo</h3>
            <p className="text-sm text-muted-foreground mb-2">PNG or JPG, max 2MB</p>
            <Button size="sm" variant="outline"><Upload className="h-4 w-4 mr-2" />Upload</Button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Shop Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="space-y-2"><Label>Owner</Label><Input value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} /></div>
          <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="space-y-2"><Label>License</Label><Input value={form.license} onChange={(e) => setForm({ ...form, license: e.target.value })} /></div>
          <div className="space-y-2"><Label>GST</Label><Input value={form.gst} onChange={(e) => setForm({ ...form, gst: e.target.value })} /></div>
          <div className="space-y-2 md:col-span-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        </div>
        <div className="mt-6 flex gap-2"><Button onClick={save}>Save Changes</Button></div>
      </Card>
    </div>
  );
}
