"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { addDays, lisbonToday, startOfWeek } from "./helpers";
import { Home } from "./components/Home";
import {
  Agenda,
  AppointmentModal,
  QuickBooking,
  type AgendaView,
  type QuickSeed,
} from "./components/Agenda";
import { ClientModal, Clients } from "./components/Clients";
import { More } from "./components/More";

type Section = "home" | "agenda" | "clients" | "new" | "more";
type Context = {
  user_id: string;
  email: string;
  roles: string[];
  barber_id?: string | null;
  barber_name?: string | null;
};
type Toast = { text: string; kind?: "ok" | "error" };

export default function Page() {
  const [session, setSession] = useState<Session | null>(null);
  const [ctx, setCtx] = useState<Context | null>(null);
  const [booting, setBooting] = useState(true);
  const [claimError, setClaimError] = useState("");

  const claim = useCallback(async (nextSession: Session | null) => {
    if (!nextSession) {
      setCtx(null);
      return;
    }
    const result = await supabase.rpc("claim_account");
    if (result.error) {
      setClaimError(result.error.message);
      setCtx(null);
      return;
    }
    setClaimError("");
    setCtx(result.data as Context);
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      await claim(data.session);
      if (mounted) setBooting(false);
    });

    const auth = supabase.auth.onAuthStateChange(async (_event, next) => {
      if (!mounted) return;
      setSession(next);
      await claim(next);
      if (mounted) setBooting(false);
    });

    return () => {
      mounted = false;
      auth.data.subscription.unsubscribe();
    };
  }, [claim]);

  useEffect(() => {
    if ("serviceWorker" in navigator && window.isSecureContext) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  if (booting) {
    return (
      <main className="auth">
        <div className="spinner" aria-label="A carregar" />
      </main>
    );
  }

  if (!session) return <Auth />;

  if (!ctx || !ctx.roles?.length) {
    return (
      <main className="auth">
        <div className="authCard">
          <div className="authMark">Pentehouse · Loja 20</div>
          <h1>Sem acesso</h1>
          <p>
            A conta está autenticada, mas ainda não tem convite para o CRM.
            Um administrador tem de associar este email à equipa.
          </p>
          {claimError ? <div className="error">{claimError}</div> : null}
          <button className="btn primary" onClick={() => supabase.auth.signOut()}>
            Terminar sessão
          </button>
        </div>
      </main>
    );
  }

  return <CRM ctx={ctx} />;
}

function Auth() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);

    if (password.length < 8) {
      setMessage({
        text: "A palavra-passe deve ter pelo menos 8 caracteres.",
        error: true,
      });
      setBusy(false);
      return;
    }

    const result =
      mode === "login"
        ? await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          })
        : await supabase.auth.signUp({
            email: email.trim(),
            password,
          });

    setBusy(false);

    if (result.error) {
      setMessage({ text: result.error.message, error: true });
      return;
    }

    if (mode === "signup" && !result.data.session) {
      setMessage({
        text: "Conta criada. Confirma o email e depois entra no CRM.",
      });
    }
  }

  return (
    <main className="auth">
      <form className="authCard" onSubmit={submit}>
        <div className="authMark">Pentehouse · Loja 20 · Porto</div>
        <h1>CRM</h1>
        <p>
          Agenda, clientes, pagamentos e seguimento da Pentehouse num único sítio.
        </p>

        <div className="seg">
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => setMode("login")}
          >
            Entrar
          </button>
          <button
            type="button"
            className={mode === "signup" ? "active" : ""}
            onClick={() => setMode("signup")}
          >
            Criar conta
          </button>
        </div>

        <div className="authFields">
          <div>
            <label className="label">Email da equipa</label>
            <input
              className="field"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Palavra-passe</label>
            <input
              className="field"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </div>

        {message ? (
          <div className={message.error ? "error" : "success"}>{message.text}</div>
        ) : null}

        <button
          className="btn primary"
          style={{ width: "100%", marginTop: 14 }}
          disabled={busy}
        >
          {busy
            ? "A processar…"
            : mode === "login"
              ? "Entrar no CRM"
              : "Criar conta"}
        </button>

        <p className="tiny" style={{ marginBottom: 0 }}>
          O registo não dá acesso automático. Só emails previamente convidados
          recebem permissões.
        </p>
      </form>
    </main>
  );
}

function CRM({ ctx }: { ctx: Context }) {
  const isAdmin = ctx.roles.includes("admin");
  const [section, setSection] = useState<Section>("home");
  const [barbers, setBarbers] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [barberServices, setBarberServices] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [businessHours, setBusinessHours] = useState<any[]>([]);\n  const [specialHours, setSpecialHours] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [dashboard, setDashboard] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [baseLoading, setBaseLoading] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);

  const [selectedDate, setSelectedDate] = useState(lisbonToday());
  const [agendaView, setAgendaView] = useState<AgendaView>("today");
  const [barberFilter, setBarberFilter] = useState(ctx.barber_id || "");
  const [quick, setQuick] = useState<QuickSeed | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<any | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [searchRows, setSearchRows] = useState<any[]>([]);

  const notify = useCallback((text: string, kind: Toast["kind"] = "ok") => {
    setToast({ text, kind });
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const loadBase = useCallback(async () => {
    setBaseLoading(true);

    const [b, s, bs, sc, bh, sh] = await Promise.all([
      supabase.from("barbers").select("*").order("sort_order"),
      supabase.from("services").select("*").order("sort_order"),
      supabase.from("barber_services").select("*"),
      supabase
        .from("schedules")
        .select("*")
        .eq("active", true)
        .order("weekday")
        .order("start_time"),
      supabase.from("business_hours").select("*").order("weekday"),
    ]);

    const firstError = [b.error, s.error, bs.error, sc.error, bh.error, sh.error].find(Boolean);
    if (firstError) notify(firstError.message, "error");

    setBarbers((b.data || []).filter((row: any) => row.active || isAdmin));
    setServices(s.data || []);
    setBarberServices(bs.data || []);
    setSchedules(sc.data || []);
    setBusinessHours(bh.data || []);\n    setSpecialHours(sh.data || []);
    setBaseLoading(false);
  }, [isAdmin, notify]);

  const loadDashboard = useCallback(async () => {
    const result = await supabase.rpc("dashboard_summary", {
      p_date: lisbonToday(),
    });
    if (result.error) {
      notify(result.error.message, "error");
      return;
    }
    setDashboard(result.data);
  }, [notify]);

  const agendaRange = useMemo(() => {
    if (agendaView === "week") {
      const start = startOfWeek(selectedDate);
      return [start, addDays(start, 6)] as const;
    }

    const date =
      agendaView === "today"
        ? lisbonToday()
        : agendaView === "tomorrow"
          ? addDays(lisbonToday(), 1)
          : selectedDate;

    return [date, date] as const;
  }, [agendaView, selectedDate]);

  const loadAgenda = useCallback(async () => {
    const from = agendaRange[0];
    const to = agendaRange[1];

    const ap = await supabase
      .from("appointments")
      .select(
        "*, clients(id,name,phone,normalized_phone), barbers(id,name,slug), services(id,name,duration_minutes,price)"
      )
      .gte("appointment_date", from)
      .lte("appointment_date", to)
      .order("appointment_date")
      .order("start_time");

    const startISO = new Date(from + "T00:00:00").toISOString();
    const endISO = new Date(addDays(to, 1) + "T00:00:00").toISOString();

    const bl = await supabase
      .from("schedule_blocks")
      .select("*")
      .lt("start_datetime", endISO)
      .gt("end_datetime", startISO);

    if (ap.error) notify(ap.error.message, "error");
    if (bl.error) notify(bl.error.message, "error");

    setAppointments(ap.data || []);
    setBlocks(bl.data || []);
  }, [agendaRange, notify]);

  const loadClients = useCallback(async () => {
    const result = await supabase
      .from("clients")
      .select(
        "id,name,phone,email,instagram,preferred_barber_id,first_visit_at,last_visit_at,total_visits,total_spent,marketing_consent,created_at,anonymized_at"
      )
      .is("anonymized_at", null)
      .order("last_visit_at", { ascending: false, nullsFirst: false })
      .limit(250);

    if (result.error) notify(result.error.message, "error");
    setClients(result.data || []);
  }, [notify]);

  useEffect(() => {
    loadBase();
    loadDashboard();
    loadClients();
  }, [loadBase, loadDashboard, loadClients]);

  useEffect(() => {
    loadAgenda();
  }, [loadAgenda]);

  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) {
      setSearchRows([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      const result = await supabase.rpc("search_clients", { q });
      if (!result.error) setSearchRows(result.data || []);
    }, 220);

    return () => window.clearTimeout(timer);
  }, [search]);

  const refreshCore = useCallback(async () => {
    await Promise.all([loadAgenda(), loadDashboard(), loadClients()]);
  }, [loadAgenda, loadDashboard, loadClients]);

  function openClient(id: string) {
    setSearch("");
    setSearchRows([]);
    setSelectedClientId(id);
  }

  const nav: Array<[Section, string, string]> = [
    ["home", "⌂", "Início"],
    ["agenda", "▦", "Agenda"],
    ["clients", "◉", "Clientes"],
    ["new", "+", "Marcação"],
    ["more", "•••", "Mais"],
  ];

  function navigate(id: Section) {
    if (id === "new") {
      setQuick({ date: selectedDate });
      return;
    }
    setSection(id);
  }

  if (baseLoading) {
    return (
      <main className="auth">
        <div className="spinner" />
      </main>
    );
  }

  return (
    <div className="shell">
      <aside className="desktopSide">
        <div className="brand">
          PENTEHOUSE
          <small>CRM · Loja 20</small>
        </div>
        {nav.map(([id, icon, label]) => (
          <button
            key={id}
            className={
              "sideBtn " +
              (section === id ? "active " : "") +
              (id === "new" ? "create" : "")
            }
            onClick={() => navigate(id)}
          >
            {icon} &nbsp; {label}
          </button>
        ))}
      </aside>

      <header className="topbar">
        <div className="toprow">
          <div className="brand">
            PENTEHOUSE
            <small>CRM · Loja 20</small>
          </div>

          <div className="searchWrap">
            <input
              className="search"
              placeholder="Pesquisar nome, telefone, email ou Instagram…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {searchRows.length ? (
              <div className="searchResults">
                {searchRows.map((row) => (
                  <button
                    className="searchItem"
                    key={row.id}
                    onClick={() => openClient(row.id)}
                  >
                    <span>
                      <b>{row.name}</b>
                      <div className="tiny">
                        {row.phone || row.email || row.instagram || "Cliente"}
                      </div>
                    </span>
                    <span className="tiny">
                      {row.limited
                        ? "dados limitados"
                        : String(row.total_visits || 0) + " visitas"}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="userpill">
            <i className="dot" />
            {ctx.barber_name || (isAdmin ? "Admin" : "Barbeiro")}
          </div>
        </div>
      </header>

      <main className="main">
        {section === "home" ? (
          <Home
            dashboard={dashboard}
            barbers={barbers.filter((b) => b.active)}
            onOpenAgenda={() => setSection("agenda")}
            onNew={() => setQuick({ date: lisbonToday() })}
          />
        ) : null}

        {section === "agenda" ? (
          <Agenda
            view={agendaView}
            setView={setAgendaView}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            barberFilter={barberFilter}
            setBarberFilter={setBarberFilter}
            barbers={barbers.filter((b) => b.active)}
            schedules={schedules}
            businessHours={businessHours}
            appointments={appointments}
            blocks={blocks}
            onEmpty={(seed: QuickSeed) => setQuick(seed)}
            onAppointment={setSelectedAppointment}
          />
        ) : null}

        {section === "clients" ? (
          <Clients
            clients={clients}
            barbers={barbers}
            onOpen={openClient}
            onNew={() => setQuick({ date: lisbonToday() })}
            onChanged={loadClients}
            notify={notify}
          />
        ) : null}

        {section === "more" ? (
          <More
            ctx={ctx}
            isAdmin={isAdmin}
            barbers={barbers}
            services={services}
            schedules={schedules}
            businessHours={businessHours}
            specialHours={specialHours}
            barberServices={barberServices}
            notify={notify}
            refreshBase={loadBase}
            refreshCore={refreshCore}
          />
        ) : null}
      </main>

      <nav className="bottomNav" aria-label="Navegação principal">
        {nav.map(([id, icon, label]) => (
          <button
            key={id}
            className={
              "navBtn " +
              (section === id ? "active " : "") +
              (id === "new" ? "create" : "")
            }
            onClick={() => navigate(id)}
          >
            <strong>{icon}</strong>
            {label}
          </button>
        ))}
      </nav>

      {quick ? (
        <QuickBooking
          seed={quick}
          ctx={ctx}
          barbers={barbers.filter((b) => b.active)}
          services={services}
          barberServices={barberServices}
          schedules={schedules}
          businessHours={businessHours}
          onClose={() => setQuick(null)}
          onDone={async () => {
            setQuick(null);
            setSection("agenda");
            await refreshCore();
            notify("Marcação criada.");
          }}
          notify={notify}
        />
      ) : null}

      {selectedAppointment ? (
        <AppointmentModal
          appointment={selectedAppointment}
          ctx={ctx}
          isAdmin={isAdmin}
          barbers={barbers.filter((b) => b.active)}
          services={services}
          barberServices={barberServices}
          notify={notify}
          onClient={(id: string) => {
            setSelectedAppointment(null);
            openClient(id);
          }}
          onClose={() => setSelectedAppointment(null)}
          onChanged={async (close = true) => {
            if (close) setSelectedAppointment(null);
            await refreshCore();
          }}
        />
      ) : null}

      {selectedClientId ? (
        <ClientModal
          id={selectedClientId}
          ctx={ctx}
          isAdmin={isAdmin}
          barbers={barbers}
          notify={notify}
          onClose={() => setSelectedClientId(null)}
          onChanged={refreshCore}
          onAppointment={(appointment: any) => {
            setSelectedClientId(null);
            setSelectedAppointment(appointment);
          }}
        />
      ) : null}

      {toast ? (
        <div className={"toast " + (toast.kind === "error" ? "error" : "")}>
          {toast.text}
        </div>
      ) : null}
    </div>
  );
}
