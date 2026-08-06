const SUPABASE_JS_CDN = "https://esm.sh/@supabase/supabase-js@2.112.1";
let supabaseModulePromise = null;

const SUPABASE_URL_META = "grid-atlas-supabase-url";
const SUPABASE_KEY_META = "grid-atlas-supabase-publishable-key";

export function cloudAuthConfig() {
  if (typeof document === "undefined") return { url: "", publishableKey: "" };
  return {
    url: document.querySelector(`meta[name="${SUPABASE_URL_META}"]`)?.content.trim() || "",
    publishableKey: document.querySelector(`meta[name="${SUPABASE_KEY_META}"]`)?.content.trim() || ""
  };
}

export async function createCloudAuthClient() {
  const config = cloudAuthConfig();
  if (!config.url || !config.publishableKey) return null;
  supabaseModulePromise ||= import(SUPABASE_JS_CDN);
  const { createClient } = await supabaseModulePromise;
  return createClient(config.url, config.publishableKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true
    }
  });
}
