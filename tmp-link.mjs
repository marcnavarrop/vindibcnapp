import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")&&!l.startsWith("#")).map(l=>[l.slice(0,l.indexOf("=")).trim(), l.slice(l.indexOf("=")+1).trim()]));
const a = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{autoRefreshToken:false,persistSession:false} });
const email = process.argv[2];
const next = process.argv[3] || "/client";
const { data, error } = await a.auth.admin.generateLink({ type:"magiclink", email });
if (error) throw error;
console.log("https://vindibcnapp.vercel.app/auth/callback?token_hash=" + data.properties.hashed_token + "&type=email&next=" + next);
