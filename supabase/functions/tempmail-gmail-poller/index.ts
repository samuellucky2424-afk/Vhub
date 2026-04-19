import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const GMAIL_CLIENT_ID = Deno.env.get("GMAIL_CLIENT_ID")!;
const GMAIL_CLIENT_SECRET = Deno.env.get("GMAIL_CLIENT_SECRET")!;
const GMAIL_REFRESH_TOKEN = Deno.env.get("GMAIL_REFRESH_TOKEN")!;
const GMAIL_USER_EMAIL = Deno.env.get("GMAIL_USER_EMAIL")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── Gmail OAuth ───
async function getGmailAccessToken(): Promise<string> {
  console.log("[POLLER] Refreshing Gmail access token...");
  const params = new URLSearchParams();
  params.set("client_id", GMAIL_CLIENT_ID);
  params.set("client_secret", GMAIL_CLIENT_SECRET);
  params.set("refresh_token", GMAIL_REFRESH_TOKEN);
  params.set("grant_type", "refresh_token");

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error_description || data?.error || "Token refresh failed");
  if (!data.access_token) throw new Error("No access_token in response");
  console.log("[POLLER] Gmail token refreshed OK");
  return data.access_token as string;
}

// ─── Gmail API helpers ───
async function gmailFetch(accessToken: string, path: string) {
  const url = `https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(GMAIL_USER_EMAIL)}/${path}`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error?.message || "Gmail API error");
  return data;
}

function decodeBase64Url(data: string): string {
  const b64 = data.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4;
  const padded = pad ? b64 + "=".repeat(4 - pad) : b64;
  const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function parseHeader(headers: Array<{ name: string; value: string }>, key: string): string | null {
  const h = headers.find((x) => x.name?.toLowerCase() === key.toLowerCase());
  return h?.value || null;
}

function extractAllRecipientEmails(headers: Array<{ name: string; value: string }>): string[] {
  const candidates: string[] = [];
  // Check all headers that could contain the original recipient
  // IMPORTANT: "To" header has the original lumox.sbs address even when forwarded
  // "Delivered-To" shows swiftsendsuport@gmail.com for forwarded mail — less useful
  for (const headerName of ["To", "X-Original-To", "X-Forwarded-To", "Cc", "Delivered-To", "Envelope-To"]) {
    const raw = parseHeader(headers, headerName);
    if (!raw) continue;
    // Extract ALL email addresses from this header
    const matches = raw.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
    if (matches) {
      for (const m of matches) {
        const normalized = m.trim().toLowerCase();
        if (!candidates.includes(normalized)) {
          candidates.push(normalized);
        }
      }
    }
  }
  return candidates;
}

function extractSenderEmail(headers: Array<{ name: string; value: string }>): string {
  const from = parseHeader(headers, "From") || "";
  const match = from.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0].trim().toLowerCase() : from;
}

function extractBody(payload: any): string {
  if (!payload) return "";

  let fullBody = "";

  // 1. If this part has data, decode it
  if (payload.body && payload.body.data) {
    try {
      fullBody += decodeBase64Url(payload.body.data) + "\n";
    } catch {
      // ignore
    }
  }

  // 2. Recursively process child parts
  if (payload.parts && Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      fullBody += extractBody(part) + "\n";
    }
  }

  return fullBody.trim();
}

function extractLink(text: string): string | null {
  // Matches typical verification links containing tokens or codes
  const match = text.match(/https?:\/\/[^\s"'<>\\]+/);
  return match ? match[0] : null;
}

function extractOtp(text: string): string | null {
  const patterns = [/\b\d{6}\b/g, /\b\d{5}\b/g, /\b\d{4}\b/g];
  for (const p of patterns) {
    const match = text.match(p);
    if (match && match[0]) return match[0];
  }
  return null;
}

// ─── Mark Gmail message as read ───
// ─── Mark Gmail message as read ───
async function markAsRead(accessToken: string, msgId: string) {
  await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(GMAIL_USER_EMAIL)}/messages/${encodeURIComponent(msgId)}/modify`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ removeLabelIds: ["UNREAD"] }),
    }
  );
}

// ─── Core: Process recent messages ───
async function processUnread(accessToken: string, limit: number) {
  console.log(`[POLLER] Fetching up to ${limit} recent messages (including spam)...`);

  // Use "newer_than:1d in:anywhere" to search ALL folders including spam, ignoring read status
  const query = encodeURIComponent("newer_than:1d in:anywhere");
  const list = await gmailFetch(accessToken, `messages?q=${query}&maxResults=${limit}&includeSpamTrash=true`);
  const messages = Array.isArray(list.messages) ? list.messages : [];
  console.log(`[POLLER] Found ${messages.length} recent message(s)`);

  let processed = 0;
  let matched = 0;

  for (const m of messages) {
    const msgId = m.id;
    if (!msgId) continue;
    processed++;

    const full = await gmailFetch(accessToken, `messages/${encodeURIComponent(msgId)}?format=full`);
    const headers = full?.payload?.headers || [];

    const allRecipients = extractAllRecipientEmails(headers);
    const sender = extractSenderEmail(headers);
    const subject = parseHeader(headers, "Subject") || "(no subject)";
    const body = extractBody(full.payload) || full.snippet || "(No body content found)";
    const otp = extractOtp(body);
    const link = extractLink(body);

    console.log(`[POLLER] Message ${msgId}: recipients=[${allRecipients.join(", ")}], from=${sender}, subject="${subject}", otp=${otp || "none"}, link=${link ? 'yes' : 'no'}`);

    if (allRecipients.length === 0) {
      console.log(`[POLLER] Skipping ${msgId}: no recipients found in headers`);
      // Still mark as read
      await markAsRead(accessToken, msgId);
      continue;
    }

    let foundMatch = false;

    // Try matching each recipient against temp_emails
    for (const recipient of allRecipients) {
      // Skip the catch-all Gmail address
      if (recipient === GMAIL_USER_EMAIL.toLowerCase()) continue;

      const { data: emailRecord, error: emailErr } = await supabase
        .from("temp_emails")
        .select("id, user_id, status, expires_at")
        .ilike("email_address", recipient)
        .eq("status", "active")
        .maybeSingle();

      if (emailErr) {
        console.error(`[POLLER] DB error for ${recipient}:`, emailErr.message);
        continue;
      }

      if (emailRecord) {
        foundMatch = true;
        matched++;
        console.log(`[POLLER] ✓ MATCH temp_emails: ${recipient} → ${emailRecord.id}`);

        // Base payload
        const messagePayload: any = {
          email_id: emailRecord.id,
          sender,
          subject,
          body,
          otp_code: otp,
          gmail_message_id: msgId,
        };

        // Attempt insert with verification_link
        let { error: msgErr } = await supabase.from("temp_email_messages").insert({
          ...messagePayload,
          verification_link: link,
        });

        // Fallback if verification_link or gmail_message_id column doesn't exist yet
        if (msgErr && (msgErr.message.includes('verification_link') || msgErr.message.includes('gmail_message_id'))) {
          console.warn(`[POLLER] Fallback insert due to missing columns (verification_link or gmail_message_id)...`);
          // Strip out the new columns
          const fallbackPayload = {
            email_id: emailRecord.id,
            sender,
            subject,
            body,
            otp_code: otp,
          };
          const fallback = await supabase.from("temp_email_messages").insert(fallbackPayload);
          msgErr = fallback.error;
        }

        if (msgErr) {
          if (msgErr.code === '23505') { // Unique constraint violation (duplicate)
            console.log(`[POLLER] Message already saved for ${recipient} (Duplicate ignored)`);
          } else {
            console.error(`[POLLER] Message insert error:`, msgErr.message);
          }
        } else {
          console.log(`[POLLER] Message saved for ${recipient} (OTP: ${otp || 'none'})`);
        }

        // Update status to used
        await supabase.from("temp_emails").update({ status: "used" }).eq("id", emailRecord.id);
        break;
      }

      // Also check temp_email_orders (Legacy)
      const { data: order } = await supabase
        .from("temp_email_orders")
        .select("id, order_status")
        .ilike("email", recipient)
        .eq("order_status", "waiting")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (order?.id) {
        foundMatch = true;
        matched++;
        console.log(`[POLLER] ✓ MATCH temp_email_orders: ${recipient} → order ${order.id}`);

        await supabase.from("temp_email_orders").update({
          order_status: "used",
          otp_code: otp,
          email_body: body,
          updated_at: new Date().toISOString(),
        }).eq("id", order.id);

        if (otp) console.log(`[POLLER] OTP: ${otp} for ${recipient}`);
        break;
      }
    }

    if (!foundMatch) {
      console.log(`[POLLER] No match for any recipient in [${allRecipients.join(", ")}]`);
    }

    // Mark as read in Gmail
    await markAsRead(accessToken, msgId);
  }

  return { processed, matched };
}

// ─── Expire old emails & Process Refunds ───
async function expireOldEmails() {
  const now = new Date().toISOString();
  let refundedAmount = 0;
  let expiredCount = 0;

  // 1. Find emails that need to be expired
  const { data: emailsToExpire } = await supabase
    .from("temp_emails")
    .select("id, user_id, email_address")
    .eq("status", "active")
    .lt("expires_at", now);

  if (emailsToExpire && emailsToExpire.length > 0) {
    const TEMPMAIL_PRICE_KOBO = Number(Deno.env.get("TEMPMAIL_PRICE_KOBO") || "130000");

    for (const email of emailsToExpire) {
      // Process Refund if price > 0
      if (TEMPMAIL_PRICE_KOBO > 0) {
        try {
          // Get user wallet
          const { data: wallets } = await supabase
            .from("wallets")
            .select("id, balance_kobo, balance")
            .eq("user_id", email.user_id)
            .limit(1);

          const wallet = wallets?.[0];
          if (wallet) {
            const ref = `REFUND-TMP-${crypto.randomUUID()}`;
            const { data: creditResult, error: creditError } = await supabase.rpc("credit_wallet", {
              p_user_id: email.user_id,
              p_amount: TEMPMAIL_PRICE_KOBO,
              p_reference: ref,
              p_metadata: { source: "tempmail_refund", email: email.email_address }
            });

            if (creditError) {
              console.error(`[POLLER] RPC Wallet Refund Failed for ${email.email_address}:`, creditError);
            } else {
              console.log(`[POLLER] Refunded ${TEMPMAIL_PRICE_KOBO} kobo to user ${email.user_id} for ${email.email_address}. Ref: ${ref}`);
              refundedAmount += TEMPMAIL_PRICE_KOBO;
            }
          }
        } catch (err) {
          console.error(`[POLLER] Failed to process refund for ${email.email_address}:`, err);
        }
      }

      // Mark as expired
      await supabase.from("temp_emails").update({ status: "expired" }).eq("id", email.id);
      expiredCount++;
    }
  }

  // 2. Expire from legacy temp_email_orders (10 min cutoff) - No refund here to prevent double refunding old data
  const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: expiredOrders } = await supabase
    .from("temp_email_orders")
    .update({ order_status: "expired", updated_at: now })
    .eq("order_status", "waiting")
    .lt("created_at", cutoff)
    .select("id");

  if (expiredOrders && expiredOrders.length > 0) {
    expiredCount += expiredOrders.length;
  }

  if (expiredCount > 0) {
    console.log(`[POLLER] Expired ${expiredCount} old email(s). Total refunded: ${refundedAmount} kobo`);
  }
  return { expired: expiredCount, refunded_kobo: refundedAmount };
}

// ─── HTTP Handler ───
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Allow both cron secret and authenticated users
  const authHeader = req.headers.get("Authorization");
  const cronSecret = req.headers.get("X-CRON-SECRET");

  if (!cronSecret && !authHeader) {
    return jsonResponse({ success: false, message: "Unauthorized" }, 401);
  }

  try {
    const payload = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const limit = Math.min(Math.max(Number(payload.limit || 10), 1), 50);

    const accessToken = await getGmailAccessToken();
    const { processed, matched } = await processUnread(accessToken, limit);
    const { expired } = await expireOldEmails();

    console.log(`[POLLER] Done: processed=${processed}, matched=${matched}, expired=${expired}`);
    return jsonResponse({ success: true, processed, matched, expired });
  } catch (err) {
    console.error("[POLLER] Error:", err.message);
    return jsonResponse({ success: false, message: err.message }, 500);
  }
});
