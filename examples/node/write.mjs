import { RiotClient, ValidationError } from "@valoranchi/riot-client";

const client = new RiotClient();

try {
  const cardUuid = "0819fbcd-4bd4-c379-5384-52803440f2b2";

  // 1. Dry run: validate locally without sending a mutation to Riot
  console.log("Validating card equip (dry run)...");
  const validatedBody = await client.account.validateEquip({ card: cardUuid });
  console.log("Validation passed. Prepared payload card ID:", validatedBody.Identity.PlayerCardID);

  // 2. Apply the mutation
  console.log("Applying card equip...");
  const updatedLoadout = await client.account.equip({ card: cardUuid });
  console.log("Card equipped successfully for:", updatedLoadout.player.gameName);
} catch (error) {
  if (error instanceof ValidationError) {
    console.error(`Validation failed [${error.code}]: reason=${error.reason}`);
    console.error("Message:", error.message);
    if (error.details) {
      console.error("Details:", error.details);
    }
  } else {
    console.error("Unexpected error:", error);
  }
} finally {
  await client.close();
}
