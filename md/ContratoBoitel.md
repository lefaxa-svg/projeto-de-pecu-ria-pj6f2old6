> **Nota de método**: este documento descreve uma tela de um sistema LEGADO já em produção,
> reconstruída por engenharia reversa do código-fonte — não é uma especificação de feature nova
> obtida por entrevista com um PO. Por isso, toda seção que normalmente viria de uma conversa de
> negócio (motivação, métricas, objetivos) foi preenchida por **inferência a partir do
> comportamento do código**, e está marcada explicitamente como `(inferência)`. Onde nem o código
> nem o contexto do módulo permitem inferir nada com segurança, o campo está como `N/A`.
> Fonte: leitura 100% literal de `Pecuaria/ContratoBoitel.pas` (616 linhas, unit
> `ContratoBoitel`, classe `TfmContratoBoitel`) e do `.dfm` correspondente (título confirmado
> "Contratos de Boitel"), nesta sessão — 57º arquivo `.pas` lido do módulo Pecuária. **Achado
> central:** usa a tabela genérica **`Contratos`** (`GrupoComercial = 9` — 3º valor de
> `GrupoComercial` catalogado no módulo, após `7`=Compra em `[[ContCompraGado]]` e `8`=Venda em
> `[[ContVendaGado]]`) **JOIN `ItContratosPec`** — a mesma tabela de detalhe usada por
> `[[ContratoCVGado]]`, mas ali referenciando `ContratosPec.Sequencial` (tabela própria, não
> `Contratos`) — ver achado de possível colisão de FK em 1. CRUD real
> delegado a `TfmEdContratoBoitel` (unit `EdContratoBoitel.pas`) — lida e documentada
> integralmente em `[[EdContratoBoitel]]` (sessão posterior), que confirma o achado de FK
> compartilhada sem discriminador visível. Botão "Fechar Contratos" resolvido por
> `[[FechContratos]]` (também lida e documentada integralmente). Ver nota de método completa (limitação de DDL/tipos de coluna) em
> `[[ExportaDietas]]`, válida para todo o módulo.

---

**Status da implementação:** Legado — em produção (documentado via engenharia reversa, sem item de trabalho associado)

**Owner (curadoria):** @jefferson.arantes
**Tags:** #Pecuaria #Contrato #Boitel #Comercial

---

## 0) Resumo executivo

- **O que é:** grade de consulta "Contratos de Boitel" — contratos de recebimento de gado de
  terceiros para confinamento (modalidade "Boitel", ver `[[LotesBaias]].ModNegocio='B'`),
  gravados na tabela genérica `Contratos` (`GrupoComercial=9`), com detalhe em `ItContratosPec`.
- **3 ações adicionais** além do CRUD padrão: **"Painel"** (abre `TfmPainelContratos`,
  `iGrupo:=8`, tela genérica do ERP já referenciada por `[[ContVendaGado]]`/`[[ContCompraGado]]`
  com `iGrupo=6/7` — aqui reaproveitada com um 3º valor de `iGrupo` para Boitel); **"Fechar
  Contratos"** (abre `TfmFechContratos`, tela satélite não processada, de "fechamento" do
  contrato — provável baixa/encerramento formal); **"Imprimir"** (gera um `.doc` do Word via
  automação OLE, substituindo marcadores `<Campo>` por valores do contrato — modelo de "mala
  direta" clássico, não um relatório `.rtm` como o resto do módulo).
- **Impacto principal:** `DELETE Contratos` + `DELETE ItContratosPec` em cascata manual (sem
  validação de vínculo prévio, diferente de `[[ContratoCVGado]]`/`[[DadosAbate]]` — ver achado de
  risco); geração de documento `.doc` externo via automação do MS Word (efeito colateral fora do
  banco de dados).

---

## 1) Conceito

| Termo | Definição |
|-------|-----------|
| **Achado de risco — `ItContratosPec` compartilhada entre 2 espaços de PK distintos.** | Aqui: `ItContratosPec.Contrato` referencia `Contratos.Sequencial` (`WHERE C.GrupoComercial=9`). Em `[[ContratoCVGado]]`: `ItContratosPec.Contrato` referencia `ContratosPec.Sequencial` (tabela totalmente diferente). Se `Contratos.Sequencial` e `ContratosPec.Sequencial` não forem espaços de numeração mutuamente exclusivos (ex.: sequences independentes que podem gerar o mesmo número), **um registro de `ItContratosPec` pode ficar ambíguo** quanto a qual tabela-pai ele pertence — risco de dado cruzado silenciosamente incorreto se algum relatório/consulta futura filtrar `ItContratosPec` sem o `JOIN` correto de desambiguação. **Confirmado em `[[EdContratoBoitel]]`/`[[EdContratoCVGado]]`** (ambas lidas integralmente): nenhuma coluna discriminadora foi encontrada em `ItContratosPec` — a ambiguidade permanece um achado de risco não resolvido no código, não uma lacuna de leitura. |
| "Painel de Contratos" é reutilizado com um 3º `iGrupo` | `iGrupo=8` aqui (Boitel) vs. `6`=Compra e `7`=Venda em `[[ContCompraGado]]`/`[[ContVendaGado]]` — confirma que `PainelContratos`/`Previsoes` são telas genéricas do ERP com um esquema de agrupamento (`iGrupo`) próprio, desacoplado do `GrupoComercial` da tabela `Contratos`. |
| Impressão via automação OLE do MS Word, não `.rtm` | Único fluxo de impressão no módulo Pecuária (até esta sessão) que não usa o motor de relatórios `ppReport`/`.rtm` — em vez disso abre um `.doc` modelo existente (escolhido via `SaveDialog`/`OpenDialog`), substitui marcadores `<Campo>` pelo `FieldName` de cada campo do dataset `cdsWord` (loop genérico por `FieldCount`), e salva uma cópia com o número do Contrato no nome. |
| `NumeroExtenso` é uma função utilitária completa de conversão número→texto por extenso (PT-BR) | ~150 linhas, suporta até a casa dos bilhões e centavos, com tratamento de singular/plural — provavelmente usada para preencher um campo textual no `.doc` do Contrato (ex.: valor por extenso), mas **não há nenhuma chamada a `NumeroExtenso` em todo o restante da unit** (achado: função morta/não utilizada, ou usada apenas dentro do próprio arquivo `.doc` template via campo não capturado nesta leitura — dúvida). |
| **(achado, auditoria 2026-09-02) `if ceCliente.EditValue then` — comparação implícita Variant→Boolean, inconsistente com o padrão do restante da unit** | `btnConsultaClick`: `if ceCliente.EditValue then S.Add('And C.Pessoa = ...')` — `EditValue` é `Variant`; o compilador Delphi converte implicitamente qualquer valor numérico não-zero (incluindo negativo) para `True`. Funciona na prática (mesmo efeito de `> 0` para valores válidos), mas é estilisticamente divergente do padrão usado 1 linha abaixo (`cbFazenda.EditValue > 0`) e do restante do módulo — não filtra explicitamente valores negativos, apenas trata qualquer não-zero como "filtro ativo". Não há nenhum `OnValidate`/travamento de sinal em `ceCliente` (`TcxCurrencyEdit`, `DecimalPlaces=0`). |
| Sem nenhum cálculo/arredondamento em Object Pascal nesta unit | Confirmado por releitura completa: `QtdAnimais` vem pronto do `SUM(It.Quantidade)` da consulta SQL (sem pós-processamento Delphi); não há `RoundTo`/`SimpleRoundTo`/`Round`/`Trunc`/`FormatFloat` em nenhum ponto do `.pas` — é uma tela de consulta/CRUD-delegado, sem fórmula própria. |

---

## 2) Dicionário de campos da tela (`.dfm`)

| Controle | Classe | Rótulo/Caption | Vinculado a (campo BD) | Obrigatório | Observações |
|---|---|---|---|---|---|
| `cbUnidNeg` | `TcxLookupComboBox` | (grupo "Unidade de Negócio") | `Contratos.UnidadeNegocio` (filtro) | — | Lista `dmConsulta.dsUnidNeg` (`DetPessoas.Pecuaria='S'` do `_iEmpresa`, filtradas por permissão `'UN'` se não Supervisor); `Properties.OnEditValueChanged = btnConsultaClick` — reconsulta automática ao trocar. Default = `_iUnidNegoc` (ou 1º da lista). |
| `deInicio`/`deFinal` | `TcxDateEdit` | (grupo "Período", rótulo "A" via `cxLabel1`) | `Contratos.Data` (filtro) | — | Default: `FirstDayYear(Date)` / `Date`. `Properties.DateButtons=[btnToday]`; **sem** `OnEditValueChanged` — mudar a data exige clique manual em "Consultar". |
| `teContrato` | `TcxTextEdit` | (grupo "Contrato") | `Contratos.Contrato` (filtro, string) | — | Sem `OnEditValueChanged` — exige clique em "Consultar". |
| `ceCliente` | `TcxCurrencyEdit` | (grupo "Cliente") | `Contratos.Pessoa` (filtro) | — | `DecimalPlaces=0`, `Hint='Pressione F2 para Pesquisar'`. F2 (`ceClienteKeyDown`) abre ajuda de Pessoa (grupo `'C1'`). `Properties.OnEditValueChanged=ceClientePropertiesEditValueChanged` — reconsulta a lista de `cbFazenda` (não a grade principal) e resolve `lblPessoa`; comparação de filtro usa `if EditValue then` (ver achado em "1) Conceito"), não `> 0`. |
| `lblPessoa` | `TcxLabel` | (grupo "Cliente", ao lado de `ceCliente`) | somente leitura — nome resolvido por `BuscaPessoa` | — | "..:: TODOS ::.." se `ceCliente=0`; "Código do Cliente Inválido." (`MessageDlg`) se a busca não retornar linhas. |
| `cbFazenda` | `TcxLookupComboBox` | (grupo "Fazenda") | `Contratos.LocalRetirada` (filtro) | — | Lista `dmConsulta.dsUnd` (`DetPessoas` do Cliente selecionado); recarregada e zerada (`EditValue:=0`) toda vez que `ceCliente` muda. **Sem** `OnEditValueChanged` — trocar a Fazenda não reconsulta sozinho. |
| Grid `gdContrato`/`tvContrato` (colunas, ordem física no `.dfm`) | `TcxGridDBColumn` | ver linhas abaixo | `cdsContratosPec` | — | Somente leitura (`OptionsData.Editing/Inserting/Deleting=False`); duplo-clique (`tvContratoDblClick`) abre `TfmEdContratoBoitel` em modo Visualização (`Tag:=1`). |
| ↳ `tvContratoNumero` | `TcxGridDBColumn` | "Contrato" (`Caption` explícito) | **`COntrato`** (alias SQL, não `Numero`) | — | Apesar do nome do componente (`Numero`) e do `Caption` "Contrato", está de fato vinculado à coluna textual `Contrato` (`sqlContratosPecCOntrato`), não ao `Numero` inteiro auto-gerado — `Width=88`. |
| ↳ `tvContratoData` | `TcxGridDBColumn` | (sem `Caption` explícito → herda "Data") | `Data` | — | `Width=87`. |
| ↳ `tvContratoCliente` | `TcxGridDBColumn` | (sem `Caption` → herda "Cliente") | `Cliente` (alias de `Pessoas.Nome`) | — | `Width=263`. |
| ↳ `tvContratoLocalRetirada` | `TcxGridDBColumn` | "Fazenda Cliente" | `LocalRetirada` (alias de `DetPessoas.Descricao`) | — | `Width=265`. |
| ↳ `tvContratoQtdAnimais` | `TcxGridDBColumn` | "Qtd. Animais" | `QtdAnimais` (`SUM(It.Quantidade)`, sem arredondamento Delphi) | — | `Width=103`; último campo, vem pronto da consulta agregada. |
| `dnNavega` | `TcxDBNavigator` | — | `dsContratosPec` | — | Só expõe Excluir/Alterar (`Buttons.Delete/Edit.Visible=True`); First/PriorPage/Prior/Next/NextPage/Last/Post/Cancel/Refresh/SaveBookmark/GotoBookmark/Filter todos `Visible=False`. `Buttons.ConfirmDelete=False` (confirmação manual em `cdsContratosPecBeforeDelete`). `Buttons.OnButtonClick=nbEstoqueButtonsButtonClick` (não há botão "Inserir" visível no navigator — a Inclusão é acionada via `AButtonIndex=6`, mapeado a uma tecla/ação não visível diretamente nesta unit). |
| `btnPainelContrato` | `TcxButton` | "Painel" (Hint "Painel do Contrato") | — | — | Abre `TfmPainelContratos` (`iGrupo=8`). |
| `btnFechContratos` | `TcxButton` | "Fechamentos" (Hint "Fechamentos do Contrato") | — | — | Abre `TfmFechContratos`. |
| `bbPrint` | `TcxButton` | "Imprimir" (Hint "Impressão do Contrato") | — | — | Gera `.doc` via automação Word. |
| `bbCancela` | `TcxButton` | (sem Caption, Hint "Cancelar") | — | — | Fecha a tela (`Close`) — **omitido da versão anterior desta tabela**. |
| `mmQuery` | `TcxMemo` | — | espelha o SQL da última consulta de impressão (`cdsWord`) | Oculto por padrão (`Visible=False`) | Painel de debug — alternado por `Ctrl+F9`. |

---

## 5) Jornada do usuário + Especificação funcional

### SP-01 — Abrir a tela (`FormShow`)
Período padrão = ano corrente até hoje; carrega Fazendas Pecuária-habilitadas (filtradas por
permissão se não Supervisor); Fazenda padrão = corrente do usuário.

### SP-02 — Consultar (`btnConsultaClick`)
`SELECT` agregado de `Contratos JOIN Pessoas JOIN DetPessoas (LocalRetirada) LEFT JOIN
ItContratosPec`, sempre filtrado por `GrupoComercial = 9` + Empresa/Safra/UnidadeNegocio/Período,
mais filtros opcionais de Contrato/Cliente/Fazenda.

### SP-03 — Incluir/Editar (`nbEstoqueButtonsButtonClick`) → `TfmEdContratoBoitel`

### SP-04 — Visualizar (duplo-clique, `Tag:=1`) → `TfmEdContratoBoitel`

### SP-05 — Excluir (`cdsContratosPecBeforeDelete`/`AfterDelete`)
Confirma exclusão (sem nenhuma verificação de vínculo prévio — **achado de risco**: diferente de
`[[ContratoCVGado]]` (bloqueia se `Situacao<>'C'`) e `[[DadosAbate]]` (bloqueia se houver
`MovAnimais` vinculado), aqui a exclusão é incondicional após a confirmação simples); exclui
`ItContratosPec` do Contrato em cascata manual; grava log (`GravaItpLog`).

### SP-06 — Painel de Contratos (`btnPainelContratoClick`) → `TfmPainelContratos` (`iGrupo=8`)
Exige um Contrato selecionado.

### SP-07 — Fechar Contratos (`btnFechContratosClick`) → `TfmFechContratos`
Exige um Contrato selecionado; passa Contrato/Cliente/Fazenda via `.Tag`/`.Caption`/`.Hint` do
formulário satélite (padrão "modal satélite" recorrente do módulo).

### SP-08 — Imprimir (`bbPrintClick`)
Monta 1 registro com dados completos do Contrato (Cliente/Fazenda/Endereços/Cidade/UF/
Espécie/Raça/Sexo — **apenas do 1º item, via `TOP 1`** — achado: se o Contrato tiver múltiplas
Espécies/Raças/Sexos negociados, apenas o primeiro é usado no documento impresso) + data por
extenso; abre um `.doc` modelo escolhido pelo usuário via `OpenDialog`; substitui todos os
marcadores `<NomeDoCampo>` pelo valor do respectivo campo; salva uma cópia nomeada
`"ContratoBoitel <Contrato>.doc"` via `SaveDialog`.

### 5.3 Regras de negócio e validações

- **BR-001 — Ações "Painel"/"Fechar Contratos" exigem Contrato selecionado.** Mensagem: "Nenhum
  Contrato Selecionado. Selecione um Contrato para Visualizar o Painel." (Painel; "Fechar
  Contratos" apenas ignora silenciosamente se `Sequencial <= 0`, sem mensagem — achado de
  inconsistência de UX entre os 2 botões).
- **Achado de risco (destacado acima):** exclusão sem verificação de vínculos, ao contrário do
  padrão do restante do módulo.
- **Achado de risco:** impressão usa apenas o primeiro item (`TOP 1`) de Espécie/Raça/Sexo do
  Contrato — pode gerar documento com dado incompleto/impreciso se o Contrato negociar mais de um
  tipo de animal.

---

## 6) Integrações e dados

### 6.1 Integrações (internas)

- **[[EdContratoBoitel]]** (`TfmEdContratoBoitel`) — CRUD real (lido e documentado integralmente).
- **`TfmPainelContratos`** (`iGrupo=8`) — genérica do ERP, já referenciada por
  `[[ContVendaGado]]`/`[[ContCompraGado]]` com outros `iGrupo`.
- **[[FechContratos]]** (`TfmFechContratos`) — "fechamento" do Contrato (lida e documentada
  integralmente).
- **`ItContratosPec`** — compartilhada (com achado de risco) com `[[ContratoCVGado]]`.
- Automação OLE do **Microsoft Word** (`ComObj`/`WordXP`) — único ponto do módulo com essa
  integração até esta sessão.

### 6.2 Modelo de dados

**Tabela `Contratos`** (genérica, `GrupoComercial=9` = Boitel) — mesma tabela usada por
`[[ContVendaGado]]`/`[[ContCompraGado]]` (`7`/`8`); campos adicionais confirmados nesta unit não
vistos nas 2 telas irmãs: `Contrato` (código textual do contrato, distinto de `Sequencial`),
`ControlePeso` (`'1'`=Recepção / outro=Processamento), `IniRetirada`/`FinRetirada` (período de
retirada dos animais).

**Tabela `ItContratosPec`** (ver achado de risco de FK compartilhada acima) — campos adicionais
confirmados nesta unit: `Especie` (FK `Tabelas.Tipo=208`, novo domínio catalogado), `Raca` (FK
`Tabelas.Tipo=166`), `Sexo`.

### 6.3 Triggers e Procedures do banco

**`[[ti_Contratos]]`**/**`[[TD_Contratos]]`** (genéricas sobre `Contratos`) e
**`[[TIU_ItContratosPec]]`**/**`[[TD_ItContratosPec]]`** — todas disparadas pelo `DELETE
Contratos`/`DELETE ItContratosPec` manual desta unit (SP-05); ver achados de aplicabilidade
parcial a Pecuária em `[[TD_Contratos]]` (bloqueio `ClassFinComercial`/`MovFinComercial` aplica-se
normalmente aqui, `GrupoComercial=9`). Achado da auditoria de 2026-09-02: essas 4 triggers não
tinham sido cruzadas na varredura estrutural original (nome genérico `Contratos`/`ItContratosPec`
não associado aos arquivos de trigger).

---

## 7) Suporte: FAQ, mensagens, erros e troubleshooting

### 7.2 Catálogo de mensagens e erros

| Mensagem exata | Causa |
|---|---|
| "Nenhum Contrato Selecionado. Selecione um Contrato para Visualizar o Painel." | "Painel" sem Contrato selecionado |
| "Deseja Realmente Excluir o Registro Selecionado?" | Confirmação de exclusão |
| "Erro na Exclusão do Contrato." + mensagem da exceção | Falha na exclusão |
| "Código do Cliente Inválido." | Busca de Cliente sem correspondência |

---

## 9) Notas de revisão

- **2026-09-02** (auditoria campo-a-campo — módulo Pecuária)
  - **O que mudou:** dicionário de campos (seção 2) reescrito coluna a coluna a partir de
    releitura literal do `.dfm`. Achados: coluna de grade "Contrato" (`tvContratoNumero`) está de
    fato vinculada ao campo textual `COntrato`, não a `Numero`; botão `bbCancela` estava ausente
    da tabela; uso de `if ceCliente.EditValue then` (conversão implícita Variant→Boolean) em vez
    do padrão `> 0` do resto da unit. Identificadas as 4 triggers genéricas
    (`[[ti_Contratos]]`/`[[TD_Contratos]]`/`[[TIU_ItContratosPec]]`/`[[TD_ItContratosPec]]`) que
    disparam no `DELETE` desta tela — gap real não coberto na varredura estrutural original.
    Confirmado que não há nenhum cálculo/arredondamento em Object Pascal nesta unit.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/ContratoBoitel.pas` + `.dfm`; ver `[[ti_Contratos]]`,
    `[[TD_Contratos]]`, `[[TIU_ItContratosPec]]`, `[[TD_ItContratosPec]]`.

- **2026-09-01** (auditoria de profundidade — módulo Pecuária)
  - **O que mudou:** removida a marcação de "nota parcial" — `[[EdContratoBoitel]]` (CRUD real) e
    `[[FechContratos]]` (satélite "Fechar Contratos") já haviam sido lidas e documentadas
    integralmente em sessão posterior à criação desta nota; as referências cruzadas aqui (Status,
    nota de topo, 1, 6.1) ainda não tinham sido atualizadas. Confirmado: a ambiguidade de FK de
    `ItContratosPec` (`Contratos` vs. `ContratosPec`) permanece um achado de risco real e não
    resolvido no código — não é mais uma lacuna de leitura, é um achado confirmado após ler ambas
    as units de CRUD.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** ver `[[EdContratoBoitel]]`, `[[FechContratos]]`, `[[EdContratoCVGado]]`.

- **2026-08-28** (criação da nota — módulo Pecuária)
  - **O que mudou:** nota criada do zero, a partir de leitura 100% literal de
    `Pecuaria/ContratoBoitel.pas` (616 linhas) + `.dfm` (título confirmado "Contratos de
    Boitel"). Documentado o 3º valor de `GrupoComercial` (`9`=Boitel) da tabela `Contratos`, a
    impressão via automação OLE do Word (único caso do módulo), e os botões "Painel"/"Fechar
    Contratos". **Achado de risco central:** `ItContratosPec` é referenciada por 2 tabelas-pai
    distintas (`Contratos` aqui, `ContratosPec` em `[[ContratoCVGado]]`) sem discriminador visível
    nesta unit — risco de ambiguidade de FK. Achado de risco: exclusão sem validação de vínculos
    (diferente do padrão do módulo); impressão usa `TOP 1` para Espécie/Raça/Sexo.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/ContratoBoitel.pas` + `.dfm`; ver
    `[[ContratoCVGado]]`, `[[ContVendaGado]]`, `[[ContCompraGado]]`; esclarecer com negócio a
    relação entre `Contratos`/`ContratosPec` e a integridade referencial de `ItContratosPec`.
