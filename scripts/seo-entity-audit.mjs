import fs from "node:fs";

const expected = {
  name: "Pentehouse",
  alternateName: "Pente House",
  street: "Rua da Constituição 656, Loja 20",
  postalCode: "4200-194",
  phone: "+351916605673",
  placeId: "ChIJgdPqtldlJA0RcfObBuHD4rk",
  domain: "https://pentehouse.pt/"
};

const entityPages = [
  "index.html",
  "barbearia-rua-constituicao/index.html",
  "barbeiro-metro-marques/index.html",
  "penthouse-ou-pentehouse-porto/index.html",
  "todos-os-caminhos-pente-house/index.html",
  "visiting-porto/index.html"
];

const metadataPages = [
  "index.html",
  "barbearia-rua-constituicao/index.html",
  "barbeiro-metro-marques/index.html",
  "galeria/index.html",
  "penthouse-ou-pentehouse-porto/index.html",
  "perguntas/index.html",
  "todos-os-caminhos-pente-house/index.html",
  "visiting-porto/index.html"
];

const errors = [];
const read = (file) => fs.readFileSync(file, "utf8");
const requireText = (file, html, text, label) => {
  if (!html.includes(text)) errors.push(`${file}: ${label} em falta ou divergente.`);
};

for (const file of metadataPages) {
  if (!fs.existsSync(file)) {
    errors.push(`${file}: ficheiro em falta.`);
    continue;
  }
  const html = read(file);
  const canonical = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i)?.[1];
  if (!canonical || !canonical.startsWith(expected.domain)) {
    errors.push(`${file}: canonical fora de pentehouse.pt.`);
  }
  if (html.includes("Rua da Constituição 19")) {
    errors.push(`${file}: apareceu a morada conflitante "Rua da Constituição 19".`);
  }
}

for (const file of entityPages) {
  if (!fs.existsSync(file)) {
    errors.push(`${file}: página de entidade em falta.`);
    continue;
  }
  const html = read(file);
  requireText(file, html, '"@type":"HairSalon"', "schema HairSalon");
  requireText(file, html, '"name":"Pentehouse"', "nome canónico Pentehouse");
  requireText(file, html, '"alternateName":["Pente House"', "variante Pente House");
  requireText(file, html, `"streetAddress":"${expected.street}"`, "morada canónica");
  requireText(file, html, `"postalCode":"${expected.postalCode}"`, "código postal");
  requireText(file, html, `"telephone":"${expected.phone}"`, "telefone");
  requireText(file, html, expected.placeId, "Google Place ID");
  requireText(file, html, '"opens":"10:00"', "hora de abertura");
  requireText(file, html, '"closes":"18:00"', "sábado até às 18h");
}

const home = read("index.html");
requireText("index.html", home, '<meta name="application-name" content="Pentehouse">', "application-name");
requireText("index.html", home, '<meta property="og:site_name" content="Pentehouse">', "og:site_name");
requireText("index.html", home, '"latitude":41.1621674', "latitude da entidade");
requireText("index.html", home, '"longitude":-8.6058802', "longitude da entidade");

if (errors.length) {
  console.error("\nPENTEHOUSE SEO ENTITY AUDIT — FAIL");
  for (const error of errors) console.error("- " + error);
  process.exit(1);
}

console.log("PENTEHOUSE SEO ENTITY AUDIT — PASS");
console.log("Entidade: Pentehouse");
console.log("Morada: Rua da Constituição 656, Loja 20 · 4200-194 Porto");
console.log("Place ID: " + expected.placeId);
