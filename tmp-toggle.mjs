import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")&&!l.startsWith("#")).map(l=>[l.slice(0,l.indexOf("=")).trim(), l.slice(l.indexOf("=")+1).trim()]));
const a = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const val = process.argv[2];
if (val) await a.from("center_settings").update({ gift_vouchers_enabled: val === "on" }).not("id","is",null);
const { data } = await a.from("center_settings").select("gift_vouchers_enabled");
console.log("gift_vouchers_enabled =", data?.[0]?.gift_vouchers_enabled);
