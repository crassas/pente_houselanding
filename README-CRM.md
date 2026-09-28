# Pentehouse CRM — Loja 20

Aplicação interna da Pentehouse Barbearia. O CRM vive na branch `crm-app`; a branch `main` do site público não foi alterada.

## Stack

- Next.js + TypeScript
- Supabase/PostgreSQL persistente
- Supabase Auth
- Row Level Security
- PWA instalável, sem cache local dos dados dos clientes

## Primeiro acesso

O CRM usa registo por convite. Criar a conta com um email previamente autorizado e depois entrar. A função `claim_account` associa a conta autenticada às permissões e, quando aplicável, ao barbeiro.

Novos funcionários são convidados em **Mais → Equipa**.

## Dados e regras

A base contém:
- lojas
- perfis e papéis
- barbeiros
- clientes
- serviços e serviços por barbeiro
- marcações
- pagamentos
- horários
- bloqueios
- horários especiais
- notas internas
- etiquetas
- auditoria
- definições

A base de dados recusa sobreposição de marcações para o mesmo barbeiro, valida horário individual e bloqueios, normaliza telefones, impede duplicados por número e mantém visitas/gasto/pagamento sincronizados por funções e triggers.

## Dados de demonstração

O ambiente está preparado com:
- Rascal
- Grenha
- Bruno Waya
- 22 clientes fictícios
- 5 serviços editáveis
- horários de segunda a sábado
- marcações passadas, de hoje e futuras
- concluídas, cancelamentos e no-shows
- pagamentos em dinheiro e MB WAY

Não foram usados dados pessoais reais de clientes.

## Fluxo de aceitação

1. Login
2. Agenda
3. Ver Rascal, Grenha e Bruno Waya
4. Tocar num horário livre
5. Introduzir telefone
6. Encontrar cliente ou criar nome + telefone
7. Escolher serviço
8. Confirmar
9. Ver a marcação na agenda
10. Abrir o cliente
11. Ver a marcação no histórico
12. Concluir serviço
13. Registar pagamento
14. Confirmar actualização de histórico e dashboard

## Administração

O administrador pode gerir serviços, equipa, convites, horários da loja, horários individuais, dias especiais, bloqueios, pagamentos, estatísticas, seguimento comercial e acções RGPD.

O perfil de barbeiro fica limitado pelas políticas RLS do PostgreSQL.

## RGPD

- consentimento de marketing separado
- exportação JSON do cliente
- anonimização administrativa
- eliminação bloqueada quando há histórico que deve ser preservado
- endpoints sem acesso público aos dados
- autenticação + RLS

## Variáveis de ambiente

Em produção podem ser definidas:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

Nunca colocar uma service-role key no frontend.
