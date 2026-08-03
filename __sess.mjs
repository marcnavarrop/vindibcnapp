import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
for (const l of fs.readFileSync(".env.local","utf8").split("\n")) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].trim();
}
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}});
const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: process.argv[2] });
if (error) throw new Error(error.message);
console.log(`https://vindibcnapp.vercel.app/auth/callback?token_hash=${data.properties.hashed_token}&type=email&next=${encodeURIComponent(process.argv[3] ?? "/admin")}`);
