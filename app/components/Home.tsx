"use client";

import { formatDate, lisbonToday, money } from "../helpers";

export function Home({
  dashboard,
  barbers,
  onOpenAgenda,
  onNew,
}: {
  dashboard: any;
  barbers: any[];
  onOpenAgenda: () => void;
  onNew: () => void;
}) {
  const today = dashboard?.today || {};
  const week = dashboard?.week || {};
  const barberRows = dashboard?.barbers_today || [];

  const metrics: Array<[string, any]> = [
    ["Marcações", today.appointments ?? "—"],
    ["Atendidos", today.completed ?? "—"],
    ["Próximos", today.upcoming ?? "—"],
    ["Vagas livres", dashboard?.free_slots_today ?? "—"],
    ["Faltas", today.no_shows ?? "—"],
    ["Cancelamentos", today.cancelled ?? "—"],
    ["Receita", dashboard?.revenue_today == null ? "—" : money(dashboard.revenue_today)],
  ];

  return (
    <>
      <div className="sectionHead">
        <div>
          <h1>Hoje</h1>
          <p>{formatDate(lisbonToday(), true)} · Loja 20</p>
        </div>
        <div className="actions">
          <button className="btn" onClick={onOpenAgenda}>Abrir agenda</button>
          <button className="btn primary" onClick={onNew}>+ Marcação</button>
        </div>
      </div>

      <div className="grid metrics">
        {metrics.map(([label, value]) => (
          <div className="metric" key={label}>
            <span>{label}</span>
            <b>{value}</b>
          </div>
        ))}
      </div>

      <div className="grid two" style={{ marginTop: 12 }}>
        <section className="panel">
          <h2>Esta semana</h2>
          <div className="grid three">
            <div><span className="tiny">Marcações</span><h3>{week.appointments ?? "—"}</h3></div>
            <div><span className="tiny">Receita</span><h3>{week.revenue == null ? "—" : money(week.revenue)}</h3></div>
            <div><span className="tiny">Novos</span><h3>{week.new_clients ?? "—"}</h3></div>
          </div>
          <div className="row">
            <div className="rowMain">
              <b>Clientes recorrentes</b>
              <span>Atendidos esta semana que já tinham histórico.</span>
            </div>
            <b>{week.returning_clients ?? "—"}</b>
          </div>
        </section>

        <section className="panel">
          <h2>Barbeiros · hoje</h2>
          {barbers.map((barber) => {
            const stat = barberRows.find((x: any) => x.barber_id === barber.id) || {};
            const occ = Math.max(0, Math.min(100, Number(stat.occupancy || 0)));
            return (
              <div className="barberStat" key={barber.id}>
                <div>
                  <div className="barberName">{barber.name}</div>
                  <div className="tiny">{stat.appointments || 0} marcações · {stat.served || 0} atendidos</div>
                </div>
                <div>
                  <div className="tiny" style={{ textAlign: "right", marginBottom: 5 }}>{occ}%</div>
                  <div className="progress"><i style={{ width: String(occ) + "%" }} /></div>
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </>
  );
}
