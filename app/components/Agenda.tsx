"use client";

import { useEffect, useMemo, useState } from "react";
import { STORE_ID, normalizePhone, supabase } from "@/lib/supabase";
import {
  STATUS,
  WEEKDAYS,
  addDays,
  addMinutes,
  formatDate,
  isoDow,
  lisbonToday,
  minutesBetween,
  money,
  startOfWeek,
  statusClass,
  timeShort,
} from "../helpers";

export type AgendaView = "today" | "tomorrow" | "week" | "barber";
export type QuickSeed = { date?: string; time?: string; barberId?: string };

export function Agenda({
  view,
  setView,
  selectedDate,
  setSelectedDate,
  barberFilter,
  setBarberFilter,
  barbers,
  schedules,
  businessHours,
  specialHours,
  appointments,
  blocks,
  onEmpty,
  onAppointment,
}: any) {
  const actualDate =
    view === "today"
      ? lisbonToday()
      : view === "tomorrow"
        ? addDays(lisbonToday(), 1)
        : selectedDate;

  useEffect(() => {
    if (view === "today") setSelectedDate(lisbonToday());
    if (view === "tomorrow") setSelectedDate(addDays(lisbonToday(), 1));
  }, [view, setSelectedDate]);

  const visibleBarbers =
    view === "barber" && barberFilter
      ? barbers.filter((b: any) => b.id === barberFilter)
      : barbers;

  return (
    <>
      <div className="sectionHead">
        <div>
          <h1>Agenda</h1>
          <p>{view === "week" ? "Semana de " + formatDate(startOfWeek(selectedDate)) : formatDate(actualDate, true)}</p>
        </div>
        <button className="btn primary" onClick={() => onEmpty({ date: actualDate, barberId: barberFilter || undefined })}>
          + Marcação
        </button>
      </div>

      <div className="toolbar">
        <div className="seg">
          {[
            ["today", "Hoje"],
            ["tomorrow", "Amanhã"],
            ["week", "Semana"],
            ["barber", "Por barbeiro"],
          ].map(([id, label]) => (
            <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}>
              {label}
            </button>
          ))}
        </div>
        {view === "week" || view === "barber" ? (
          <input className="dateInput" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
        ) : null}
        {view === "barber" ? (
          <select className="dateInput" value={barberFilter} onChange={(e) => setBarberFilter(e.target.value)}>
            <option value="">Escolher barbeiro</option>
            {barbers.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        ) : null}
      </div>

      {view === "week" ? (
        <WeekView selectedDate={selectedDate} appointments={appointments} barbers={barbers} onAppointment={onAppointment} />
      ) : (
        <DayAgenda
          date={actualDate}
          barbers={visibleBarbers}
          schedules={schedules}
          businessHours={businessHours}
          specialHours={specialHours}
          appointments={appointments.filter((a: any) => a.appointment_date === actualDate)}
          blocks={blocks}
          onEmpty={onEmpty}
          onAppointment={onAppointment}
        />
      )}
    </>
  );
}

function DayAgenda({ date, barbers, schedules, businessHours, specialHours, appointments, blocks, onEmpty, onAppointment }: any) {
  if (!barbers.length) return <div className="empty">Sem barbeiros activos.</div>;
  const day = isoDow(date);
  const shop = businessHours.find((h: any) => Number(h.weekday) === day);
  const special = specialHours?.find((h: any) => h.date === date);

  if (special?.closed || (!special && (shop?.closed || day === 7))) {
    return <div className="empty">A Pentehouse está fechada neste dia.</div>;
  }

  return (
    <div className="agendaColumns" style={barbers.length === 1 ? { gridTemplateColumns: "minmax(0, 600px)" } : undefined}>
      {barbers.map((barber: any) => {
        const rows = schedules.filter((s: any) => s.barber_id === barber.id && Number(s.weekday) === day && s.active);
        const slots: string[] = [];
        rows.forEach((row: any) => {
          const end = timeShort(row.end_time);
          let t = timeShort(row.start_time);
          while (t < end) {
            const withinSpecial =
              !special ||
              ((!special.open_time || t >= timeShort(special.open_time)) &&
                (!special.close_time || t < timeShort(special.close_time)));
            if (withinSpecial) slots.push(t);
            t = addMinutes(t, 15);
          }
        });

        const appts = appointments.filter((a: any) => a.barber_id === barber.id);
        return (
          <section className="barberCol" key={barber.id}>
            <div className="barberHeader">{barber.name}</div>
            {!slots.length ? <div className="empty" style={{ margin: 10 }}>Sem horário.</div> : null}
            {slots.map((time) => {
              const appt = appts.find((a: any) => timeShort(a.start_time) === time);
              const covered = appts.some((a: any) => {
                const start = timeShort(a.start_time);
                const end = timeShort(a.end_time);
                return time > start && time < end && a.status !== "cancelled" && a.status !== "no_show";
              });
              const slotStart = new Date(date + "T" + time + ":00");
              const slotEnd = new Date(date + "T" + addMinutes(time, 15) + ":00");
              const blocked = blocks.some((b: any) => {
                if (b.barber_id !== barber.id) return false;
                return new Date(b.start_datetime) < slotEnd && new Date(b.end_datetime) > slotStart;
              });
              const afterCutoff = Boolean(shop?.last_booking_time && time > timeShort(shop.last_booking_time));

              return (
                <div className="slot" key={time}>
                  <div className="slotTime">{time}</div>
                  <div className="slotBody">
                    {appt ? (
                      <button className={"appt " + statusClass(appt.status)} onClick={() => onAppointment(appt)}>
                        <b>{appt.clients?.name || "Cliente"}</b>
                        <span>
                          {(appt.services?.name || "Serviço") + " · " +
                            minutesBetween(timeShort(appt.start_time), timeShort(appt.end_time)) +
                            " min · " + (STATUS[appt.status] || appt.status)}
                        </span>
                      </button>
                    ) : covered ? (
                      <div className="occupiedMark">·</div>
                    ) : blocked ? (
                      <div className="occupiedMark">Bloqueado</div>
                    ) : (
                      <button
                        className="slotEmpty"
                        disabled={afterCutoff}
                        title={afterCutoff ? "Fora do limite normal de reserva" : "Criar marcação"}
                        onClick={() => onEmpty({ date, time, barberId: barber.id })}
                      >
                        {afterCutoff ? "—" : "+ livre"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}

function WeekView({ selectedDate, appointments, barbers, onAppointment }: any) {
  const start = startOfWeek(selectedDate);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <div className="weekGrid">
      {days.map((date, i) => (
        <section className="panel dayCol" key={date}>
          <div className="dayTitle">{WEEKDAYS[i] + " · " + formatDate(date)}</div>
          {barbers.map((b: any) => {
            const rows = appointments.filter((a: any) => a.appointment_date === date && a.barber_id === b.id);
            if (!rows.length) return null;
            return (
              <div key={b.id} style={{ marginBottom: 10 }}>
                <div className="tiny" style={{ marginBottom: 5 }}>{b.name}</div>
                {rows.map((a: any) => (
                  <button key={a.id} className={"appt weekAppt " + statusClass(a.status)} onClick={() => onAppointment(a)}>
                    <b>{timeShort(a.start_time) + " · " + (a.clients?.name || "Cliente")}</b>
                    <span>{(a.services?.name || "Serviço") + " · " + (STATUS[a.status] || a.status)}</span>
                  </button>
                ))}
              </div>
            );
          })}
          {!appointments.some((a: any) => a.appointment_date === date) ? <div className="tiny">Sem marcações.</div> : null}
        </section>
      ))}
    </div>
  );
}

export function QuickBooking({
  seed,
  ctx,
  barbers,
  services,
  barberServices,
  schedules,
  businessHours,
  specialHours,
  onClose,
  onDone,
  notify,
}: any) {
  const [date, setDate] = useState(seed.date || lisbonToday());
  const [time, setTime] = useState(seed.time || "10:00");
  const [barberId, setBarberId] = useState(seed.barberId || ctx.barber_id || barbers[0]?.id || "");
  const [phone, setPhone] = useState("");
  const [lookup, setLookup] = useState<any[]>([]);
  const [client, setClient] = useState<any | null>(null);
  const [newName, setNewName] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [busy, setBusy] = useState(false);

  const allowedServices = useMemo(() => {
    const links = barberServices.filter((x: any) => x.barber_id === barberId && x.active);
    const ids = new Set(links.map((x: any) => x.service_id));
    return services.filter((s: any) => s.active && (!links.length || ids.has(s.id)));
  }, [barberId, barberServices, services]);

  useEffect(() => {
    if (serviceId && !allowedServices.some((s: any) => s.id === serviceId)) setServiceId("");
  }, [allowedServices, serviceId]);

  useEffect(() => {
    const digits = normalizePhone(phone);
    setClient(null);
    if (digits.length < 3) {
      setLookup([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      const result = await supabase.rpc("search_clients", { q: phone });
      setLookup(result.data || []);
      if (digits.length >= 9) {
        const exact = (result.data || []).find((r: any) => r.normalized_phone === digits);
        if (exact) setClient(exact);
      }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [phone]);

  const selectedService = allowedServices.find((s: any) => s.id === serviceId);
  const override = barberServices.find((x: any) => x.barber_id === barberId && x.service_id === serviceId && x.active);
  const duration = Number(override?.duration_override_minutes || selectedService?.duration_minutes || 30);
  const price = Number(override?.price_override ?? selectedService?.price ?? 0);

  async function create() {
    if (!barberId || !serviceId || !date || !time) {
      notify("Escolhe hora, barbeiro e serviço.", "error");
      return;
    }
    if (!client && (!newName.trim() || normalizePhone(phone).length < 9)) {
      notify("Selecciona um cliente ou cria-o com nome e telefone válidos.", "error");
      return;
    }

    const day = isoDow(date);
    const scheduleOK = schedules.some(
      (s: any) =>
        s.barber_id === barberId &&
        Number(s.weekday) === day &&
        s.active &&
        timeShort(s.start_time) <= time &&
        timeShort(s.end_time) >= addMinutes(time, duration)
    );
    const shop = businessHours.find((h: any) => Number(h.weekday) === day);
    const special = specialHours?.find((h: any) => h.date === date);
    const specialOK =
      !special ||
      (!special.closed &&
        (!special.open_time || time >= timeShort(special.open_time)) &&
        (!special.close_time || addMinutes(time, duration) <= timeShort(special.close_time)));

    if ((special?.closed || (!special && shop?.closed)) || !scheduleOK || !specialOK) {
      notify("Este horário fica fora do horário disponível.", "error");
      return;
    }
    if (!special && shop?.last_booking_time && time > timeShort(shop.last_booking_time)) {
      notify("A hora escolhida ultrapassa o limite normal de reserva.", "error");
      return;
    }

    setBusy(true);
    let clientId = client?.id;
    if (!clientId) {
      const created = await supabase
        .from("clients")
        .insert({
          store_id: STORE_ID,
          name: newName.trim(),
          phone: phone.trim(),
          created_by: ctx.user_id,
        })
        .select("id,name,phone,normalized_phone")
        .single();

      if (created.error) {
        setBusy(false);
        notify(created.error.message.includes("duplicate") ? "Já existe um cliente com este telefone." : created.error.message, "error");
        return;
      }
      clientId = created.data.id;
    }

    const result = await supabase.from("appointments").insert({
      store_id: STORE_ID,
      client_id: clientId,
      barber_id: barberId,
      service_id: serviceId,
      appointment_date: date,
      start_time: time,
      end_time: addMinutes(time, duration),
      status: "confirmed",
      price,
      payment_status: "unpaid",
      created_by: ctx.user_id,
    });
    setBusy(false);

    if (result.error) {
      notify(
        result.error.message.includes("appointments_no_overlap")
          ? "Este barbeiro já tem uma marcação incompatível neste horário."
          : result.error.message,
        "error"
      );
      return;
    }
    await onDone();
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modalHead">
          <div><div className="tiny">Criação rápida</div><h2>Nova marcação</h2></div>
          <button className="close" onClick={onClose}>×</button>
        </div>

        <div className="formGrid">
          <div><label className="label">Data</label><input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div><label className="label">Hora</label><input className="field" type="time" step="900" value={time} onChange={(e) => setTime(e.target.value)} /></div>
          <div>
            <label className="label">Barbeiro</label>
            <select className="field" value={barberId} onChange={(e) => setBarberId(e.target.value)}>
              {barbers.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Serviço</label>
            <select className="field" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              <option value="">Escolher…</option>
              {allowedServices.map((s: any) => <option key={s.id} value={s.id}>{s.name + " · " + money(s.price)}</option>)}
            </select>
          </div>
          <div className="full">
            <label className="label">Telefone do cliente</label>
            <input className="field" inputMode="tel" placeholder="Ex.: 912 345 678" value={phone} onChange={(e) => setPhone(e.target.value)} autoFocus />
          </div>

          {lookup.length ? (
            <div className="full panel" style={{ padding: 8 }}>
              {lookup.slice(0, 5).map((r: any) => (
                <button
                  type="button"
                  className="searchItem"
                  key={r.id}
                  onClick={() => {
                    setClient(r);
                    setPhone(r.phone || phone);
                  }}
                >
                  <span><b>{r.name}</b><div className="tiny">{r.phone || "Telefone protegido"}</div></span>
                  {client?.id === r.id ? <span className="badge ok">Seleccionado</span> : null}
                </button>
              ))}
            </div>
          ) : null}

          {!client && normalizePhone(phone).length >= 9 ? (
            <div className="full">
              <label className="label">Cliente novo · nome</label>
              <input className="field" placeholder="Nome" value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
          ) : null}

          {client ? <div className="full hint">Cliente encontrado: <b>{client.name}</b>. Não é preciso preencher mais dados.</div> : null}
          {selectedService ? <div className="full hint">{duration + " min · " + money(price) + " · termina às "}<b>{addMinutes(time, duration)}</b></div> : null}
        </div>

        <div className="actions" style={{ justifyContent: "flex-end", marginTop: 16 }}>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn primary" disabled={busy} onClick={create}>{busy ? "A guardar…" : "Confirmar marcação"}</button>
        </div>
      </div>
    </div>
  );
}

export function AppointmentModal({
  appointment,
  ctx,
  isAdmin,
  barbers,
  services,
  barberServices,
  notify,
  onClient,
  onClose,
  onChanged,
}: any) {
  const [barberId, setBarberId] = useState(appointment.barber_id);
  const [serviceId, setServiceId] = useState(appointment.service_id);
  const [date, setDate] = useState(appointment.appointment_date);
  const [time, setTime] = useState(timeShort(appointment.start_time));
  const [status, setStatus] = useState(appointment.status);
  const [notes, setNotes] = useState(appointment.notes || "");
  const [busy, setBusy] = useState(false);
  const [payAmount, setPayAmount] = useState(String(appointment.price || ""));
  const [payMethod, setPayMethod] = useState("cash");

  const links = barberServices.filter((x: any) => x.barber_id === barberId && x.active);
  const ids = new Set(links.map((x: any) => x.service_id));
  const allowed = services.filter((s: any) => s.active && (!links.length || ids.has(s.id)));
  const svc = services.find((s: any) => s.id === serviceId);
  const override = barberServices.find((x: any) => x.barber_id === barberId && x.service_id === serviceId);
  const duration = Number(override?.duration_override_minutes || svc?.duration_minutes || 30);
  const price = Number(override?.price_override ?? svc?.price ?? appointment.price ?? 0);

  async function save(nextStatus = status, close = true) {
    setBusy(true);
    const result = await supabase
      .from("appointments")
      .update({
        barber_id: barberId,
        service_id: serviceId,
        appointment_date: date,
        start_time: time,
        end_time: addMinutes(time, duration),
        status: nextStatus,
        price,
        notes: notes.trim() || null,
      })
      .eq("id", appointment.id);
    setBusy(false);

    if (result.error) {
      notify(result.error.message.includes("appointments_no_overlap") ? "Conflito: o barbeiro já tem marcação neste período." : result.error.message, "error");
      return false;
    }
    setStatus(nextStatus);
    notify("Marcação actualizada.");
    await onChanged(close);
    return true;
  }

  async function pay() {
    const amount = Number(payAmount.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      notify("Valor de pagamento inválido.", "error");
      return;
    }
    setBusy(true);
    const result = await supabase.rpc("register_payment", {
      p_appointment_id: appointment.id,
      p_amount: amount,
      p_method: payMethod,
      p_reference: null,
    });
    setBusy(false);
    if (result.error) {
      notify(result.error.message, "error");
      return;
    }
    notify("Pagamento registado.");
    await onChanged(true);
  }

  const statusActions = [
    ["confirmed", "Confirmar"],
    ["arrived", "Chegou"],
    ["in_progress", "Iniciar"],
    ["completed", "Concluir"],
    ["no_show", "Falta"],
    ["cancelled", "Cancelar"],
  ];

  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modalHead">
          <div>
            <div className="tiny">{formatDate(appointment.appointment_date, true) + " · " + timeShort(appointment.start_time)}</div>
            <h2>{appointment.clients?.name || "Marcação"}</h2>
          </div>
          <button className="close" onClick={onClose}>×</button>
        </div>

        <div className="actions" style={{ marginBottom: 14 }}>
          <span className={"badge " + (status === "completed" ? "ok" : status === "no_show" || status === "cancelled" ? "danger" : "warn")}>
            {STATUS[status] || status}
          </span>
          {appointment.clients?.id ? <button className="btn small" onClick={() => onClient(appointment.clients.id)}>Abrir cliente</button> : null}
        </div>

        <div className="formGrid">
          <div><label className="label">Data</label><input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div><label className="label">Hora</label><input className="field" type="time" step="900" value={time} onChange={(e) => setTime(e.target.value)} /></div>
          <div>
            <label className="label">Barbeiro</label>
            <select className="field" value={barberId} onChange={(e) => setBarberId(e.target.value)}>
              {barbers.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Serviço</label>
            <select className="field" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              {allowed.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="full hint">{duration + " min · " + money(price) + " · termina às " + addMinutes(time, duration)}</div>
          <div className="full">
            <label className="label">Notas da marcação</label>
            <textarea
              className="field"
              placeholder="Nota interna opcional"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="actions" style={{ marginTop: 14 }}>
          <button className="btn" disabled={busy} onClick={() => save(status, true)}>Guardar alterações</button>
          {statusActions.map(([id, label]) => (
            <button
              key={id}
              className={"btn small " + (id === "completed" ? "ok" : id === "cancelled" || id === "no_show" ? "danger" : "")}
              disabled={busy || status === id}
              onClick={() => save(id, id !== "completed")}
            >
              {label}
            </button>
          ))}
        </div>

        {status === "completed" && appointment.payment_status !== "paid" ? (
          <section className="panel" style={{ marginTop: 16 }}>
            <h3>Registar pagamento</h3>
            <div className="formGrid">
              <div><label className="label">Valor</label><input className="field" inputMode="decimal" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} /></div>
              <div>
                <label className="label">Método</label>
                <select className="field" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                  <option value="cash">Dinheiro</option>
                  <option value="mbway">MB WAY</option>
                  <option value="card">Cartão</option>
                  <option value="transfer">Transferência</option>
                  <option value="other">Outro</option>
                </select>
              </div>
            </div>
            <button className="btn primary" style={{ marginTop: 10 }} disabled={busy} onClick={pay}>Registar pagamento</button>
          </section>
        ) : null}

        {appointment.payment_status === "paid" ? <div className="success" style={{ marginTop: 14 }}>Pagamento concluído.</div> : null}
        {!isAdmin && appointment.barber_id !== ctx.barber_id ? <p className="tiny">As permissões são sempre validadas pela base de dados.</p> : null}
      </div>
    </div>
  );
}
