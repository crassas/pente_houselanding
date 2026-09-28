"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase, whatsappNumber } from "@/lib/supabase";
import { STATUS, formatDate, lisbonToday, money, timeShort } from "../helpers";

export function Clients({
  clients,
  barbers,
  onOpen,
  onNew,
  onChanged,
  notify,
}: {
  clients: any[];
  barbers: any[];
  onOpen: (id: string) => void;
  onNew: () => void;
  onChanged: () => Promise<void>;
  notify: (text: string, kind?: "ok" | "error") => void;
}) {
  const [filter, setFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newClient, setNewClient] = useState({
    name: "",
    phone: "",
    email: "",
    instagram: "",
    preferred_barber_id: "",
    marketing_consent: false,
  });

  async function createClient() {
    if (!newClient.name.trim() || !newClient.phone.trim()) {
      notify("Nome e telefone são obrigatórios.", "error");
      return;
    }
    const user = await supabase.auth.getUser();
    const result = await supabase
      .from("clients")
      .insert({
        name: newClient.name.trim(),
        phone: newClient.phone.trim(),
        email: newClient.email.trim() || null,
        instagram: newClient.instagram.trim() || null,
        preferred_barber_id: newClient.preferred_barber_id || null,
        marketing_consent: newClient.marketing_consent,
        marketing_consent_at: newClient.marketing_consent ? new Date().toISOString() : null,
        created_by: user.data.user?.id || null,
      })
      .select("id")
      .single();

    if (result.error) {
      notify(
        result.error.message.includes("clients_store_phone_unique")
          ? "Já existe um cliente com este número."
          : result.error.message,
        "error"
      );
      return;
    }

    notify("Cliente criado.");
    setShowCreate(false);
    setNewClient({
      name: "",
      phone: "",
      email: "",
      instagram: "",
      preferred_barber_id: "",
      marketing_consent: false,
    });
    await onChanged();
    onOpen(result.data.id);
  }
  const q = filter.toLowerCase().trim();
  const rows = clients.filter((c: any) => {
    if (!q) return true;
    return [c.name, c.phone, c.email, c.instagram].some((v) =>
      String(v || "").toLowerCase().includes(q)
    );
  });

  return (
    <>
      <div className="sectionHead">
        <div>
          <h1>Clientes</h1>
          <p>{clients.length} visíveis para a tua conta</p>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => setShowCreate(true)}>+ Cliente</button>
          <button className="btn primary" onClick={onNew}>+ Marcação</button>
        </div>
      </div>

      <div className="toolbar">
        <input
          className="field"
          style={{ maxWidth: 420 }}
          placeholder="Filtrar lista…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      <div className="clientGrid">
        {rows.map((c: any) => (
          <button className="clientCard" key={c.id} onClick={() => onOpen(c.id)}>
            <b>{c.name}</b>
            <div className="tiny">{c.phone || c.email || "Sem contacto"}</div>
            <div className="clientMeta">
              <span>{c.total_visits || 0} visitas</span>
              <span>{money(c.total_spent)}</span>
            </div>
            <div className="clientMeta">
              <span>{barbers.find((b: any) => b.id === c.preferred_barber_id)?.name || "Sem preferência"}</span>
              <span>{c.last_visit_at ? formatDate(c.last_visit_at) : "Novo"}</span>
            </div>
          </button>
        ))}
      </div>
      {!rows.length ? <div className="empty">Nenhum cliente encontrado.</div> : null}

      {showCreate ? (
        <div className="overlay" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modalHead">
              <div><div className="tiny">Novo registo</div><h2>Novo cliente</h2></div>
              <button className="close" onClick={() => setShowCreate(false)}>×</button>
            </div>
            <div className="formGrid">
              <div className="full">
                <label className="label">Nome</label>
                <input className="field" value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} autoFocus />
              </div>
              <div>
                <label className="label">Telefone</label>
                <input className="field" inputMode="tel" value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="field" type="email" value={newClient.email} onChange={(e) => setNewClient({ ...newClient, email: e.target.value })} />
              </div>
              <div>
                <label className="label">Instagram</label>
                <input className="field" value={newClient.instagram} onChange={(e) => setNewClient({ ...newClient, instagram: e.target.value })} />
              </div>
              <div>
                <label className="label">Barbeiro preferido</label>
                <select className="field" value={newClient.preferred_barber_id} onChange={(e) => setNewClient({ ...newClient, preferred_barber_id: e.target.value })}>
                  <option value="">Sem preferência</option>
                  {barbers.filter((b: any) => b.active).map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <label className="tiny full">
                <input type="checkbox" checked={newClient.marketing_consent} onChange={(e) => setNewClient({ ...newClient, marketing_consent: e.target.checked })} /> Consentimento para marketing
              </label>
            </div>
            <div className="actions" style={{ justifyContent: "flex-end", marginTop: 14 }}>
              <button className="btn" onClick={() => setShowCreate(false)}>Cancelar</button>
              <button className="btn primary" onClick={createClient}>Criar cliente</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function ClientModal({
  id,
  ctx,
  isAdmin,
  barbers,
  notify,
  onClose,
  onChanged,
  onAppointment,
}: any) {
  const [client, setClient] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [c, h, n, p] = await Promise.all([
      supabase.from("clients").select("*").eq("id", id).single(),
      supabase
        .from("appointments")
        .select("*, barbers(id,name), services(id,name,duration_minutes)")
        .eq("client_id", id)
        .order("appointment_date", { ascending: false })
        .order("start_time", { ascending: false }),
      supabase
        .from("client_notes")
        .select("*")
        .eq("client_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("payments")
        .select("*")
        .eq("client_id", id)
        .order("paid_at", { ascending: false }),
    ]);
    if (c.error) notify(c.error.message, "error");
    setClient(c.data || null);
    if (c.data) {
      setEdit({
        name: c.data.name || "",
        phone: c.data.phone || "",
        email: c.data.email || "",
        birth_date: c.data.birth_date || "",
        instagram: c.data.instagram || "",
        preferred_barber_id: c.data.preferred_barber_id || "",
        marketing_consent: Boolean(c.data.marketing_consent),
      });
    }
    setHistory(h.data || []);
    setNotes(n.data || []);
    setPayments(p.data || []);
    setLoading(false);
  }, [id, notify]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <div className="overlay"><div className="spinner" /></div>;
  }
  if (!client) return null;

  const today = lisbonToday();
  const completed = history
    .filter((a) => a.status === "completed")
    .slice()
    .sort((a, b) => a.appointment_date.localeCompare(b.appointment_date));
  const noShows = history.filter((a) => a.status === "no_show").length;
  const cancels = history.filter((a) => a.status === "cancelled").length;
  const next = history
    .filter(
      (a) =>
        a.appointment_date >= today &&
        ["pending", "confirmed", "arrived", "in_progress"].includes(a.status)
    )
    .sort((a, b) =>
      (a.appointment_date + a.start_time).localeCompare(b.appointment_date + b.start_time)
    )[0];

  const used = Array.from(
    new Set(completed.map((a) => a.services?.name).filter(Boolean))
  ) as string[];

  let avg = 0;
  if (completed.length > 1) {
    let days = 0;
    for (let i = 1; i < completed.length; i++) {
      days += Math.round(
        (new Date(completed[i].appointment_date).getTime() -
          new Date(completed[i - 1].appointment_date).getTime()) /
          86400000
      );
    }
    avg = Math.round(days / (completed.length - 1));
  }

  async function saveClient() {
    if (!edit?.name?.trim()) {
      notify("O nome é obrigatório.", "error");
      return;
    }
    const payload: any = {
      name: edit.name.trim(),
      phone: edit.phone.trim() || null,
      email: edit.email.trim() || null,
      birth_date: edit.birth_date || null,
      instagram: edit.instagram.trim() || null,
      preferred_barber_id: edit.preferred_barber_id || null,
      marketing_consent: Boolean(edit.marketing_consent),
    };
    if (edit.marketing_consent && !client.marketing_consent) {
      payload.marketing_consent_at = new Date().toISOString();
    }
    if (!edit.marketing_consent) payload.marketing_consent_at = null;

    const result = await supabase.from("clients").update(payload).eq("id", id);
    if (result.error) {
      notify(
        result.error.message.includes("clients_store_phone_unique")
          ? "Já existe um cliente com este número."
          : result.error.message,
        "error"
      );
      return;
    }
    notify("Ficha do cliente actualizada.");
    setEditing(false);
    await load();
    await onChanged();
  }

  async function addNote() {
    if (!note.trim()) return;
    const result = await supabase.from("client_notes").insert({
      client_id: id,
      barber_id: ctx.barber_id || null,
      author_user_id: ctx.user_id,
      note: note.trim(),
    });
    if (result.error) {
      notify(result.error.message, "error");
      return;
    }
    setNote("");
    notify("Nota adicionada.");
    await load();
  }

  async function exportData() {
    const result = await supabase.rpc("export_client", { p_client_id: id });
    if (result.error) {
      notify(result.error.message, "error");
      return;
    }
    const blob = new Blob([JSON.stringify(result.data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "cliente-" + id + ".json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function anonymize() {
    if (
      !window.confirm(
        "Anonimizar este cliente? Os dados pessoais serão removidos e o histórico financeiro preservado."
      )
    ) return;

    const result = await supabase.rpc("anonymize_client", { p_client_id: id });
    if (result.error) {
      notify(result.error.message, "error");
      return;
    }
    notify("Cliente anonimizado.");
    await onChanged();
    onClose();
  }

  async function remove() {
    if (
      !window.confirm(
        "Eliminar este cliente sem histórico? Esta acção não pode ser desfeita."
      )
    ) return;

    const result = await supabase.rpc("delete_client", { p_client_id: id });
    if (result.error) {
      notify(result.error.message, "error");
      return;
    }
    notify("Cliente eliminado.");
    await onChanged();
    onClose();
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <div className="modal wide">
        <div className="modalHead">
          <div>
            <div className="tiny">Ficha do cliente</div>
            <h2>{client.name}</h2>
            <div className="muted">{client.phone || "Sem telefone"}</div>
          </div>
          <button className="close" onClick={onClose}>×</button>
        </div>

        <div className="actions">
          {client.phone ? (
            <a
              className="btn primary"
              target="_blank"
              rel="noreferrer"
              href={"https://wa.me/" + whatsappNumber(client.phone)}
            >
              WhatsApp
            </a>
          ) : null}
          {client.instagram ? <span className="btn ghost">{client.instagram}</span> : null}
          {isAdmin ? (
            <button className="btn" onClick={() => setEditing(!editing)}>
              {editing ? "Fechar edição" : "Editar dados"}
            </button>
          ) : null}
          {isAdmin ? <button className="btn" onClick={exportData}>Exportar RGPD</button> : null}
          {isAdmin ? <button className="btn danger" onClick={anonymize}>Anonimizar</button> : null}
          {isAdmin ? <button className="btn danger small" onClick={remove}>Eliminar</button> : null}
        </div>

        {editing && edit ? (
          <section className="panel" style={{ marginTop: 14 }}>
            <h3>Dados do cliente</h3>
            <div className="formGrid">
              <div><label className="label">Nome</label><input className="field" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
              <div><label className="label">Telefone</label><input className="field" inputMode="tel" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></div>
              <div><label className="label">Email</label><input className="field" type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></div>
              <div><label className="label">Data de nascimento</label><input className="field" type="date" value={edit.birth_date} onChange={(e) => setEdit({ ...edit, birth_date: e.target.value })} /></div>
              <div><label className="label">Instagram</label><input className="field" value={edit.instagram} onChange={(e) => setEdit({ ...edit, instagram: e.target.value })} /></div>
              <div>
                <label className="label">Barbeiro preferido</label>
                <select className="field" value={edit.preferred_barber_id} onChange={(e) => setEdit({ ...edit, preferred_barber_id: e.target.value })}>
                  <option value="">Sem preferência</option>
                  {barbers.filter((b: any) => b.active).map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <label className="tiny full">
                <input type="checkbox" checked={edit.marketing_consent} onChange={(e) => setEdit({ ...edit, marketing_consent: e.target.checked })} /> Consentimento para marketing
              </label>
            </div>
            <div className="actions" style={{ marginTop: 12 }}>
              <button className="btn primary" onClick={saveClient}>Guardar alterações</button>
              <button className="btn" onClick={() => setEditing(false)}>Cancelar</button>
            </div>
          </section>
        ) : null}

        <div className="grid metrics" style={{ marginTop: 14 }}>
          {[
            ["Visitas", client.total_visits || 0],
            ["Total gasto", money(client.total_spent)],
            ["Primeira visita", client.first_visit_at ? formatDate(client.first_visit_at) : "—"],
            ["Última visita", client.last_visit_at ? formatDate(client.last_visit_at) : "—"],
            ["Faltas", noShows],
            ["Cancelamentos", cancels],
            ["Frequência média", avg ? String(avg) + " dias" : "—"],
          ].map(([label, value]) => (
            <div className="metric" key={String(label)}>
              <span>{label}</span>
              <b style={{ fontSize: 18 }}>{value}</b>
            </div>
          ))}
        </div>

        <div className="grid two" style={{ marginTop: 12 }}>
          <section className="panel">
            <h3>Resumo</h3>
            <div className="row">
              <div className="rowMain"><b>Barbeiro preferido</b></div>
              <span>{barbers.find((b: any) => b.id === client.preferred_barber_id)?.name || "—"}</span>
            </div>
            <div className="row">
              <div className="rowMain"><b>Email</b></div>
              <span>{client.email || "—"}</span>
            </div>
            <div className="row">
              <div className="rowMain"><b>Instagram</b></div>
              <span>{client.instagram || "—"}</span>
            </div>
            <div className="row">
              <div className="rowMain"><b>Próxima marcação</b></div>
              <span>{next ? formatDate(next.appointment_date) + " · " + timeShort(next.start_time) : "Sem próxima"}</span>
            </div>
            <div className="row">
              <div className="rowMain"><b>Serviços utilizados</b></div>
              <span>{used.join(", ") || "—"}</span>
            </div>
            <div className="row">
              <div className="rowMain"><b>Marketing</b></div>
              <span>{client.marketing_consent ? "Consentiu" : "Sem consentimento"}</span>
            </div>
          </section>

          <section className="panel">
            <h3>Notas internas</h3>
            <div className="actions">
              <input
                className="field"
                placeholder="Adicionar nota…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <button className="btn" onClick={addNote}>Adicionar</button>
            </div>
            <div className="list">
              {notes.slice(0, 5).map((n) => (
                <div className="row" key={n.id}>
                  <div className="rowMain">
                    <span>{n.note}</span>
                    <span className="tiny">{new Date(n.created_at).toLocaleString("pt-PT")}</span>
                  </div>
                </div>
              ))}
              {!notes.length ? <div className="tiny" style={{ marginTop: 10 }}>Sem notas.</div> : null}
            </div>
          </section>
        </div>

        <section className="panel" style={{ marginTop: 12 }}>
          <h3>Histórico</h3>
          <div className="tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Data</th><th>Hora</th><th>Barbeiro</th><th>Serviço</th><th>Estado</th><th>Pagamento</th>
                </tr>
              </thead>
              <tbody>
                {history.map((a) => (
                  <tr
                    key={a.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => onAppointment({ ...a, clients: { id: client.id, name: client.name, phone: client.phone } })}
                  >
                    <td>{formatDate(a.appointment_date)}</td>
                    <td>{timeShort(a.start_time)}</td>
                    <td>{a.barbers?.name || "—"}</td>
                    <td>{a.services?.name || "—"}</td>
                    <td>{STATUS[a.status] || a.status}</td>
                    <td>{a.payment_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!history.length ? <div className="empty">Sem histórico.</div> : null}
        </section>

        {isAdmin && payments.length ? (
          <section className="panel" style={{ marginTop: 12 }}>
            <h3>Pagamentos</h3>
            {payments.map((p) => (
              <div className="row" key={p.id}>
                <div className="rowMain">
                  <b>{money(p.amount) + " · " + p.method}</b>
                  <span>{new Date(p.paid_at).toLocaleString("pt-PT")}</span>
                </div>
                <span className="badge">{p.status}</span>
              </div>
            ))}
          </section>
        ) : null}
      </div>
    </div>
  );
}
