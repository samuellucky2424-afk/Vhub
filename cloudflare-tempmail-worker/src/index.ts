export class TempMailLoop {
  state: DurableObjectState;
  env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/start") {
      await this.state.storage.put("running", true);
      await this.arm();
      return new Response(JSON.stringify({ success: true, running: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/stop") {
      await this.state.storage.put("running", false);
      return new Response(JSON.stringify({ success: true, running: false }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/status") {
      const running = (await this.state.storage.get<boolean>("running")) || false;
      const lastRunAt = (await this.state.storage.get<string>("lastRunAt")) || null;
      return new Response(JSON.stringify({ success: true, running, lastRunAt }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not Found", { status: 404 });
  }

  async alarm(): Promise<void> {
    const running = (await this.state.storage.get<boolean>("running")) || false;
    if (!running) return;

    await this.runOnce();
    await this.arm();
  }

  private get intervalMs() {
    const raw = Number(this.env.POLL_INTERVAL_MS || "5000");
    if (!Number.isFinite(raw)) return 5000;
    return Math.min(Math.max(raw, 1000), 60000);
  }

  private async arm() {
    await this.state.storage.setAlarm(Date.now() + this.intervalMs);
  }

  private async runOnce() {
    const functionName = this.env.SUPABASE_FUNCTION_NAME || "tempmail-gmail-poller";
    const endpoint = `${this.env.SUPABASE_URL}/functions/v1/${functionName}`;

    try {
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.env.SUPABASE_ANON_KEY}`,
          apikey: this.env.SUPABASE_ANON_KEY,
          "X-CRON-SECRET": this.env.SUPABASE_CRON_SECRET || "",
        },
        body: JSON.stringify({ limit: 10 }),
      });

      await this.state.storage.put("lastRunAt", new Date().toISOString());

      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        await this.state.storage.put("lastError", `${resp.status} ${text}`);
        return;
      }

      const json = await resp.json().catch(() => null);
      await this.state.storage.put("lastResult", json);
    } catch (e: any) {
      await this.state.storage.put("lastError", e?.message || "Unknown error");
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/admin/start" || url.pathname === "/admin/stop" || url.pathname === "/admin/status") {
      const expected = env.SUPABASE_CRON_SECRET;
      const provided = request.headers.get("X-CRON-SECRET") || "";
      if (!expected || provided !== expected) return new Response("Unauthorized", { status: 401 });

      const id = env.TEMPMAIL_LOOP.idFromName("global");
      const stub = env.TEMPMAIL_LOOP.get(id);
      const forwardPath = url.pathname.replace("/admin", "");
      return stub.fetch(new Request(new URL(forwardPath, url.origin), request));
    }

    return new Response("Not Found", { status: 404 });
  },
};

export interface Env {
  TEMPMAIL_LOOP: DurableObjectNamespace;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_FUNCTION_NAME?: string;
  POLL_INTERVAL_MS?: string;
  SUPABASE_CRON_SECRET?: string;
}
