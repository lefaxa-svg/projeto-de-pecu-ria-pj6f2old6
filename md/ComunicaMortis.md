> **Nota de método**: este documento descreve uma tela de um sistema LEGADO já em produção,
> reconstruída por engenharia reversa do código-fonte — não é uma especificação de feature nova
> obtida por entrevista com um PO. Por isso, toda seção que normalmente viria de uma conversa de
> negócio (motivação, métricas, objetivos) foi preenchida por **inferência a partir do
> comportamento do código**, e está marcada explicitamente como `(inferência)`. Onde nem o código
> nem o contexto do módulo permitem inferir nada com segurança, o campo está como `N/A`.
> Fonte: leitura 100% literal de `Pecuaria/ComunicaMortis.pas` (633 linhas, unit
> `ComunicaMortis`, classe `TfmComunicaMortis`) e do `.dfm` correspondente (título confirmado
> "Comunicado de Mortes dos Animais"), nesta sessão — 63º arquivo `.pas` lido do módulo Pecuária.
> Trabalha sobre a tabela **`RegMortesPec`** (registro individual de morte) — CRUD real e origem
> confirmados em `[[MorteAnimaisPec]]` (sessão posterior). **Não aparece no mapa de menu
> `[[iniModuloPecuaria]]`** — é aberta via propriedade pública `iComunicInicial` (filtro de
> Comunicado pré-selecionado); confirmado como tela satélite acessada pelo botão "Gerar
> Comunicados" de `[[MorteAnimaisPec]]`. Ver nota de método completa (limitação de DDL/tipos de coluna) em
> `[[ExportaDietas]]`, válida para todo o módulo.

---

**Status da implementação:** Legado — em produção (documentado via engenharia reversa, sem item de trabalho associado)

**Owner (curadoria):** @jefferson.arantes
**Tags:** #Pecuaria #Morte #Comunicado #Regulatorio

---

## 0) Resumo executivo

- **O que é:** tela de **agrupamento de registros de morte de animais em "Comunicados"** — um
  Comunicado é um lote/protocolo formal (numerado sequencialmente, `RegMortesPec.Comunicado`) que
  agrupa N mortes ocorridas no período, provavelmente para fins de comunicação regulatória (GTA/
  SISBOV — o relatório impresso inclui NIRF/INCRA/CNPJ/IE, campos típicos de documentação fiscal/
  regulatória rural) a um órgão externo ou ao proprietário do gado.
- **2 grades lado a lado, "Mortes sem Comunicado" e "Mortes do Comunicado selecionado"**: o
  usuário cria um novo Comunicado (`btnIncluirClick`) ou seleciona um existente, e move mortes
  entre as 2 grades via duplo-clique (adicionar) / duplo-clique na grade do Comunicado (remover
  — desvincula, não exclui a morte em si).
- **Origem do Proprietário no relatório é configurável por Comunicado**: um checkbox
  (`cbProp`/`OrigemProp`) alterna entre usar os dados fiscais da **Fazenda do Retiro** (padrão)
  ou os dados fiscais de uma **Fazenda do Proprietário do gado** (`FazProp`, selecionável) — útil
  quando o gado do Comunicado pertence a um Proprietário/Parceria diferente da Fazenda física.
- **Impacto principal:** `INSERT RegMortesPec` (via `LoadSequencia`, apenas o "número" do
  Comunicado — os registros de morte individuais já existem, só são vinculados);
  `UPDATE RegMortesPec.Comunicado`/`OrigemProp`/`FazProp` (vincular/desvincular mortes);
  impressão do Comunicado (`.rtm`).

---

## 1) Conceito

| Termo | Definição |
|-------|-----------|
| "Criar Comunicado" na verdade só reserva um número | `btnIncluirClick`: `LoadSequencia('RegMortesPec', 'Comunicado')` gera o próximo número e insere 1 linha auxiliar em `dmConsulta.cdsAux2` (dataset auxiliar da combo, não a tabela real) — **nenhuma linha é inserida em `RegMortesPec`** neste momento; o Comunicado só "existe de fato" quando a 1ª morte é vinculada a ele via duplo-clique. |
| Trava de edição não salva (`btnGravar.Enabled`) como guarda universal | Praticamente toda ação (trocar de Comunicado, criar novo, fechar a tela) primeiro verifica `btnGravar.Enabled` (há alterações de `OrigemProp`/`FazProp` pendentes no Comunicado atual) e pede confirmação antes de prosseguir — um padrão de "dirty flag" mais explícito que o normal do módulo (a maioria das telas usa `dsInsert`/`dsEdit` diretamente; aqui há uma flag de UI dedicada). |
| Alternar "Origem Proprietário" marca o Comunicado inteiro como alterado, não só a mudança local | `cbPropPropertiesEditValueChanged`/`cbFazPropPropertiesEditValueChanged`: ao mudar a opção, **todas as linhas do grid `cdsComunicado`** recebem o novo `OrigemProp`/`FazProp` de uma vez no `btnGravarClick` (loop `First..Next`) — não é uma edição por linha, é uma reconfiguração de todo o Comunicado. |
| Impressão usa `LoadRTMCliente` em vez do padrão `_sPathReport + '...'` direto | Único ponto desta unit (e um dos poucos do módulo até aqui) que passa o caminho do template por uma função de resolução (`LoadRTMCliente`) — sugere suporte a template customizado por cliente/instalação, mecanismo não detalhado nesta sessão (achado/dúvida, função não lida). |

---

## 2) Dicionário de campos da tela (`.dfm`)

| Controle | Classe | Rótulo/Caption | Vinculado a (campo BD) | Obrigatório | Observações |
|---|---|---|---|---|---|
| `lblFazenda` | `TcxLabel` | (cabeçalho "Fazenda") | somente leitura, texto montado pelo `FormBase`/chamador | — | Contexto herdado do formulário-pai; não editável nesta tela. |
| `lblRetiro` | `TcxLabel` | (cabeçalho "Retiro") | somente leitura, `.Tag` guarda o `Retiros.Sequencial` usado em TODOS os filtros SQL da tela (`L.Retiro = lblRetiro.Tag`) | — | Contexto herdado do formulário-pai; não editável nesta tela. |
| `deInicio`/`deFinal` | `TcxDateEdit` | (grupo Período) | `RegMortesPec.Data` (filtro, só grade "sem Comunicado") | — | — |
| `cbNecropsia` | `TcxComboBox` | — | `RegMortesPec.Necropsia` (filtro) | — | Itens fixos: "..:: TODAS ::..", "SIM", "NÃO". |
| `cbCausa` | `TcxLookupComboBox` | — | `RegMortesPec.CausaMortis` (Tipo=180) | — | `ListSource=dmPecuaria.dsCausaMortis`, `KeyFieldNames='Codigo'`. |
| `cbDestino` | `TcxLookupComboBox` | — | `RegMortesPec.Destino` (Tipo=202) | — | `ListSource=dmPecuaria.dsDestMorte`, `KeyFieldNames='Codigo'`. |
| `cbLotesBaias` | `TcxLookupComboBox` | — | `LotesBaias.Lote` (filtro) | — | `ListSource=dmPecuaria.dsLotes`, lista mostra Descrição + Código. |
| `ceProp` | `TcxCurrencyEdit` | — | `SubGruposLotes.Proprietario` (filtro, campo `Codigo` de `Pessoas`) | — | F2 abre ajuda de Pessoa (`edDispAjudaPessoa`); não aceita negativo na prática (é código de pessoa, filtro só aplica se `> 0`); `DisplayFormat`/`EditFormat = '0'` (sem casas decimais, sem arredondamento explícito — é um inteiro digitado). |
| `lblProp` | `TcxLabel` | "..:: TODOS ::.." (padrão) | somente leitura — nome do Proprietário resolvido a partir de `ceProp` via `BuscaPessoa` | — | `Enabled=False`; atualizado em `cePropPropertiesEditValueChanged`; mostra "..:: TODOS ::.." quando `ceProp=0`, senão o nome retornado por `BuscaPessoa`, ou dispara "Código do Propriet��rio Inválido." se a busca não retornar linhas. |
| `cbComunicado` | `TcxLookupComboBox` | — | `RegMortesPec.Comunicado` | — | Desabilitado enquanto há edição pendente (`btnGravar.Enabled=True`); lista vem de `dmConsulta.cdsAux2` (dataset auxiliar populado por SELECT DISTINCT de Comunicados, não é lookup direto em tabela). |
| Grid `gdMortes` (`gdMortesTabela`) | `TcxGridDBTableView` | Seq./Data/U.O./Lote/Brinco/Destino/Causa Mortis/Necropsia/Proprietário | `cdsMortes` (mortes sem Comunicado) | — | Coluna `Sequencial` ("Seq.") é a PK/chave de navegação (`KeyFieldNames='Sequencial'`), presente na grade mas omitida da versão anterior deste dicionário. Duplo-clique adiciona ao Comunicado selecionado (`gdMortesTabelaDblClick`). Coluna `NomeProp` ("Proprietário") tem `Visible=False` fixo no `.dfm` — nunca aparece como coluna visível; seu único papel é `GroupIndex`, alternado em runtime entre `0` (agrupa por Proprietário, quando `cbProp` marcado) e `-1` (sem agrupamento) por `cbPropPropertiesEditValueChanged`. Menu de contexto `pmSComunicado` ("Adicionar ao Comunicado"). |
| Grid `gdComunicado` (`gdComunicadoTabela`) | `TcxGridDBTableView` | (mesmas colunas: Seq./Data/U.O./Lote/Brinco/Destino/Causa Mortis/Necropsia/Proprietário) | `cdsComunicado` (mortes do Comunicado selecionado) | — | Mesmo padrão de coluna `Sequencial` chave e `NomeProp` oculta/agrupadora do grid acima. Duplo-clique remove do Comunicado (`gdComunicadoTabelaDblClick`). Menu de contexto `pmComunicado` ("Remover do Comunicado"). |
| `cbProp` | `TcxCheckBox` | "Prop." | `RegMortesPec.OrigemProp` (aplicado em massa ao Comunicado, não campo a campo) | — | `NullStyle=nssUnchecked` (não tem estado indeterminado); ao mudar, ativa a guarda `btnGravar.Enabled:=True` e alterna `GroupIndex` das colunas `NomeProp` nas 2 grades. Ver Conceito. |
| `cbFazProp` | `TcxLookupComboBox` | "Faz. Proprietário" | `RegMortesPec.FazProp` (aplicado em massa ao Comunicado) | — | `Enabled` segue `cbProp.Checked`; lista (`ListSource=dmConsulta.cdsUnidNeg`) é recarregada a cada troca de Comunicado/`cbProp`, filtrada por `DetPessoas` do Proprietário do Comunicado atual (`WHERE Codigo = cdsComunicado.Proprietario`). Ao mudar, também ativa a guarda `btnGravar.Enabled:=True`. |
| `btnIncluir` | `TcxButton` | — | — | — | Cria novo número de Comunicado (não persiste em `RegMortesPec`, ver Conceito). |
| `btnGravar` | `TcxButton` | — | — | — | `Enabled=False` por padrão no `.dfm`; persiste `OrigemProp`/`FazProp` em massa em todas as linhas do Comunicado atual. |
| `btnImprimir` | `TcxButton` | — | — | — | — |
| `btnConsulta` | `TcxButton` | "Consultar" | — | — | Reexecuta a consulta de "Mortes sem Comunicado" com os filtros atuais; primeiro passa pela guarda de edição pendente. |
| `mmQuery` | `TcxMemo` | — | — | Oculto por padrão (`Visible=False`) | Painel de debug — Ctrl+F9 alterna visibilidade (`FormKeyDown`); só é populado em `btnImprimirClick` (`mmQuery.Lines:= S`), nas demais consultas fica vazio. |

**Nota sobre fórmulas de cálculo:** esta tela não possui nenhum campo de cálculo monetário/percentual/peso — é uma tela de vinculação de registros (mortes ↔ Comunicado) e impressão. O único campo numérico de entrada do usuário é `ceProp` (código do Proprietário, filtro de busca), sem arredondamento aplicável e sem aceitação de negativo relevante (filtro só é aplicado quando `> 0`). `DateDiff(Month, B.Nascimento, M.Data)` no relatório (idade em meses) é cálculo em SQL puro, sem `RoundTo`/`Round`/`Trunc` explícito no Delphi (a truncagem para meses inteiros é inerente ao `DateDiff` do SQL Server).

---

## 5) Jornada do usuário + Especificação funcional

### SP-01 — Abrir a tela (`FormShow`)
Carrega Comunicados existentes do Retiro; consulta mortes sem Comunicado; seleciona o Comunicado
mais recente ou o recebido via `iComunicInicial` (propriedade pública setada pelo chamador).

### SP-02 — Consultar mortes sem Comunicado (`btnConsultaClick`)
Guarda universal de edição pendente (ver Conceito); `SELECT RegMortesPec (Comunicado IS
NULL/≤0)` com filtros de tela.

### SP-03 — Criar novo Comunicado (`btnIncluirClick`) → gera número via `LoadSequencia`

### SP-04 — Trocar Comunicado selecionado (`cbComunicadoPropertiesEditValueChanged`)
Recarrega a grade do Comunicado; sincroniza `cbProp`/`cbFazProp` com o valor predominante do
Comunicado (`Locate('OrigemProp','S',...)`).

### SP-05 — Adicionar morte ao Comunicado (duplo-clique em `gdMortes`)
Bloqueia se há edição pendente; bloqueia se `cbProp` marcado e o Proprietário da morte
selecionada difere do Proprietário já presente no Comunicado ("Selecione Mortes do mesmo
Proprietário do Comunicado."); senão vincula (`UPDATE Comunicado`/`OrigemProp`/`FazProp`).

### SP-06 — Remover morte do Comunicado (duplo-clique em `gdComunicado`)
Desvincula (`Comunicado:=NULL`, `OrigemProp:='N'`, `FazProp:=NULL`).

### SP-07 — Gravar alterações de Origem do Proprietário (`btnGravarClick`)
Aplica `OrigemProp`/`FazProp` em massa a todas as linhas do Comunicado atual.

### SP-08 — Imprimir (`btnImprimirClick`)
Exige Comunicado com mortes; monta relatório com dados fiscais (CNPJ/IE/NIRF/INCRA) da Fazenda do
Retiro ou do Proprietário (conforme `cbProp`), Causa Mortis, Destino, idade em meses, SISBOV.

### 5.3 Regras de negócio e validações

- **BR-001 — Edição pendente bloqueia troca/criação/fechamento** até salvar ou descartar (ver
  Conceito).
- **BR-002 — Homogeneidade de Proprietário no Comunicado** (quando `cbProp` marcado): todas as
  mortes de um Comunicado devem ser do mesmo Proprietário.
- **BR-003 — Impressão exige Comunicado com mortes vinculadas.** Mensagem: "Crie um Novo
  Comunicado e adicone as mortes para imprimir." (nota: erro de digitação no original,
  "adicone").

---

## 6) Integrações e dados

### 6.1 Integrações (internas)

- **[[MorteAnimaisPec]]** — CRUD real de `RegMortesPec` e chamadora confirmada desta tela (botão
  "Gerar Comunicados" → `iComunicInicial`), lida e documentada integralmente.

### 6.2 Modelo de dados

**Tabela `RegMortesPec`** (campos confirmados nesta unit):

| Campo | Tipo (inferido) | Observações |
|---|---|---|
| `Sequencial` | Integer | PK. |
| `Comunicado` | Integer (nullable) | Número do Comunicado (gerado via `LoadSequencia`); `NULL`/≤0 = sem Comunicado. |
| `SubGrupo` | Integer | FK `SubGruposLotes.Sequencial`. |
| `Brinco` | Integer | FK `BrincosIndividuais.Sequencial`. |
| `Data` | DateTime | Data da morte. |
| `Destino` | Integer | FK `Tabelas.Tipo=202`. |
| `CausaMortis` | Integer | FK `Tabelas.Tipo=180`. |
| `Necropsia` | String(1) | `'S'`/`'N'`. |
| `OrigemProp` | String(1) | `'S'`=usa dados fiscais do Proprietário / `'N'`=usa dados da Fazenda do Retiro. |
| `FazProp` | Integer (nullable) | FK `DetPessoas.Sequencial` (Fazenda do Proprietário, quando `OrigemProp='S'`). |
| `Observacoes` | String | — |

### 6.3 Triggers e Procedures do banco

Nenhuma identificada nesta unit.

---

## 7) Suporte: FAQ, mensagens, erros e troubleshooting

### 7.2 Catálogo de mensagens e erros

| Mensagem exata | Causa |
|---|---|
| "Existem alterações no Comunicado que não foram Salvas. Deseja cancelar as alterações?" | Guarda universal de edição pendente |
| "Selecione Mortes do mesmo Proprietário do Comunicado." | Heterogeneidade de Proprietário ao adicionar |
| "Existem alterações no Comunicado que não foram Salvas. Salve as alterações antes de incluir novas mortes." | Tentativa de adicionar com edição pendente |
| "Clique 2x nas mortes sem comunicado para adicionar ao novo comunicado." | Instrução após criar novo Comunicado |
| "Crie um Novo Comunicado e adicone as mortes para imprimir." | Impressão sem Comunicado válido |
| "Código do Proprietário Inválido." | Busca de Pessoa sem correspondência |

---

## 9) Notas de revisão

- **2026-09-02** (auditoria de profundidade campo-a-campo — módulo Pecuária)
  - **O que mudou:** releitura completa de `.pas` (633 linhas) e `.dfm` (1560 linhas). Gaps
    reais encontrados e corrigidos na seção 2: coluna `Sequencial`/"Seq." (chave de navegação)
    faltava nas 2 grades; coluna `NomeProp`/"Proprietário" existe nas 2 grades mas com
    `Visible=False` fixo — seu papel real é só `GroupIndex` alternado em runtime, não
    documentado antes; rótulo `lblProp` (nome do Proprietário resolvido via `BuscaPessoa`) não
    estava no dicionário; rótulos de contexto `lblFazenda`/`lblRetiro` (somente leitura,
    `lblRetiro.Tag` é usado em todos os filtros SQL da tela) não estavam documentados;
    `btnConsulta` não tinha linha própria; origem/comportamento de `ListSource` de
    `cbCausa`/`cbDestino`/`cbLotesBaias`/`cbFazProp` detalhada. Adicionada nota explícita
    confirmando que a tela não tem cálculo monetário/percentual (logo não há arredondamento a
    documentar) — o único cálculo é `DateDiff(Month,...)` em SQL puro no relatório impresso.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** releitura de `Pecuaria/ComunicaMortis.pas` + `.dfm`.

- **2026-09-01** (auditoria de profundidade — módulo Pecuária)
  - **O que mudou:** confirmado via `[[MorteAnimaisPec]]` (lida e documentada integralmente em
    sessão posterior) que esta tela é satélite acessada pelo botão "Gerar Comunicados" daquela, e
    que `RegMortesPec` tem seu CRUD real ali — as dúvidas/pendências de confirmação registradas na
    criação desta nota estão resolvidas.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** ver `[[MorteAnimaisPec]]`.

- **2026-08-28** (criação da nota — módulo Pecuária)
  - **O que mudou:** nota criada do zero, a partir de leitura 100% literal de
    `Pecuaria/ComunicaMortis.pas` (633 linhas) + `.dfm` (título confirmado "Comunicado de Mortes
    dos Animais"). Documentado o agrupamento de mortes em Comunicados regulatórios, a guarda
    universal de edição pendente, e a origem fiscal configurável (Fazenda do Retiro vs. Fazenda
    do Proprietário). Introduzida a tabela `RegMortesPec` (nova nesta sessão).
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/ComunicaMortis.pas` + `.dfm`.
