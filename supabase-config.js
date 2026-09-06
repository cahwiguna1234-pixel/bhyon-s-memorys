/* ============================================================
   bhyon's memorys — Supabase connection
   Fill these two values in from your Supabase project:
   Project Settings → API → Project URL / anon public key
   ============================================================ */

const SUPABASE_URL = "https://ypzvceznwqggekvkznea.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwenZjZXpud3FnZ2Vrdmt6bmVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3MDMzNjAsImV4cCI6MjEwNDI3OTM2MH0.5bYJQ-fctRusWtDP_esCCtIJ4D4UpScvCdtdPMk9w6w";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
