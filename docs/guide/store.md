# Store

The `store` namespace retrieves current daily offers, featured bundles, accessory store listings, Night Market discounts, and processes confirmed purchases.

## Methods

### current

Fetches the complete storefront state including daily rotating skins, active featured bundles, accessory items, and Night Market cards.
Offers are resolved with metadata, item tiers, weapon names, and prices from the catalogue.

```ts
const store = await client.store.current({ language: "en-US" });
console.log(store.daily?.offers);
```

```bash
riotclient store --pretty
```

```json
{
  "player": {
    "puuid": "4a7b9c1d-1234-5678-9abc-def012345678",
    "gameName": "Player",
    "tagLine": "NA1",
    "region": "na",
    "shard": "na",
    "accountLevel": 128
  },
  "fetchedAt": "2026-09-27T12:00:00.000Z",
  "daily": {
    "endsAt": "2026-09-28T00:00:00.000Z",
    "offers": [
      {
        "offerId": "4324a482-47da-4521-b3b0-4dbfcfefd779",
        "item": {
          "kind": "skin",
          "uuid": "8908f237-47b2-031a-e905-1a89c93cc8f5",
          "name": "Prime Vandal",
          "weapon": "Vandal",
          "tier": {
            "uuid": "e046854e-406c-37f4-6607-19a9ba8426fc",
            "name": "Exclusive",
            "rank": 5,
            "icon": "https://media.valorant-api.com/contenttiers/exclusive.png"
          },
          "icon": "https://media.valorant-api.com/weaponskinlevels/7209796e-4f76-88c9-04fa-fb81498b5e9d/displayicon.png",
          "levelUuid": "7209796e-4f76-88c9-04fa-fb81498b5e9d"
        },
        "cost": {
          "currency": "Valorant Points",
          "currencyUuid": "85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741",
          "amount": 1775
        }
      }
    ]
  },
  "nightMarket": null,
  "bundles": {
    "endsAt": "2026-10-05T00:00:00.000Z",
    "items": []
  },
  "accessories": null,
  "radianite": []
}
```

### offers

Returns the catalog of all purchasable items and base price definitions known to the store.
Provides the full pricing index for weapons, skins, levels, buddies, and cards.

```ts
const offers = await client.store.offers();
console.log(offers.length);
```

```bash
riotclient offers
```

```json
[
  {
    "id": "4324a482-47da-4521-b3b0-4dbfcfefd779",
    "item": {
      "kind": "skin",
      "uuid": "8908f237-47b2-031a-e905-1a89c93cc8f5",
      "name": "Prime Vandal",
      "weapon": "Vandal",
      "tier": null,
      "icon": "https://media.valorant-api.com/weaponskinlevels/7209796e-4f76-88c9-04fa-fb81498b5e9d/displayicon.png",
      "levelUuid": "7209796e-4f76-88c9-04fa-fb81498b5e9d"
    },
    "cost": {
      "currency": "Valorant Points",
      "currencyUuid": "85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741",
      "amount": 1775
    },
    "startedAt": "2026-09-27T00:00:00.000Z"
  }
]
```

### revealNightMarket

Unveils cards in the active Night Market storefront to reveal discounted skin offers.
Validation verifies that Night Market is currently active and that cards remain unrevealed.

```ts
const store = await client.store.revealNightMarket();
console.log(store.nightMarket?.offers);
```

```bash
riotclient night-market-reveal --yes
```

```json
{
  "player": {
    "puuid": "4a7b9c1d-1234-5678-9abc-def012345678",
    "gameName": "Player",
    "tagLine": "NA1",
    "region": "na",
    "shard": "na",
    "accountLevel": 128
  },
  "fetchedAt": "2026-09-27T12:00:00.000Z",
  "nightMarket": {
    "endsAt": "2026-10-15T00:00:00.000Z",
    "offers": [
      {
        "offerId": "91234567-1234-5678-9abc-def012345678",
        "item": {
          "kind": "skin",
          "uuid": "8908f237-47b2-031a-e905-1a89c93cc8f5",
          "name": "Prime Vandal",
          "weapon": "Vandal",
          "tier": null,
          "icon": null,
          "levelUuid": "7209796e-4f76-88c9-04fa-fb81498b5e9d"
        },
        "cost": {
          "currency": "Valorant Points",
          "currencyUuid": "85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741",
          "amount": 1775
        },
        "discountedCost": {
          "currency": "Valorant Points",
          "currencyUuid": "85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741",
          "amount": 1242
        },
        "discountPercent": 30,
        "seen": true
      }
    ]
  },
  "daily": null,
  "bundles": null,
  "accessories": null,
  "radianite": []
}
```

### buy

Executes a purchase of a store offer or bundle using in-game currency.
Requires explicit dual confirmation (`{ confirm: true }` in code, or `--yes --confirm` in CLI).

```ts
const order = await client.store.buy(
  { offerId: "4324a482-47da-4521-b3b0-4dbfcfefd779" },
  { confirm: true }
);
```

```bash
riotclient buy --offer 4324a482-47da-4521-b3b0-4dbfcfefd779 --yes --confirm
```

```json
{
  "id": "order-uuid-1234",
  "status": "complete",
  "item": {
    "kind": "skin",
    "uuid": "8908f237-47b2-031a-e905-1a89c93cc8f5",
    "name": "Prime Vandal",
    "weapon": "Vandal",
    "tier": null,
    "icon": null,
    "levelUuid": "7209796e-4f76-88c9-04fa-fb81498b5e9d"
  },
  "cost": {
    "currency": "Valorant Points",
    "currencyUuid": "85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741",
    "amount": 1775
  }
}
```

### order

Retrieves historical order status and purchase details using an order ID.
Returns receipt data confirming item delivery and currency spent.

```ts
const order = await client.store.order("order-uuid-1234");
console.log(order.status);
```

```bash
riotclient order order-uuid-1234
```

```json
{
  "id": "order-uuid-1234",
  "status": "complete",
  "item": null,
  "cost": null
}
```
