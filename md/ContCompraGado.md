> **Nota de método**: este documento descreve uma tela de um sistema LEGADO já em produção,
> reconstruída por engenharia reversa do código-fonte — não é uma especificação de feature nova
> obtida por entrevista com um PO. Por isso, toda seção que normalmente viria de uma conversa de
> negócio (motivação, métricas, objetivos) foi preenchida por **inferência a partir do
> comportamento do código**, e está marcada explicitamente como `(inferência)`. Onde nem o código
> nem o contexto do módulo permitem inferir nada com segurança, o campo está como `N/A`.
> Fonte: leitura 100% literal de `Pecuaria/ContCompraGado.pas` (494 linhas, unit
> `ContCompraGado`, classe `TfmContCompraGado`) e do `.dfm` correspondente (título confirmado
> "Contratos de Compra de Gado"), nesta sessão — 50º arquivo `.pas` lido do módulo Pecuária.
> **Tela irmã quase idêntica de `[[ContVendaGado]]`** (mesma estrutura, mesmo componente-a-
> componente), diferindo em: `GrupoComercial=7` (Compra, vs. `8`=Venda), `iGrupo=6` (vs. `7`)
> para `Previsoes`/`PainelContratos`, e — **achado central desta nota** — os papéis de `Pessoa`/
> `Produtor` nos filtros de Origem/Destino estão **trocados** em relação a `[[ContVendaGado]]`.
> CRUD real delegado a `TfmEdContCompraGado` (unit `EdContCompraGado.pas`) — lida e documentada
> integralmente em `[[EdContCompraGado]]` (sessão posterior); esta nota deixou de ser parcial.
> Ver nota de método completa (limitação de DDL/tipos de coluna) em `[[ExportaDietas]]`, válida
> para todo o módulo.

---

**Status da implementação:** Legado — em produção (documentado via engenharia reversa, sem item de trabalho associado)

**Owner (curadoria):** @jefferson.arantes
**Tags:** #Pecuaria #Contrato #Compra #Comercial

---

## 0) Resumo executivo

- **O que é:** grade de consulta "Contratos de Compra de Gado" — espelho de
  `[[ContVendaGado]]`, listando contratos comerciais de compra (`Contratos`, `GrupoComercial=7`).
- **Impacto principal:** idêntico a `[[ContVendaGado]]` — consulta apenas nesta unit; exclusão em
  cascata manual; `UPDATE ControleRecebimento`; CRUD delegado a `EdContCompraGado`.

---

## 1) Conceito — diferenças em relação a `[[ContVendaGado]]`

| Termo | Definição |
|-------|-----------|
| **Papéis de Pessoa/Produtor invertidos nos filtros** | Em `[[ContVendaGado]]`: `ceCodPessoaOrigem` filtra `C.Pessoa` (o Cliente/comprador) e `ceCodPessoaDest` filtra `C.Produtor` (rótulo "Destino" mas semanticamente o produtor vendedor). Aqui, em Compra: `ceCodPessoaOrigem` filtra `C.Produtor` (o fornecedor/vendedor de quem se compra) e `ceCodPessoaDest` filtra `C.Pessoa` — **os mesmos 2 campos da tabela `Contratos` (`Pessoa`/`Produtor`) trocam de papel semântico conforme o tipo de contrato** (Compra vs. Venda), mas os rótulos visuais na tela ("Pessoa Origem"/"Pessoa Destino") permanecem os mesmos em ambas — só o código por trás muda qual coluna cada filtro afeta. Isso é um achado importante para quem for reimplementar: o significado de `Contratos.Pessoa`/`Contratos.Produtor` é **contextual ao `GrupoComercial`**, não fixo. |
| Mensagem de busca do "Consultor" reflete o papel de Comprador | `ceCodConsultorPropertiesEditValueChanged`: "Código do Comprador Inválido." (aqui) vs. "Código do Vendedor Inválido." (em `[[ContVendaGado]]`) — mesmo campo (`Consultor`), rótulo de erro adaptado ao contexto. |
| `Tabelas.Tipo=22` filtrado por `GrupoComercial=7` em vez de `8` | Mesma tabela de Tipos de Negociação (`Tipo=22`), mas o subconjunto de negociações de Compra é diferente do de Venda. |
| `iGrupo=6` para `Previsoes`/`PainelContratos` (vs. `7` em Venda) | Confirma que essas telas genéricas do ERP distinguem os "grupos" de Compra (6) e Venda (7) de gado, além do `GrupoComercial` de `Contratos` (7/8) — 2 sistemas de codificação de grupo distintos coexistindo (`GrupoComercial` da tabela `Contratos` vs. `iGrupo` das telas `Previsoes`/`PainelContratos`). |
| Código de tela de ajuda de `ceCodPessoaDest` (F2) também diverge, além do rótulo da mensagem | **Achado desta auditoria**: `ceCodPessoaDestKeyDown` chama `edDispAjudaPessoa(ceCodPessoaDest, 'P3', 'P')` aqui (Compra) vs. `edDispAjudaPessoa(ceCodPessoaDest, 'C1', 'P')` em `[[ContVendaGado]]` — a tela de ajuda de busca de Pessoa (F2) que abre para o campo "Pessoa Destino" é literalmente diferente entre as 2 telas irmãs (`'P3'`=Produtor provavelmente, `'C1'`=Cliente), coerente com a inversão de papel Pessoa/Produtor já documentada acima. `ceCodPessoaOrigem` ('F1') e `ceCodConsultor` ('C3') usam o mesmo código de ajuda em ambas as telas — só `ceCodPessoaDest` diverge. |
| `cdsPrevisoes.Tag` também diverge (`11344` aqui vs. `11346` em Venda) | Confirmado por diff linha a linha do `.pas`; mesmo padrão de `Tag` distinto por contexto já visto em outros satélites do módulo — não afeta o comportamento funcional, é só identificador interno do relatório/consulta de Previsões associado. |

Todo o restante (estrutura da tela, exclusão em cascata, ação "Receber Docs.", atalhos de
teclado, `Situacao`/`ControleRecebimento` via `GetText`) é **idêntico** a `[[ContVendaGado]]` —
ver aquela nota para o detalhamento completo dessas seções.

---

## 2) Dicionário de campos da tela (`.dfm`)

Idêntico a `[[ContVendaGado]]`, com os filtros de Pessoa Origem/Destino mapeados aos campos
`Contratos.Produtor`/`Contratos.Pessoa` respectivamente (invertido em relação à tela de Venda).
**Confirmado nesta auditoria de profundidade** por diff linha a linha de `.pas` e `.dfm` entre as
2 telas: além da inversão de papel Pessoa/Produtor e do `GrupoComercial`/`iGrupo` já documentados,
a única outra divergência de comportamento é o código de tela de ajuda (F2) de `ceCodPessoaDest`
(ver Conceito) — nenhum controle, coluna de grid ou campo obrigatório existe em uma tela e não na
outra; o dicionário completo (todos os controles, filtros e colunas de grid, incluindo `Qtd.
Total` sem casas decimais e sem cálculo nesta unit — vem pronto de `C.TotalQtd`) está em
`[[ContVendaGado]]` seção 2. Esta tela não possui nenhuma fórmula de cálculo própria (é
grade de consulta somente leitura); os únicos valores numéricos exibidos (`Numero`, `TotalQtd`)
vêm prontos do banco, sem `RoundTo`/`Round`/`Trunc` no código Delphi desta unit.

---

## 5) Jornada do usuário + Especificação funcional

Idêntica a `[[ContVendaGado]]` (SP-01 a SP-07), com as seguintes substituições:
- `WHERE C.GrupoComercial = 7` (em vez de `8`).
- `ceCodPessoaOrigem` → filtra `C.Produtor`; `ceCodPessoaDest` → filtra `C.Pessoa` (invertido).
- `Previsoes`/`PainelContratos` abertos com `iGrupo:=6` (em vez de `7`).

### 5.3 Regras de negócio e validações

Idênticas a `[[ContVendaGado]]`.

---

## 6) Integrações e dados

### 6.1 Integrações (internas)

- **[[EdContCompraGado]]** (`TfmEdContCompraGado`) — CRUD real (lido e documentado integralmente).
- **[[Previsoes]]** (`iGrupo=6`) — satélite cross-module load-bearing, lida e documentada (grava
  Fórmulas de Previsão vinculadas ao Contrato).
- **`PainelContratos`** (`iGrupo=6`) — genérica do ERP, read-only, não investigada em profundidade.
- **`Tabelas.Tipo=22`** (`GrupoComercial=7`).
- **`ItContratosPec`**.

### 6.2 Modelo de dados

**Tabela `Contratos`** (genérica compartilhada, `GrupoComercial=7` = Compra Pecuária) — mesmos
campos de `[[ContVendaGado]]`, com `Pessoa`/`Produtor` semanticamente invertidos.

### 6.3 Triggers e Procedures do banco

Não identificadas nesta unit.

---

## 7) Suporte: FAQ, mensagens, erros e troubleshooting

### 7.2 Catálogo de mensagens e erros

| Mensagem exata | Causa |
|---|---|
| "Código da Pessoa de Origem Inválido." / "Código da Pessoa de Destino Inválido." / "Código do Comprador Inválido." | Busca de Pessoa sem correspondência |
| (demais idênticas a `[[ContVendaGado]]`) | — |

---

## 9) Notas de revisão

- **2026-09-02** (auditoria de profundidade campo-a-campo — módulo Pecuária)
  - **O que mudou:** esta tela e sua irmã `[[EdContCompraGado]]` já haviam passado por
    investigação profunda recente focada em triggers/satélites (`Contratos`/`ItContratosPec`,
    `Previsoes`) — não refeita aqui. Foco desta auditoria: dicionário de campos e fórmulas de
    cálculo. Confirmado por diff linha a linha de `.pas`/`.dfm` contra `[[ContVendaGado]]` que a
    tela é estruturalmente idêntica (nenhum controle/coluna a mais ou a menos), exceto por 2
    divergências não documentadas antes: (1) o código de tela de ajuda F2 de `ceCodPessoaDest` é
    `'P3'` aqui vs. `'C1'` em Venda; (2) `cdsPrevisoes.Tag = 11344` aqui vs. `11346` em Venda.
    Confirmado explicitamente que a tela não tem nenhuma fórmula de cálculo própria (grade de
    consulta somente leitura, valores numéricos vêm prontos do banco).
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** releitura/diff de `Pecuaria/ContCompraGado.pas` + `.dfm` contra
    `Pecuaria/ContVendaGado.pas` + `.dfm`.

- **2026-09-01** (auditoria de profundidade — módulo Pecuária, 2ª atualização)
  - **O que mudou:** achado de satélite cross-module — a tela "Previsões", antes dispensada como
    genérica, na verdade grava Fórmulas de Previsão vinculadas ao Contrato — é load-bearing. Ver
    `[[Previsoes]]`, nota criada nesta sessão.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** ver `[[Previsoes]]`.

- **2026-09-01** (auditoria de profundidade — módulo Pecuária)
  - **O que mudou:** removida a marcação de "nota parcial" — `[[EdContCompraGado]]` (CRUD real)
    já havia sido lida e documentada integralmente em sessão posterior à criação desta nota;
    apenas as referências cruzadas aqui (Status, 6.1, nota de topo) ainda não tinham sido
    atualizadas para refletir isso.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** ver `[[EdContCompraGado]]`.

- **2026-08-28** (criação da nota — módulo Pecuária)
  - **O que mudou:** nota criada do zero, a partir de leitura 100% literal de
    `Pecuaria/ContCompraGado.pas` (494 linhas) + `.dfm` (título confirmado "Contratos de Compra
    de Gado"). Documentada como tela irmã de `[[ContVendaGado]]`, com foco nas diferenças —
    achado principal: os campos `Contratos.Pessoa`/`Produtor` trocam de papel semântico entre
    Compra e Venda.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/ContCompraGado.pas` + `.dfm`; ver
    `[[ContVendaGado]]`.
