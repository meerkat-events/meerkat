import { generateQRCodePNG } from "../code.ts";

const baseUrl = "https://app.meerkat.events";
const stages = Deno.args[0];

if (!stages) {
  console.error("Usage: deno run generate-qr.ts <stage1,stage2,...>");
  Deno.exit(1);
}

const stageList = stages.split(",");

for (const stage of stageList) {
  const url = `${baseUrl}/stage/${stage.trim()}/qa`;
  const qrCode = await generateQRCodePNG(url, 512);

  const filename = `${stage.trim()}-512.png`;
  await Deno.writeFile(filename, qrCode);

  console.log(`Generated ${filename} for ${url}`);
}
