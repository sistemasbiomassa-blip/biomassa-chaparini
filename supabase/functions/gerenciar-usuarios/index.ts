// Edge Function: gerenciar-usuarios
// Único lugar autorizado a usar a service_role key (nunca fica no navegador).
// Só ADMIN pode chamar. Ações: addUsuario, updateUsuario, updatePassword, deleteUsuario.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const authHeader = req.headers.get("Authorization") || "";

    // Cliente "como o usuário chamador", só pra descobrir quem é e checar perfil
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData?.user) return json({ ok: false, error: "Não autenticado" }, 401);

    const { data: perfilRow, error: perfilErr } = await callerClient
      .from("profiles")
      .select("perfil")
      .eq("id", userData.user.id)
      .single();
    if (perfilErr || !perfilRow || perfilRow.perfil !== "ADMIN") {
      return json({ ok: false, error: "Apenas ADMIN pode gerenciar usuários" }, 403);
    }

    // Cliente com poder de verdade (service_role), só a partir daqui
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const body = await req.json();
    const action = body.action as string;
    const data = body.data || {};

    if (action === "addUsuario") {
      const email = String(data.EMAIL || "").trim();
      const nome = String(data.NOME || "").trim();
      const senha = String(data.SENHA || "");
      const perfil = String(data.PERFIL || "ANALISTA").toUpperCase();
      const usuarioLegado = String(data.USUARIO || "").trim();
      if (!email || !nome || !senha) return json({ ok: false, error: "E-mail, nome e senha são obrigatórios" }, 400);

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email, password: senha, email_confirm: true,
        user_metadata: { nome, perfil },
      });
      if (createErr) return json({ ok: false, error: createErr.message }, 400);

      if (usuarioLegado) {
        await admin.from("profiles").update({ usuario: usuarioLegado }).eq("id", created.user.id);
      }
      return json({ ok: true, id: created.user.id });
    }

    if (action === "updateUsuario") {
      const id = data.id;
      if (!id) return json({ ok: false, error: "id obrigatório" }, 400);
      const updates: Record<string, unknown> = {};
      if (data.ATIVO !== undefined) updates.ativo = String(data.ATIVO).toUpperCase() === "TRUE";
      if (data.PERFIL !== undefined) updates.perfil = data.PERFIL;
      if (data.NOME !== undefined) updates.nome = data.NOME;
      const { error } = await admin.from("profiles").update(updates).eq("id", id);
      if (error) return json({ ok: false, error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === "updatePassword") {
      const id = data.id;
      const novaSenha = String(data.novaSenha || data.SENHA || "");
      if (!id || !novaSenha) return json({ ok: false, error: "id e novaSenha são obrigatórios" }, 400);
      const { error: pwErr } = await admin.auth.admin.updateUserById(id, { password: novaSenha });
      if (pwErr) return json({ ok: false, error: pwErr.message }, 400);
      await admin.from("profiles").update({ primeiro_acesso: true }).eq("id", id);
      return json({ ok: true });
    }

    if (action === "deleteUsuario") {
      const id = data.id;
      if (!id) return json({ ok: false, error: "id obrigatório" }, 400);
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) return json({ ok: false, error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ ok: false, error: "Ação desconhecida: " + action }, 400);
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message || e) }, 500);
  }
});
