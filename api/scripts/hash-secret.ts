import { hash } from "argon2";

const secret = Deno.args[0];

if (!secret) {
  console.error(
    "Usage: deno run --allow-env --allow-read --allow-ffi hash-secret.ts <secret>",
  );
  Deno.exit(1);
}

const hashed = await hash(secret);
console.log(hashed);
