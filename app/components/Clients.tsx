"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase, whatsappNumber } from "@/lib/supabase";
import { STATUS, formatDate, lisbonToday, money, timeShort } from "../helpers";

export function Clients({
  clients,
  barbers,
  onOpen,
  onNew,
}: {
  clients: any[];
  barbers: any[];
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  const [filter, setFilter] = useState("");
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
        <button className="btn primary" onClick={onNew}>+ Marcação</button>
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
          {isAdmin ? <button className="btn" onClick={exportData}>Exportar RGPD</button> : null}
          {isAdmin ? <button className="btn danger" onClick={anonymize}>Anonimizar</button> : null}
          {isAdmin ? <button className="btn danger small" onClick={remove}>Eliminar</button> : null}
        </div>

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
                    onClick={() => onAppointment(a)}
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
