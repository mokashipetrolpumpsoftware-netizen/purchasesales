export function openWhatsAppMessage(phone: string | null | undefined, message: string) {
  const normalized = normalizePhone(phone);
  if (!normalized) return false;
  window.open(`https://wa.me/${normalized}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  return true;
}

function normalizePhone(phone: string | null | undefined) {
  const digits = phone?.replace(/\D/g, "") ?? "";
  if (!digits) return "";
  if (digits.length === 10) return `91${digits}`;
  return digits;
}
