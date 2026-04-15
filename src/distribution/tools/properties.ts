// Static Seascape property metadata for distribution tools (v1 hardcoded).

export interface SeascapeProperty {
  name: string;
  slug: string;
  petFriendly: boolean;
  petFee: number | null;
  hasPool: boolean;
  poolHeated: boolean;
}

export const SEASCAPE_PROPERTIES: Record<number, SeascapeProperty> = {
  206016: { name: "Palma Sola Paradise", slug: "palma-sola-paradise", petFriendly: false, petFee: null, hasPool: true, poolHeated: true },
  135880: { name: "Bradenton Beach Bungalow", slug: "bradenton-beach-bungalow", petFriendly: true, petFee: 150, hasPool: false, poolHeated: false },
  135881: { name: "Bradenton Beach Retreat", slug: "bradenton-beach-retreat", petFriendly: true, petFee: 150, hasPool: false, poolHeated: false },
  189511: { name: "Bradenton Beach Escape", slug: "bradenton-beach-escape", petFriendly: false, petFee: null, hasPool: false, poolHeated: false },
  487798: { name: "Sandy Toes Retreat", slug: "sandy-toes-retreat", petFriendly: false, petFee: null, hasPool: true, poolHeated: false },
};

export const SEASCAPE_LISTING_IDS = Object.keys(SEASCAPE_PROPERTIES).map(Number);

export function getPropertyNames(): string[] {
  return Object.values(SEASCAPE_PROPERTIES).map((p) => p.name);
}
