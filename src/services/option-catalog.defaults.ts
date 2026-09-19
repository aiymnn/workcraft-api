import type { OptionListKey } from "../db/schema/option_lists.js";
import { optionListKeys } from "../db/schema/option_lists.js";

/** Built-in labels for catalogs that start locked until “Make editable”. */
export const OPTION_BUILT_IN_LABELS: Partial<Record<OptionListKey, string[]>> = {
  EXPENSE_CAT: [
    "DELIVERABLES & JOB MATERIALS",
    "FREELANCERS & SUBCONTRACTORS",
    "EQUIPMENT PURCHASE",
    "TRAVEL & TRANSPORT",
    "MEALS & LODGING (OUTSTATION)",
    "STAFF PAY, EPF & SOCSO",
    "SOFTWARE & SUBSCRIPTIONS",
    "OWNER DRAWINGS",
    "PERSONAL & NON-DEDUCTIBLE",
    "OTHER",
  ],
  INCOME_CAT: ["EQUIPMENT SALE", "FREELANCE & SIDE JOBS", "INTEREST & OTHER"],
  CANCEL_REASON: [
    "Postponed — new date unknown",
    "Changed to another vendor",
    "Booking called off",
    "Budget constraints",
    "Other",
  ],
  CREW_ROLE: [
    "PHOTOGRAPHER",
    "LEAD PHOTOGRAPHER",
    "VIDEOGRAPHER",
    "LEAD VIDEOGRAPHER",
    "ASSISTANT",
    "DRONE PILOT",
    "EDITOR",
    "EMCEE",
  ],
  CRAFT: [
    "Photographer",
    "Videographer",
    "Editor",
    "Emcee",
    "Marketer",
    "Drone Pilot",
    "Photo Assistant",
  ],
  EQUIP_LOCATION: ["Studio", "Store room"],
};

/** Default seed labels for catalogs that start editable. */
export const OPTION_DEFAULT_LABELS: Partial<Record<OptionListKey, string[]>> = {
  CEREMONY_TYPE: [
    "NIKAH",
    "MALAM BERINAI",
    "SANDING",
    "TANDANG",
    "DINNER RECEPTION",
    "ENGAGEMENT",
    "OUTDOOR SHOOT",
    "OTHER",
  ],
  JOB_TYPE: [
    "PHOTO NIKAH & SANDING",
    "VIDEO NIKAH & SANDING",
    "COMBO NIKAH & SANDING",
    "PHOTO NIKAH",
    "VIDEO NIKAH",
    "COMBO NIKAH",
    "PHOTO SANDING/TANDANG",
    "EVENT",
  ],
  LEAD_SOURCE: [
    "Instagram",
    "TikTok",
    "Facebook",
    "Referral",
    "Walk-in",
    "WhatsApp",
    "Other",
  ],
  PAY_METHOD: ["BANK TRANSFER"],
  BANK: ["Maybank"],
};

export function isOptionListKey(value: string): value is OptionListKey {
  return (optionListKeys as readonly string[]).includes(value);
}

export function catalogStartsBuiltIn(key: OptionListKey): boolean {
  return Boolean(OPTION_BUILT_IN_LABELS[key]);
}
