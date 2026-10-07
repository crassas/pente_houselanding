import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        constituicao: resolve(__dirname, "barbearia-rua-constituicao/index.html"),
        metroMarques: resolve(__dirname, "barbeiro-metro-marques/index.html"),
        caminhos: resolve(__dirname, "todos-os-caminhos-pente-house/index.html"),
        visitingPorto: resolve(__dirname, "visiting-porto/index.html"),
        english: resolve(__dirname, "en/index.html"),
        penthouseOuPentehouse: resolve(__dirname, "penthouse-ou-pentehouse-porto/index.html"),
        perguntas: resolve(__dirname, "perguntas/index.html"),
        galeria: resolve(__dirname, "galeria/index.html")
      }
    }
  }
});
