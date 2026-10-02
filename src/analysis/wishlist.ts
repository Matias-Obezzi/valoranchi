import fs from "node:fs";
import path from "node:path";
import type { Store, Wishlist, WishlistHit } from "../model/index.js";

function collectDailyHits(store: Store, wanted: Set<string>, hits: WishlistHit[]): void {
  if (!store.daily) return;
  for (const offer of store.daily.offers) {
    if (offer.item.kind === "skin" && wanted.has(offer.item.uuid.toLowerCase())) {
      hits.push({
        skin: {
          uuid: offer.item.uuid,
          name: offer.item.name,
          weapon: offer.item.weapon,
          icon: offer.item.icon,
        },
        where: "daily",
        price: offer.cost.amount,
        discountedPrice: null,
        bundleName: null,
        endsAt: store.daily.endsAt,
      });
    }
  }
}

function collectNightMarketHits(store: Store, wanted: Set<string>, hits: WishlistHit[]): void {
  if (!store.nightMarket) return;
  for (const offer of store.nightMarket.offers) {
    if (offer.item.kind === "skin" && wanted.has(offer.item.uuid.toLowerCase())) {
      hits.push({
        skin: {
          uuid: offer.item.uuid,
          name: offer.item.name,
          weapon: offer.item.weapon,
          icon: offer.item.icon,
        },
        where: "night-market",
        price: offer.cost.amount,
        discountedPrice: offer.discountedCost.amount,
        bundleName: null,
        endsAt: store.nightMarket.endsAt,
      });
    }
  }
}

function collectBundleHits(store: Store, wanted: Set<string>, hits: WishlistHit[]): void {
  if (!store.bundles) return;
  for (const bundle of store.bundles.items) {
    for (const bundleItem of bundle.items) {
      if (bundleItem.item.kind === "skin" && wanted.has(bundleItem.item.uuid.toLowerCase())) {
        const discounted =
          bundleItem.discountedPrice < bundleItem.basePrice ? bundleItem.discountedPrice : null;
        hits.push({
          skin: {
            uuid: bundleItem.item.uuid,
            name: bundleItem.item.name,
            weapon: bundleItem.item.weapon,
            icon: bundleItem.item.icon,
          },
          where: "bundle",
          price: bundleItem.basePrice,
          discountedPrice: discounted,
          bundleName: bundle.name,
          endsAt: bundle.endsAt ?? store.bundles.endsAt,
        });
      }
    }
  }
}

export function wishlistHits(store: Store, wishlist: Wishlist): WishlistHit[] {
  const wanted = new Set(wishlist.skins.map((s) => s.uuid.toLowerCase()));
  if (wanted.size === 0) {
    return [];
  }

  const hits: WishlistHit[] = [];
  collectDailyHits(store, wanted, hits);
  collectNightMarketHits(store, wanted, hits);
  collectBundleHits(store, wanted, hits);
  return hits;
}

export function loadWishlist(cacheDir: string, puuid: string): Wishlist {
  const filePath = path.join(cacheDir, "wishlist", `${puuid}.json`);
  try {
    if (fs.existsSync(filePath)) {
      const raw = JSON.parse(fs.readFileSync(filePath, "utf-8")) as unknown;
      if (
        raw &&
        typeof raw === "object" &&
        "skins" in raw &&
        Array.isArray((raw as Wishlist).skins)
      ) {
        const skins = (raw as Wishlist).skins
          .filter((s) => s && typeof s.uuid === "string" && typeof s.name === "string")
          .map((s) => ({
            uuid: s.uuid,
            name: s.name,
            addedAt: typeof s.addedAt === "string" ? s.addedAt : new Date().toISOString(),
          }));
        return { skins };
      }
    }
  } catch {}
  return { skins: [] };
}

export function saveWishlist(cacheDir: string, puuid: string, wishlist: Wishlist): void {
  const dir = path.join(cacheDir, "wishlist");
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${puuid}.json`);
  const tempPath = path.join(dir, `${puuid}.${Date.now()}.tmp`);
  const content = JSON.stringify(wishlist, null, 2);

  try {
    fs.writeFileSync(tempPath, content, "utf-8");
    fs.renameSync(tempPath, filePath);
  } catch {
    fs.writeFileSync(filePath, content, "utf-8");
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch {}
  }
}
