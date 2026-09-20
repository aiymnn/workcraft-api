/**
 * Studio email / WhatsApp templates use single-brace placeholders such as
 * `{link}`, `{quote_number}`, `{invoice_number}`, `{studio}`, `{client}`,
 * `{amount}`. Only keys present in the value map are substituted — an unknown
 * placeholder is left untouched so a typo in Settings stays visible.
 */
export type TemplateValues = Record<string, string | number | null | undefined>;

const PLACEHOLDER = /\{([a-zA-Z0-9_]+)\}/g;

export function renderTemplate(
  template: string,
  values: TemplateValues,
): string {
  return template.replace(PLACEHOLDER, (match, key: string) => {
    if (!Object.prototype.hasOwnProperty.call(values, key)) return match;
    const value = values[key];
    if (value === null || value === undefined) return "";
    return String(value);
  });
}

/** `{name}` is the WhatsApp default templates' word for the client. */
export function clientValues(client: {
  name: string;
  email?: string | null;
  phone?: string | null;
}): TemplateValues {
  return {
    client: client.name,
    name: client.name,
    client_email: client.email ?? "",
    client_phone: client.phone ?? "",
  };
}

export function studioValues(studio: {
  name: string;
  email?: string | null;
  phone?: string | null;
}): TemplateValues {
  return {
    studio: studio.name,
    studio_email: studio.email ?? "",
    studio_phone: studio.phone ?? "",
  };
}

export function formatMoney(amount: string | number, currency: string) {
  const value = typeof amount === "number" ? amount : Number(amount);
  const safe = Number.isFinite(value) ? value : 0;
  return `${currency} ${safe.toFixed(2)}`;
}

export function formatDueDate(date: Date | string | null | undefined) {
  if (!date) return "";
  const parsed = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

/**
 * wa.me needs a bare international number. Malaysian numbers are usually
 * stored as `01x-xxx xxxx`, so a leading 0 becomes the 60 country code.
 */
export function whatsappUrl(
  phone: string | null | undefined,
  text: string,
): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `60${digits.slice(1)}`;
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
