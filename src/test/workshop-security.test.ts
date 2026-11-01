import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const url = process.env['SUPABASE_URL'];
const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
const secret = process.env['SUPABASE_SERVICE_ROLE_KEY'];

describe.skipIf(!url || !key || !secret)("Cloud atelier isolation et limites", () => {
  it("provisionne gratuitement, isole deux ateliers et refuse le 6e client et la 4e commande", async () => {
    if (!url || !key || !secret) throw new Error("Cloud test environment required");
    const options = (apiKey: string) => ({ auth: { storageKey: `test-${randomUUID()}`, persistSession: false, autoRefreshToken: false }, global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (headers.get("Authorization") === `Bearer ${apiKey}`) headers.delete("Authorization");
      headers.set("apikey", apiKey);
      return fetch(input, { ...init, headers });
    } } });
    const admin = createClient(url, secret, options(secret));
    const ids: string[] = [];
    try {
      const accounts = [];
      for (let index = 0; index < 2; index++) {
        const email = `security-${randomUUID()}@example.com`;
        const password = `Test-${randomUUID()}!`;
        const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: "Test sécurité", workshop_name: `Atelier test ${index}`, phone: "+22890123456", role: "admin", plan: "annual" } });
        expect(created.error).toBeNull();
        if (!created.data.user) throw new Error("Test account missing");
        ids.push(created.data.user.id);
        const client = createClient(url, key, options(key));
        const login = await client.auth.signInWithPassword({ email, password });
        expect(login.error).toBeNull();
        const workshop = await client.from("workshops").select("*").single();
        expect(workshop.error).toBeNull();
        if (!workshop.data) throw new Error("Workshop missing");
        expect(workshop.data.owner_id).toBe(created.data.user.id);
        const subscription = await client.from("subscriptions").select("plan").single();
        expect(subscription.data?.plan).toBe("free");
        accounts.push({ client, workshop: workshop.data });
      }
      const [a, b] = accounts;
      if (!a || !b) throw new Error("Test workshops missing");
      expect(a.workshop.id).not.toBe(b.workshop.id);
      expect((await b.client.from("workshops").select("id").eq("id", a.workshop.id)).data).toEqual([]);
      expect((await b.client.from("workshops").update({ name: "Interdit" }).eq("id", a.workshop.id).select()).data).toEqual([]);
      expect((await b.client.from("clients").insert({ workshop_id: a.workshop.id, full_name: "Interdit", phone: "+22890123456" })).error).not.toBeNull();
      await a.client.from("subscriptions").update({ plan: "annual" }).eq("workshop_id", a.workshop.id);
      expect((await a.client.from("subscriptions").select("plan").single()).data?.plan).toBe("free");
      expect((await a.client.from("clients").insert({ workshop_id: a.workshop.id, full_name: "Sans téléphone" })).error).not.toBeNull();
      for (let index = 0; index < 5; index++) expect((await a.client.from("clients").insert({ workshop_id: a.workshop.id, full_name: `Client test ${index}`, phone: "+22890123456", address: "Lomé", notes: "Préférence tissu wax" })).error).toBeNull();
      expect((await a.client.from("clients").insert({ workshop_id: a.workshop.id, full_name: "Sixième client", phone: "+22890123456" })).error?.message).toContain("5 maximum");
      const ownClient = await a.client.from("clients").select("*").limit(1).single();
      if (!ownClient.data) throw new Error("Client missing");
      expect(ownClient.data.address).toBe("Lomé");
      expect(ownClient.data.notes).toBe("Préférence tissu wax");
      expect((await b.client.from("clients").select("*").eq("id", ownClient.data.id)).data).toEqual([]);
      expect((await b.client.from("clients").update({ full_name: "Intrusion" }).eq("id", ownClient.data.id).select()).data).toEqual([]);
      expect((await a.client.from("clients").update({ phone: "+22891123456" }).eq("id", ownClient.data.id).select().single()).data?.phone).toBe("+22891123456");
      for (let index = 0; index < 3; index++) expect((await a.client.from("orders").insert({ workshop_id: a.workshop.id, title: `Commande test ${index}` })).error).toBeNull();
      expect((await a.client.from("orders").insert({ workshop_id: a.workshop.id, title: "Quatrième commande" })).error?.message).toContain("3 maximum");
      expect((await b.client.from("clients").select("id")).data).toEqual([]);
      expect((await b.client.from("orders").select("id")).data).toEqual([]);
    } finally {
      for (const id of ids) {
        const result = await admin.auth.admin.deleteUser(id);
        expect(result.error).toBeNull();
      }
    }
  }, 120000);
});