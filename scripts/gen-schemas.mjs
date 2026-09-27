import fs from "node:fs";
import path from "node:path";
import { createGenerator } from "ts-json-schema-generator";

const types = ["OwnedItems", "Loadout", "Wallet", "Player"];
const schemaDir = path.resolve("schema");

if (!fs.existsSync(schemaDir)) {
  fs.mkdirSync(schemaDir, { recursive: true });
}

for (const type of types) {
  const config = {
    path: "src/model/index.ts",
    tsconfig: "tsconfig.json",
    type,
    expose: "all",
    topRef: true,
    jsDoc: "none",
  };

  const schema = createGenerator(config).createSchema(type);
  const json = JSON.stringify(schema, null, 2);
  const outFile = path.join(schemaDir, `${type}.json`);
  fs.writeFileSync(outFile, `${json}\n`, "utf-8");
  console.log(`Generated ${outFile}`);
}
