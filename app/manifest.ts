import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pentehouse CRM — Loja 20",
    short_name: "Pentehouse CRM",
    description: "Gestão interna da Pentehouse Barbearia",
    start_url: "/",
    display: "standalone",
    background_color: "#11100f",
    theme_color: "#11100f",
    lang: "pt-PT",
    orientation: "portrait-primary",
  };
}
