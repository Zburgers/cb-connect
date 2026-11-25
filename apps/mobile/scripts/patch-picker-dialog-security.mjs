import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = process.argv[2] ?? resolve(dirname(fileURLToPath(import.meta.url)), "../node_modules/@react-native-community/datetimepicker");
const { version } = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8"));
if (version !== "9.1.0") throw new Error("Review the Android picker privacy patch before changing datetimepicker 9.1.0");

const files = [
  ["RNDatePickerDialogFragment.java", "566121bfa7855a67b3843823919617390b19ec0e6a4fc0a1089f1c9a6b442171", "32d2f77e0df94d46a2dc2c6e98a5b63c7af337eaca63791ed43562c88a50fa9a"],
  ["RNTimePickerDialogFragment.java", "4b549dbb1b07a5e1c6aa076381d888da18b9395dbea8dfb3705f3e40aa53fe44", "295560b64d1deb28b8526bc9b144005b36d4dfc46077df1411175293310fa9fc"],
];
const before = "    instance = createDialog(args);\n    return instance;";
const after = `    instance = createDialog(args);
    // CB Connect: child dialogs inherit the protected owner window.
    android.app.Activity activity = getActivity();
    if (activity != null
        && (activity.getWindow().getAttributes().flags
            & android.view.WindowManager.LayoutParams.FLAG_SECURE) != 0
        && instance.getWindow() != null) {
      instance.getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE);
    }
    return instance;`;
const hash = (value) => createHash("sha256").update(value).digest("hex");

// Validate both inputs before writing either file. A dependency upgrade or
// unexpected source edit must fail installation rather than skip protection.
const updates = files.map(([name, originalHash, protectedHash]) => {
  const path = resolve(packageRoot, "android/src/main/java/com/reactcommunity/rndatetimepicker", name);
  const source = readFileSync(path, "utf8");
  if (hash(source) === protectedHash) return null;
  if (hash(source) !== originalHash) throw new Error(`Unexpected Android picker source: ${name}`);
  const patched = source.replace(before, after);
  if (hash(patched) !== protectedHash) throw new Error(`Android picker patch did not match: ${name}`);
  return { path, patched };
}).filter(Boolean);

for (const { path, patched } of updates) writeFileSync(path, patched);
console.log(`Android picker secure-window inheritance verified (${updates.length} patched).`);
