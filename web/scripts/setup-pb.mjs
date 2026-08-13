import PocketBase from "pocketbase";
import { PB_URL, getAdminCreds } from "./creds.mjs";

const pb = new PocketBase(PB_URL);
const { email, password } = getAdminCreds();

try {
  await pb.collection("_superusers").create({
    email,
    password,
    passwordConfirm: password,
  });
  console.log("Superuser created successfully!");
} catch (err) {
  if (err.status === 403) {
    console.log("Superuser may already exist. Trying to authenticate...");
    try {
      await pb.collection("_superusers").authWithPassword(email, password);
      console.log("Authenticated successfully!");
    } catch (authErr) {
      console.error("Auth failed:", authErr.message);
    }
  } else {
    console.error("Error:", err.message, JSON.stringify(err.data));
  }
}
