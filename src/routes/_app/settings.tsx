import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Trash2, Upload, Leaf } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useShop } from "@/hooks/useShop";
import { useState, useEffect } from "react";
import type { ChangeEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_app/settings")({ component: Settings });

function Settings() {
  const { data: shop } = useShop();
  const qc = useQueryClient();
  const s = (shop as any)?.shops;
  const [form, setForm] = useState({ name: "", owner_name: "", license: "", gst: "", phone: "", address: "", logo_url: "" });
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    if (s) setForm({ name: s.name || "", owner_name: s.owner_name || "", license: s.license || "", gst: s.gst || "", phone: s.phone || "", address: s.address || "", logo_url: s.logo_url || "" });
  }, [s]);

  async function save() {
    const { error } = await supabase.from("shops").update(form).eq("id", shop!.shop_id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["my-shop"] });
  }

  async function uploadLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !shop?.shop_id) return;
    if (!["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.type)) {
      return toast.error("Upload PNG, JPG or WEBP image");
    }
    if (file.size > 2 * 1024 * 1024) {
      return toast.error("Logo must be below 2MB");
    }

    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !uploadPreset || cloudName === "your_cloud_name" || uploadPreset === "your_unsigned_upload_preset") {
      return toast.error("Add real Cloudinary cloud name and unsigned upload preset in environment");
    }

    setUploadingLogo(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("upload_preset", uploadPreset);
      body.append("folder", `purchase-sales/shop-logos/${shop.shop_id}`);

      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST",
        body,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error?.message || "Logo upload failed");

      const logoUrl = result.secure_url as string;
      const { error } = await supabase.from("shops").update({ logo_url: logoUrl }).eq("id", shop.shop_id);
      if (error) throw error;

      setForm((current) => ({ ...current, logo_url: logoUrl }));
      toast.success("Logo uploaded");
      qc.invalidateQueries({ queryKey: ["my-shop"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Logo upload failed");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function removeLogo() {
    if (!shop?.shop_id) return;
    const { error } = await supabase.from("shops").update({ logo_url: null }).eq("id", shop.shop_id);
    if (error) return toast.error(error.message);
    setForm((current) => ({ ...current, logo_url: "" }));
    toast.success("Logo removed");
    qc.invalidateQueries({ queryKey: ["my-shop"] });
  }

  return (
    <div>
      <PageHeader title="Settings" description="Shop profile and configuration" />
      <Card className="p-6 max-w-3xl">
        <div className="flex items-center gap-4 mb-6 pb-6 border-b">
          <div className="h-20 w-20 overflow-hidden rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            {form.logo_url ? <img src={form.logo_url} alt="Shop logo" className="h-full w-full object-cover" /> : <Leaf className="h-10 w-10" />}
          </div>
          <div>
            <h3 className="font-semibold">Shop Logo</h3>
            <p className="text-sm text-muted-foreground mb-2">PNG or JPG, max 2MB</p>
            <input id="shop-logo-upload" type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={uploadLogo} />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={uploadingLogo} asChild>
                <label htmlFor="shop-logo-upload" className="cursor-pointer">
                  <Upload className="h-4 w-4 mr-2" />{uploadingLogo ? "Uploading..." : "Upload"}
                </label>
              </Button>
              {form.logo_url && (
                <Button size="sm" variant="outline" onClick={removeLogo}>
                  <Trash2 className="h-4 w-4 mr-2" />Remove
                </Button>
              )}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Shop Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="space-y-2"><Label>Owner</Label><Input value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} /></div>
          <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={10} /></div>
          <div className="space-y-2"><Label>License</Label><Input value={form.license} onChange={(e) => setForm({ ...form, license: e.target.value })} /></div>
          <div className="space-y-2"><Label>GST</Label><Input value={form.gst} onChange={(e) => setForm({ ...form, gst: e.target.value })} /></div>
          <div className="space-y-2 md:col-span-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        </div>
        <div className="mt-6 flex gap-2"><Button onClick={save}>Save Changes</Button></div>
      </Card>
    </div>
  );
}
