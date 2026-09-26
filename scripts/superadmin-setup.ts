// Generates platform superadmin credentials for the environment file.
//
//   npm run superadmin:setup -- admin@example.in              print the values to paste into the env file
//   npm run superadmin:setup -- admin@example.in --write .env  replace the SUPERADMIN_* lines in that file
//
// The password is read from SUPERADMIN_PASSWORD or prompted for without echo. Only an Argon2id hash is
// stored. Every run creates a new TOTP secret, so re-scan the QR code in your authenticator app.
import { chmod, readFile, stat, writeFile } from "node:fs/promises";
import argon2 from "argon2";
import { authenticator } from "otplib";
import QRCode from "qrcode";

function promptHidden(question: string) {
  const stdin = process.stdin;
  if (!stdin.isTTY) throw new Error("Set SUPERADMIN_PASSWORD or run this in an interactive terminal.");
  process.stdout.write(question);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  return new Promise<string>((resolve, reject) => {
    let value = "";
    const finish = (error?: Error) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off("data", onData);
      process.stdout.write("\n");
      if (error) reject(error); else resolve(value);
    };
    const onData = (chunk: string) => {
      for (const character of chunk) {
        if (character === "\r" || character === "\n") return finish();
        if (character === "\u0003") return finish(new Error("Cancelled."));
        if (character === "\u007f" || character === "\b") value = value.slice(0, -1);
        else value += character;
      }
    };
    stdin.on("data", onData);
  });
}

async function main() {
  const args = process.argv.slice(2);
  const writeIndex = args.indexOf("--write");
  const target = writeIndex >= 0 ? args[writeIndex + 1] : undefined;
  if (writeIndex >= 0 && !target) throw new Error("--write needs a file path, e.g. --write .env");
  const email = (args.find((arg, index) => !arg.startsWith("--") && index !== writeIndex + 1) ?? process.env.SUPERADMIN_EMAIL ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Pass the superadmin email: npm run superadmin:setup -- admin@example.in");

  let password = process.env.SUPERADMIN_PASSWORD ?? "";
  if (!password) {
    password = await promptHidden("Superadmin password (16+ characters): ");
    if (password !== (await promptHidden("Repeat password: "))) throw new Error("The passwords do not match.");
  }
  if (password.length < 16) throw new Error("Use at least 16 characters.");

  const hash = await argon2.hash(password, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 });
  const secret = authenticator.generateSecret(20);
  const values = {
    SUPERADMIN_EMAIL: email,
    SUPERADMIN_PASSWORD_HASH: Buffer.from(hash, "utf8").toString("base64url"),
    SUPERADMIN_TOTP_SECRET: secret,
  };
  const uri = authenticator.keyuri(email, "NyayaFlow Platform", secret);

  if (target) {
    let existing = "";
    let mode = 0o600;
    try {
      existing = await readFile(target, "utf8");
      mode = (await stat(target)).mode & 0o777;
    } catch {
      // New file.
    }
    const kept = existing.split("\n").filter((line) => !/^SUPERADMIN_(EMAIL|PASSWORD_HASH|TOTP_SECRET)=/.test(line) && line !== "# Platform superadmin (npm run superadmin:setup)");
    while (kept.length && kept[kept.length - 1] === "") kept.pop();
    const block = ["", "# Platform superadmin (npm run superadmin:setup)", ...Object.entries(values).map(([key, value]) => `${key}=${value}`), ""];
    await writeFile(target, [...kept, ...block].join("\n"), { mode });
    await chmod(target, mode);
    process.stdout.write(`Updated SUPERADMIN_* in ${target}. Restart the web server to load them.\n`);
  } else {
    process.stdout.write("\nAdd these lines to the server environment file (.env locally, /etc/nyayaflow/nyayaflow.env on the VPS):\n\n");
    for (const [key, value] of Object.entries(values)) process.stdout.write(`${key}=${value}\n`);
  }

  process.stdout.write("\nScan this QR code with your authenticator app (it is also the only copy of the TOTP secret you need):\n\n");
  process.stdout.write(await QRCode.toString(uri, { type: "terminal", small: true }));
  process.stdout.write(`\nOr enter this key manually: ${secret}\nThen sign in at /platform/sign-in.\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
