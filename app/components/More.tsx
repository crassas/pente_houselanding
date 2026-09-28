"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase, whatsappNumber } from "@/lib/supabase";
import { WEEKDAYS, addDays, formatDate, lisbonToday, money, timeShort } from "../helpers";

export function More({
  ctx,
  isAdmin,
  barbers,
  services,
  schedules,
  businessHours,
  notify,
  refreshBase,
  refreshCore,
}: any) {
  const tabs = isAdmin
    ? ["Seguimento", "Estatísticas", "Serviços", "Equipa", "Horários", "Bloqueios", "Pagamentos"]
    : ["Bloqueios", "Conta"];
  const [tab, setTab] = useState(tabs[0]);

  return (
    <>
      <div className="sectionHead">
        <div><h1>Mais</h1><p>Operação e administração</p></div>
        <button className="btn" onClick={() => supabase.auth.signOut()}>Terminar sessão</button>
      </div>

      <div className="tabs">
        {tabs.map((name) => (
          <button
            className={"btn small " + (tab === name ? "primary" : "")}
            key={name}
            onClick={() => setTab(name)}
          >
            {name}
          </button>
        ))}
      </div>

      {tab === "Seguimento" ? <FollowUp notify={notify} /> : null}
      {tab === "Estatísticas" ? <Stats notify={notify} /> : null}
      {tab === "Serviços" ? (
        <ServicesAdmin services={services} barbers={barbers} barberServices={barberServices} notify={notify} refresh={refreshBase} />
      ) : null}
      {tab === "Equipa" ? <TeamAdmin barbers={barbers} notify={notify} refresh={refreshBase} /> : null}
      {tab === "Horários" ? (
        <HoursAdmin
          barbers={barbers}
          schedules={schedules}
          businessHours={businessHours}
          notify={notify}
          refresh={refreshBase}
        />
      ) : null}
      {tab === "Bloqueios" ? (
        <Blocks
          ctx={ctx}
          isAdmin={isAdmin}
          barbers={barbers}
          notify={notify}
          refresh={refreshCore}
        />
      ) : null}
      {tab === "Pagamentos" ? <Payments notify={notify} /> : null}
      {tab === "Conta" ? (
        <section className="panel">
          <h2>Conta</h2>
          <div className="row">
            <div className="rowMain">
              <b>{ctx.barber_name || "Barbeiro"}</b>
              <span>{ctx.email}</span>
            </div>
            <span className="badge">{ctx.roles.join(" · ")}</span>
          </div>
        </section>
      ) : null}
    </>
  );
}

function FollowUp({ notify }: any) {
  const segments = [
    ["inactive_30", "30 dias"],
    ["inactive_45", "45 dias"],
    ["inactive_60", "60 dias"],
    ["inactive_90", "90 dias"],
    ["new", "Novos"],
    ["regular", "Habituais"],
    ["birthday", "Aniversário"],
    ["no_show", "No-show"],
    ["no_next", "Sem próxima"],
  ];
  const [segment, setSegment] = useState("inactive_30");
  const [consentOnly, setConsentOnly] = useState(true);
  const [rows, setRows] = useState<any[]>([]);

  const load = useCallback(async () => {
    const result = await supabase.rpc("followup_clients", {
      p_segment: segment,
      p_consent_only: consentOnly,
    });
    if (result.error) {
      notify(result.error.message, "error");
      return;
    }
    setRows(result.data || []);
  }, [segment, consentOnly, notify]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="panel">
      <div className="sectionHead" style={{ marginBottom: 12 }}>
        <div>
          <h2>Seguimento</h2>
          <p>{rows.length} clientes neste filtro</p>
        </div>
        <label className="tiny">
          <input
            type="checkbox"
            checked={consentOnly}
            onChange={(e) => setConsentOnly(e.target.checked)}
          />{" "}
          Só consentimento de marketing
        </label>
      </div>

      <div className="tabs">
        {segments.map(([id, label]) => (
          <button
            className={"btn small " + (segment === id ? "primary" : "")}
            key={id}
            onClick={() => setSegment(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="list">
        {rows.map((r) => (
          <div className="row" key={r.id}>
            <div className="rowMain">
              <b>{r.name}</b>
              <span>
                {r.last_visit_at
                  ? "Última visita: " + formatDate(r.last_visit_at) + " · " + String(r.days_since ?? "?") + " dias"
                  : "Sem visita registada"}
              </span>
            </div>
            <div className="rowActions">
              {r.marketing_consent ? (
                <span className="badge ok">marketing OK</span>
              ) : (
                <span className="badge">sem consentimento</span>
              )}
              {r.phone && r.marketing_consent ? (
                <a
                  className="btn small"
                  target="_blank"
                  rel="noreferrer"
                  href={"https://wa.me/" + whatsappNumber(r.phone)}
                >
                  WhatsApp
                </a>
              ) : null}
            </div>
          </div>
        ))}
        {!rows.length ? <div className="empty">Nenhum cliente neste segmento.</div> : null}
      </div>
    </section>
  );
}

function Stats({ notify }: any) {
  const today = lisbonToday();
  const [from, setFrom] = useState(addDays(today, -30));
  const [to, setTo] = useState(today);
  const [data, setData] = useState<any>(null);

  const load = useCallback(async () => {
    const result = await supabase.rpc("stats_range", { p_from: from, p_to: to });
    if (result.error) {
      notify(result.error.message, "error");
      return;
    }
    setData(result.data);
  }, [from, to, notify]);

  useEffect(() => {
    load();
  }, [load]);

  const metrics: Array<[string, any]> = data
    ? [
        ["Marcações", data.appointments],
        ["Concluídas", data.completed],
        ["Faltas", data.no_shows],
        ["Canceladas", data.cancelled],
        ["Receita", money(data.revenue)],
        ["Novos", data.new_clients],
        ["Recorrentes", data.returning_clients],
      ]
    : [];

  return (
    <>
      <div className="toolbar">
        <input className="dateInput" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <span className="tiny">até</span>
        <input className="dateInput" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      <div className="grid metrics">
        {metrics.map(([label, value]) => (
          <div className="metric" key={String(label)}>
            <span>{label}</span>
            <b>{value}</b>
          </div>
        ))}
      </div>

      <div className="grid two" style={{ marginTop: 12 }}>
        <section className="panel">
          <h2>Ocupação</h2>
          {(data?.barbers || []).map((b: any) => (
            <div className="barberStat" key={b.barber_id}>
              <div>
                <b>{b.name}</b>
                <div className="tiny">{b.appointments} marcações · {b.served} atendidos</div>
              </div>
              <div>
                <div className="tiny" style={{ textAlign: "right" }}>{b.occupancy}%</div>
                <div className="progress">
                  <i style={{ width: String(Math.min(100, Number(b.occupancy || 0))) + "%" }} />
                </div>
              </div>
            </div>
          ))}
        </section>

        <section className="panel">
          <h2>Serviços concluídos</h2>
          {(data?.top_services || []).map((s: any) => (
            <div className="row" key={s.name}>
              <b>{s.name}</b>
              <span>{s.total}</span>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}

function ServicesAdmin({ services, barbers, barberServices, notify, refresh }: any) {
  const blank = {
    id: "",
    name: "",
    description: "",
    duration_minutes: 30,
    price: "0",
    active: true,
  };
  const [form, setForm] = useState<any>(blank);\n  const [serviceBarberId, setServiceBarberId] = useState(barbers[0]?.id || "");

  async function save() {
    if (!form.name.trim()) {
      notify("Indica o nome do serviço.", "error");
      return;
    }

    const payload = {
      name: form.name.trim(),
      description: form.description || null,
      duration_minutes: Number(form.duration_minutes),
      price: Number(String(form.price).replace(",", ".")),
      active: Boolean(form.active),
    };

    if (!Number.isFinite(payload.price) || payload.price < 0 || payload.duration_minutes < 5) {
      notify("Preço ou duração inválidos.", "error");
      return;
    }

    if (form.id) {
      const result = await supabase.from("services").update(payload).eq("id", form.id);
      if (result.error) {
        notify(result.error.message, "error");
        return;
      }
      notify("Serviço actualizado.");
    } else {
      const created = await supabase.from("services").insert(payload).select("id").single();
      if (created.error) {
        notify(created.error.message, "error");
        return;
      }
      if (barbers.length) {
        const links = barbers.map((b: any) => ({
          barber_id: b.id,
          service_id: created.data.id,
          active: true,
        }));
        const linked = await supabase.from("barber_services").insert(links);
        if (linked.error) notify("Serviço criado, mas confirma a associação aos barbeiros.", "error");
      }
      notify("Serviço criado.");
    }

    setForm(blank);
    await refresh();
  }

  async function toggleBarberService(serviceId: string) {
    if (!serviceBarberId) return;
    const existing = barberServices.find(
      (row: any) => row.barber_id === serviceBarberId && row.service_id === serviceId
    );
    const result = existing
      ? await supabase
          .from("barber_services")
          .update({ active: !existing.active })
          .eq("barber_id", serviceBarberId)
          .eq("service_id", serviceId)
      : await supabase.from("barber_services").insert({
          barber_id: serviceBarberId,
          service_id: serviceId,
          active: true,
        });
    if (result.error) {
      notify(result.error.message, "error");
      return;
    }
    notify("Serviços do barbeiro actualizados.");
    await refresh();
  }

  async function setDurationOverride(serviceId: string, value: string) {
    if (!serviceBarberId) return;
    const parsed = value ? Number(value) : null;
    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 5)) {
      notify("Duração inválida.", "error");
      return;
    }
    const result = await supabase.from("barber_services").upsert(
      {
        barber_id: serviceBarberId,
        service_id: serviceId,
        active: true,
        duration_override_minutes: parsed,
      },
      { onConflict: "barber_id,service_id" }
    );
    if (result.error) {
      notify(result.error.message, "error");
      return;
    }
    notify("Duração individual actualizada.");
    await refresh();
  }

  return (
    <div className="grid two">
      <section className="panel">
        <h2>{form.id ? "Editar serviço" : "Novo serviço"}</h2>
        <div className="formGrid">
          <div className="full">
            <label className="label">Nome</label>
            <input className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Duração (min)</label>
            <input className="field" type="number" min="5" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} />
          </div>
          <div>
            <label className="label">Preço (€)</label>
            <input className="field" inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </div>
          <div className="full">
            <label className="label">Descrição</label>
            <textarea className="field" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <label className="tiny">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Activo
          </label>
        </div>
        <div className="actions" style={{ marginTop: 12 }}>
          <button className="btn primary" onClick={save}>Guardar</button>
          {form.id ? <button className="btn" onClick={() => setForm(blank)}>Cancelar</button> : null}
        </div>
      </section>

      <section className="panel">
        <h2>Serviços</h2>
        {services.map((s: any) => (
          <div className="row" key={s.id}>
            <div className="rowMain">
              <b>{s.name}</b>
              <span>{s.duration_minutes} min · {money(s.price)} · {s.active ? "activo" : "inactivo"}</span>
            </div>
            <button className="btn small" onClick={() => setForm({ ...s, price: String(s.price) })}>Editar</button>
          </div>
        ))}

        <h3 style={{ marginTop: 22 }}>Serviços por barbeiro</h3>
        <select
          className="field"
          value={serviceBarberId}
          onChange={(e) => setServiceBarberId(e.target.value)}
          style={{ marginBottom: 10 }}
        >
          {barbers.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        {services.map((s: any) => {
          const link = barberServices.find(
            (row: any) => row.barber_id === serviceBarberId && row.service_id === s.id
          );
          return (
            <div className="row" key={"barber-" + s.id}>
              <div className="rowMain">
                <b>{s.name}</b>
                <span>{link?.active ? "executa este serviço" : "não atribuído"} · duração própria opcional</span>
              </div>
              <div className="rowActions">
                <input
                  className="field"
                  style={{ width: 92 }}
                  type="number"
                  min="5"
                  placeholder={String(s.duration_minutes)}
                  defaultValue={link?.duration_override_minutes || ""}
                  disabled={!link?.active}
                  onBlur={(e) => setDurationOverride(s.id, e.target.value)}
                />
                <button
                  className={"btn small " + (link?.active ? "ok" : "")}
                  onClick={() => toggleBarberService(s.id)}
                >
                  {link?.active ? "Activo" : "Atribuir"}
                </button>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

function TeamAdmin({ barbers, notify, refresh }: any) {
  const [email, setEmail] = useState("");
  const [inviteSlug, setInviteSlug] = useState("");
  const [admin, setAdmin] = useState(false);
  const [edit, setEdit] = useState<any>({
    id: "",
    name: "",
    slug: "",
    phone: "",
    instagram: "",
    photo_url: "",
    active: true,
  });

  async function invite() {
    if (!email.includes("@") || !inviteSlug) {
      notify("Indica email e barbeiro.", "error");
      return;
    }
    const roles = admin ? ["admin", "barber"] : ["barber"];
    const result = await supabase.from("staff_invites").upsert(
      {
        email: email.trim().toLowerCase(),
        roles,
        barber_slug: inviteSlug,
      },
      { onConflict: "email" }
    );
    if (result.error) {
      notify(result.error.message, "error");
      return;
    }
    notify("Convite guardado. A pessoa já pode criar a conta.");
    setEmail("");
    setInviteSlug("");
    setAdmin(false);
  }

  async function saveBarber() {
    if (!edit.name.trim() || !edit.slug.trim()) {
      notify("Nome e slug são obrigatórios.", "error");
      return;
    }
    const payload = {
      name: edit.name.trim(),
      slug: edit.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
      phone: edit.phone || null,
      instagram: edit.instagram || null,
      photo_url: edit.photo_url || null,
      active: Boolean(edit.active),
    };

    if (edit.id) {
      const result = await supabase.from("barbers").update(payload).eq("id", edit.id);
      if (result.error) {
        notify(result.error.message, "error");
        return;
      }
      notify("Barbeiro actualizado.");
    } else {
      const result = await supabase.from("barbers").insert(payload).select("id").single();
      if (result.error) {
        notify(result.error.message, "error");
        return;
      }
      const serviceRows = await supabase.from("services").select("id").eq("active", true);
      if (serviceRows.data?.length) {
        await supabase.from("barber_services").insert(
          serviceRows.data.map((s: any) => ({
            barber_id: result.data.id,
            service_id: s.id,
            active: true,
          }))
        );
      }
      notify("Barbeiro criado.");
    }

    setEdit({ id: "", name: "", slug: "", phone: "", instagram: "", photo_url: "", active: true });
    await refresh();
  }

  return (
    <div className="grid two">
      <section className="panel">
        <h2>Equipa</h2>
        {barbers.map((b: any) => (
          <div className="row" key={b.id}>
            <div className="rowMain">
              <b>{b.name}</b>
              <span>{b.instagram || "Sem Instagram"} · {b.user_id ? "conta ligada" : "sem conta ligada"}</span>
            </div>
            <button
              className="btn small"
              onClick={() =>
                setEdit({
                  id: b.id,
                  name: b.name,
                  slug: b.slug,
                  phone: b.phone || "",
                  instagram: b.instagram || "",
                  photo_url: b.photo_url || "",
                  active: b.active,
                })
              }
            >
              Editar
            </button>
          </div>
        ))}

        <h3 style={{ marginTop: 20 }}>{edit.id ? "Editar barbeiro" : "Adicionar barbeiro"}</h3>
        <div className="formGrid">
          <input className="field" placeholder="Nome" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
          <input className="field" placeholder="Slug" value={edit.slug} onChange={(e) => setEdit({ ...edit, slug: e.target.value })} />
          <input className="field" placeholder="Telefone" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
          <input className="field" placeholder="Instagram" value={edit.instagram} onChange={(e) => setEdit({ ...edit, instagram: e.target.value })} />
          <input className="field full" placeholder="URL da foto" value={edit.photo_url} onChange={(e) => setEdit({ ...edit, photo_url: e.target.value })} />
          <label className="tiny"><input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> Activo</label>
        </div>
        <div className="actions" style={{ marginTop: 10 }}>
          <button className="btn primary" onClick={saveBarber}>Guardar barbeiro</button>
          {edit.id ? <button className="btn" onClick={() => setEdit({ id: "", name: "", slug: "", phone: "", instagram: "", photo_url: "", active: true })}>Cancelar</button> : null}
        </div>
      </section>

      <section className="panel">
        <h2>Convidar utilizador</h2>
        <div className="formGrid">
          <div className="full">
            <label className="label">Email</label>
            <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="full">
            <label className="label">Associar ao barbeiro</label>
            <select className="field" value={inviteSlug} onChange={(e) => setInviteSlug(e.target.value)}>
              <option value="">Escolher…</option>
              {barbers.map((b: any) => <option key={b.id} value={b.slug}>{b.name}</option>)}
            </select>
          </div>
          <label className="tiny">
            <input type="checkbox" checked={admin} onChange={(e) => setAdmin(e.target.checked)} /> Também administrador
          </label>
        </div>
        <button className="btn primary" style={{ marginTop: 12 }} onClick={invite}>Criar convite</button>
      </section>
    </div>
  );
}

function HoursAdmin({ barbers, schedules, businessHours, notify, refresh }: any) {
  const [hours, setHours] = useState<any[]>(businessHours.map((h: any) => ({ ...h })));
  const [barberId, setBarberId] = useState(barbers[0]?.id || "");
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayClosed, setHolidayClosed] = useState(true);
  const [holidayReason, setHolidayReason] = useState("");

  useEffect(() => {
    setHours(businessHours.map((h: any) => ({ ...h })));
  }, [businessHours]);

  async function saveShop() {
    const payload = hours.map((h) => ({
      weekday: Number(h.weekday),
      open_time: h.closed ? null : timeShort(h.open_time),
      close_time: h.closed ? null : timeShort(h.close_time),
      last_booking_time: h.closed ? null : timeShort(h.last_booking_time),
      closed: Boolean(h.closed),
    }));
    const result = await supabase.from("business_hours").upsert(payload, { onConflict: "weekday" });
    if (result.error) {
      notify(result.error.message, "error");
      return;
    }
    notify("Horário da loja actualizado.");
    await refresh();
  }

  async function updateSchedule(row: any, field: "start_time" | "end_time", value: string) {
    const result = await supabase.from("schedules").update({ [field]: value }).eq("id", row.id);
    if (result.error) {
      notify(result.error.message, "error");
      return;
    }
    notify("Horário do barbeiro actualizado.");
    await refresh();
  }

  async function addSchedule(weekday: number) {
    if (!barberId) return;
    const result = await supabase.from("schedules").insert({
      barber_id: barberId,
      weekday,
      start_time: "10:00",
      end_time: weekday === 6 ? "18:00" : "20:00",
      active: true,
    });
    if (result.error) {
      notify(result.error.message, "error");
      return;
    }
    notify("Dia adicionado ao horário.");
    await refresh();
  }

  async function addHoliday() {
    if (!holidayDate) {
      notify("Escolhe a data.", "error");
      return;
    }
    const result = await supabase.from("special_hours").upsert(
      {
        date: holidayDate,
        open_time: holidayClosed ? null : "10:00",
        close_time: holidayClosed ? null : "18:00",
        closed: holidayClosed,
        reason: holidayReason || null,
      },
      { onConflict: "date" }
    );
    if (result.error) {
      notify(result.error.message, "error");
      return;
    }
    notify("Horário especial guardado.");
    setHolidayDate("");
    setHolidayReason("");
  }

  const barberRows = schedules.filter((s: any) => s.barber_id === barberId);

  return (
    <div className="grid two">
      <section className="panel">
        <h2>Horário da loja</h2>
        {hours.map((h, index) => (
          <div className="row" key={h.weekday}>
            <div style={{ width: 40 }}><b>{WEEKDAYS[Number(h.weekday) - 1]}</b></div>
            <div className="rowActions" style={{ flex: 1 }}>
              <input
                className="field"
                style={{ width: 105 }}
                type="time"
                disabled={h.closed}
                value={timeShort(h.open_time)}
                onChange={(e) =>
                  setHours(hours.map((x, i) => i === index ? { ...x, open_time: e.target.value } : x))
                }
              />
              <input
                className="field"
                style={{ width: 105 }}
                type="time"
                disabled={h.closed}
                value={timeShort(h.close_time)}
                onChange={(e) =>
                  setHours(hours.map((x, i) => i === index ? { ...x, close_time: e.target.value } : x))
                }
              />
              <input
                className="field"
                style={{ width: 105 }}
                type="time"
                disabled={h.closed}
                value={timeShort(h.last_booking_time)}
                onChange={(e) =>
                  setHours(hours.map((x, i) => i === index ? { ...x, last_booking_time: e.target.value } : x))
                }
              />
              <label className="tiny">
                <input
                  type="checkbox"
                  checked={h.closed}
                  onChange={(e) =>
                    setHours(hours.map((x, i) => i === index ? { ...x, closed: e.target.checked } : x))
                  }
                />{" "}
                fechado
              </label>
            </div>
          </div>
        ))}
        <button className="btn primary" style={{ marginTop: 12 }} onClick={saveShop}>Guardar horário</button>

        <h3 style={{ marginTop: 24 }}>Feriado / horário especial</h3>
        <div className="formGrid">
          <input className="field" type="date" value={holidayDate} onChange={(e) => setHolidayDate(e.target.value)} />
          <input className="field" placeholder="Motivo" value={holidayReason} onChange={(e) => setHolidayReason(e.target.value)} />
          <label className="tiny">
            <input type="checkbox" checked={holidayClosed} onChange={(e) => setHolidayClosed(e.target.checked)} /> Fechado neste dia
          </label>
        </div>
        <button className="btn" style={{ marginTop: 10 }} onClick={addHoliday}>Guardar dia especial</button>
      </section>

      <section className="panel">
        <h2>Horário individual</h2>
        <select className="field" value={barberId} onChange={(e) => setBarberId(e.target.value)} style={{ marginBottom: 12 }}>
          {barbers.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>

        {WEEKDAYS.map((dayName, index) => {
          const rows = barberRows.filter((r: any) => Number(r.weekday) === index + 1);
          if (!rows.length) {
            return (
              <div className="row" key={dayName}>
                <b>{dayName}</b>
                <button className="btn small" onClick={() => addSchedule(index + 1)}>Adicionar horário</button>
              </div>
            );
          }
          return rows.map((r: any) => (
            <div className="row" key={r.id}>
              <b>{dayName}</b>
              <div className="rowActions">
                <input
                  className="field"
                  style={{ width: 105 }}
                  type="time"
                  defaultValue={timeShort(r.start_time)}
                  onBlur={(e) => e.target.value !== timeShort(r.start_time) && updateSchedule(r, "start_time", e.target.value)}
                />
                <input
                  className="field"
                  style={{ width: 105 }}
                  type="time"
                  defaultValue={timeShort(r.end_time)}
                  onBlur={(e) => e.target.value !== timeShort(r.end_time) && updateSchedule(r, "end_time", e.target.value)}
                />
              </div>
            </div>
          ));
        })}
      </section>
    </div>
  );
}

function Blocks({ ctx, isAdmin, barbers, notify, refresh }: any) {
  const [barberId, setBarberId] = useState(ctx.barber_id || barbers[0]?.id || "");
  const [date, setDate] = useState(lisbonToday());
  const [start, setStart] = useState("13:00");
  const [end, setEnd] = useState("14:00");
  const [reason, setReason] = useState("Pausa");
  const [rows, setRows] = useState<any[]>([]);

  const load = useCallback(async () => {
    let query = supabase
      .from("schedule_blocks")
      .select("*, barbers(name)")
      .order("start_datetime", { ascending: false })
      .limit(100);

    if (!isAdmin && ctx.barber_id) query = query.eq("barber_id", ctx.barber_id);
    const result = await query;
    if (result.error) {
      notify(result.error.message, "error");
      return;
    }
    setRows(result.data || []);
  }, [ctx.barber_id, isAdmin, notify]);

  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    if (!barberId || !date || !start || !end || end <= start) {
      notify("Período inválido.", "error");
      return;
    }

    const startDatetime = new Date(date + "T" + start + ":00").toISOString();
    const endDatetime = new Date(date + "T" + end + ":00").toISOString();
    const result = await supabase.from("schedule_blocks").insert({
      barber_id: barberId,
      start_datetime: startDatetime,
      end_datetime: endDatetime,
      reason: reason || null,
      created_by: ctx.user_id,
    });
    if (result.error) {
      notify(result.error.message, "error");
      return;
    }
    notify("Período bloqueado.");
    await load();
    await refresh();
  }

  async function remove(id: string) {
    const result = await supabase.from("schedule_blocks").delete().eq("id", id);
    if (result.error) {
      notify(result.error.message, "error");
      return;
    }
    notify("Bloqueio removido.");
    await load();
    await refresh();
  }

  return (
    <div className="grid two">
      <section className="panel">
        <h2>Bloquear período</h2>
        <div className="formGrid">
          {isAdmin ? (
            <div className="full">
              <label className="label">Barbeiro</label>
              <select className="field" value={barberId} onChange={(e) => setBarberId(e.target.value)}>
                {barbers.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          ) : null}
          <div><label className="label">Data</label><input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div><label className="label">Motivo</label><input className="field" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          <div><label className="label">Início</label><input className="field" type="time" value={start} onChange={(e) => setStart(e.target.value)} /></div>
          <div><label className="label">Fim</label><input className="field" type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
        </div>
        <button className="btn primary" style={{ marginTop: 12 }} onClick={create}>Bloquear</button>
      </section>

      <section className="panel">
        <h2>Indisponibilidades</h2>
        {rows.map((r) => (
          <div className="row" key={r.id}>
            <div className="rowMain">
              <b>{(r.barbers?.name || "Barbeiro") + " · " + new Date(r.start_datetime).toLocaleDateString("pt-PT")}</b>
              <span>
                {new Date(r.start_datetime).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }) +
                  "–" +
                  new Date(r.end_datetime).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }) +
                  " · " +
                  (r.reason || "Bloqueado")}
              </span>
            </div>
            <button className="btn danger small" onClick={() => remove(r.id)}>Remover</button>
          </div>
        ))}
        {!rows.length ? <div className="empty">Sem bloqueios.</div> : null}
      </section>
    </div>
  );
}

function Payments({ notify }: any) {
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    supabase
      .from("payments")
      .select("*, clients(name), appointments(appointment_date,start_time,barber_id)")
      .order("paid_at", { ascending: false })
      .limit(150)
      .then(({ data, error }) => {
        if (error) notify(error.message, "error");
        else setRows(data || []);
      });
  }, [notify]);

  return (
    <section className="panel">
      <h2>Pagamentos</h2>
      <div className="tableWrap">
        <table className="table">
          <thead>
            <tr><th>Data</th><th>Cliente</th><th>Valor</th><th>Método</th><th>Estado</th><th>Referência</th></tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>{new Date(p.paid_at).toLocaleString("pt-PT")}</td>
                <td>{p.clients?.name || "—"}</td>
                <td>{money(p.amount)}</td>
                <td>{p.method}</td>
                <td>{p.status}</td>
                <td>{p.reference || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length ? <div className="empty">Sem pagamentos.</div> : null}
    </section>
  );
}
