export async function openSmsMessage(phone: string | null | undefined, message: string) {
  const normalized = normalizePhone(phone);
  if (!normalized) return false;
  if (await sendNativeSms(normalized, message)) return true;
  window.open(`sms:${normalized}?body=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  return true;
}

async function sendNativeSms(phone: string, message: string) {
  if (typeof window === "undefined") return false;

  try {
    const { SMS } = await import("@awesome-cordova-plugins/sms");
    await SMS.send(phone, message, {
      replaceLineBreaks: true,
      android: { intent: "" },
    });
    return true;
  } catch (error) {
    console.warn("[SMS] Native send failed, falling back to SMS composer", error);
    return false;
  }
}

function normalizePhone(phone: string | null | undefined) {
  const digits = phone?.replace(/\D/g, "") ?? "";
  if (!digits) return "";
  if (digits.length === 10) return `91${digits}`;
  return digits;
}
