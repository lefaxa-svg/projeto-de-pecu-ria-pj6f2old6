> **Nota de método**: este documento descreve uma tela de um sistema LEGADO já em produção,
> reconstruída por engenharia reversa do código-fonte — não é uma especificação de feature nova
> obtida por entrevista com um PO. Por isso, toda seção que normalmente viria de uma conversa de
> negócio (motivação, métricas, objetivos) foi preenchida por **inferência a partir do
> comportamento do código**, e está marcada explicitamente como `(inferência)`. Onde nem o código
> nem o contexto do módulo permitem inferir nada com segurança, o campo está como `N/A`.
> Fonte: leitura 100% literal de `Pecuaria/EdContratoBoitel.pas` (588 linhas, unit
> `EdContratoBoitel`, classe `TfmEdContratoBoitel`) e do `.dfm` correspondente, nesta sessão — 60º
> arquivo `.pas` lido do módulo Pecuária. **Completa `[[ContratoBoitel]]`** (que delegava o CRUD
> real a esta unit — nota daquela agora pode ser considerada completa). **Confirma o achado de
> risco de FK compartilhada**: `ItContratosPec.Contrato` referencia aqui `Contratos.Sequencial`
> (`WHERE GrupoComercial=9`) — o mesmo padrão observado em `[[ContratoBoitel]]`, e distinto do
> uso em `[[ContratoCVGado]]` (`ContratosPec.Sequencial`). Ver nota de método completa (limitação
> de DDL/tipos de coluna) em `[[ExportaDietas]]`, válida para todo o módulo.

---

**Status da implementação:** Legado — em produção (documentado via engenharia reversa, sem item de trabalho associado)

**Owner (curadoria):** @jefferson.arantes
**Tags:** #Pecuaria #Contrato #Boitel #Comercial #CRUD

---

## 0) Resumo executivo

- **O que é:** tela de Inclusão/Edição/Visualização de um Contrato de Boitel — mestre
  (`Contratos`, `GrupoComercial=9`) + detalhe (`ItContratosPec`, 1 linha por combinação
  Espécie/Raça/Sexo negociada, com Quantidade e Valor por Cabeça ou por Arroba).
- **3 modos de abertura** (via `Tag`/`iSeq`, setados pelo formulário chamador
  `[[ContratoBoitel]]`): Inclusão (`iSeq=0`), Edição (`iSeq>0`, `Tag<>1`), Visualização
  (`Tag=1` — força `ReadOnly=true` em ambos os `ClientDataSet`s).
- **Detalhe bloqueado até o mestre ser salvo:** Inserir/Editar/Excluir um item do detalhe
  (`ItContratosPec`) é bloqueado com aviso enquanto o Contrato mestre estiver em
  `dsInsert`/`dsEdit` — obriga o usuário a gravar o cabeçalho do Contrato antes de poder
  adicionar os animais negociados (padrão mestre-detalhe rígido, diferente do padrão "grid
  editável inline" usado em outras telas do módulo).
- **Impacto principal:** `INSERT`/`UPDATE Contratos` (`GrupoComercial=9` fixo); `INSERT`/
  `UPDATE`/`DELETE ItContratosPec`; fechamento da tela bloqueado se houver edição não salva.

---

## 1) Conceito

| Termo | Definição |
|-------|-----------|
| `Valor` é um campo calculado que espelha `VlrCabeca` ou `Vlr@` conforme `TipoValor` | `cdsItContratosCalcFields`: se `TipoValor='@'`, `Valor := Vlr@`; se `'C'`, `Valor := VlrCabeca` — e no sentido inverso, ao gravar (`BeforePost`), o valor digitado em `Valor` é copiado de volta para `VlrCabeca` ou `Vlr@` (zerando o outro) conforme o `TipoValor` escolhido — um único campo de tela representando 2 colunas mutuamente exclusivas do banco. No `.dfm`, o campo calculado se chama literalmente `cdsItContratosteste` (`FieldKind=fkInternalCalc`, `FieldName='Valor'`) — nome residual de desenvolvimento que não corresponde ao propósito do campo. |
| **Sem arredondamento explícito em nenhum cálculo desta unit** | Toda a cadeia `Valor`↔`VlrCabeca`/`Vlr@` (em `cdsItContratosCalcFields` e em `cdsItContratosBeforePost`) usa atribuição direta via `AsFloat`, sem `Round`/`RoundTo`/`SimpleRoundTo`/`Trunc`/`FormatFloat` em nenhum ponto do código Pascal. A única formatação de 2 casas decimais é cosmética, na coluna de grid `tvContratoVlrUnit` (`Properties.DisplayFormat`/`EditFormat = ',0.00'`), e não altera o valor persistido. A precisão final gravada depende apenas da definição de coluna do banco (`VlrCabeca`/`Vlr@` são `TFMTBCDField`, `Precision=18`, `Size=2`, conforme `.dfm`), não de lógica da tela. |
| **Nenhum campo numérico aceita valor negativo ou zero** | `cdsItContratosBeforePost` rejeita com `Abort` quando `Quantidade.AsFloat<=0` ("Indique a Quantidade.") ou `Valor.AsFloat<=0` ("Indique o Valor.") — a checagem é `<=0`, portanto cobre tanto zero quanto negativos; não há um teste específico e separado para "negativo" (ex.: `<0`), o único guard-rail é esse `<=0`. Não há `OnValidate`/`OnEditValueChanged` adicional nos campos `VlrCabeca`/`Vlr@`/`Quantidade` além dessa checagem no `BeforePost` do dataset. |
| Numeração dupla do Contrato: `Sequencial` (interno) vs. `Numero` (visível ao usuário) | `Numero` é gerado por `LoadSequencia('CONTRATOS', 9, _iEmpresa, _iSafra)` — uma sequência **numérica por Empresa/Safra/GrupoComercial=9**, distinta do `Sequencial` (PK global via `LoadSequencia('Contratos', 'Sequencial')`) — explica por que `Numero` reinicia a cada Safra/Empresa mas `Sequencial` não. |
| Campo `Situacao` inicializado como `'1'` (string), não `'A'`/`'C'` como em `[[ContratoCVGado]]` | Achado de inconsistência de convenção entre as 2 famílias de contrato: `ContratosPec.Situacao` usa letras (`'A'`/`'C'`), `Contratos.Situacao` (GrupoComercial=9, aqui) usa dígitos — `'1'` é o valor inicial (provavelmente "Aberta"/"Pendente"). **Resolvido (auditoria 2026-09-08)**: `[[RecepcaoAnimais]]` confirma `Situacao='2'` = "Atendida" — marcado pela ação "Finalizar" quando a quantidade recebida bate exatamente com o total negociado do Contrato. Confirma que o campo é de fato gerenciado (por `[[RecepcaoAnimais]]`, não por esta unit nem por `[[FechContratos]]`), com pelo menos os 2 valores `'1'`(Aberta)/`'2'`(Atendida) confirmados. |
| Campos "Not Null não utilizados" preenchidos com valor neutro no Insert | `ComissaoAgente:=0`, `AgenteVendas:=0`, `Negociacao:=0`, `Moeda:=_iMoeda` — comentário explícito no código-fonte confirma que esses campos existem na tabela genérica `Contratos` (usados por outros `GrupoComercial`/módulos) mas não se aplicam ao fluxo de Boitel — preenchidos apenas para satisfazer constraints `NOT NULL`. |

---

## 2) Dicionário de campos da tela (`.dfm`)

### 2.1 Cabeçalho do Contrato (mestre — `cdsEdContratos`/`Contratos`)

| Controle | Classe | Rótulo/Caption (grupo) | Vinculado a (campo BD) | Obrigatório | Observações |
|---|---|---|---|---|---|
| `ceNumero` | `TcxDBTextEdit` | grupo " Contrato " | `Contratos.Contrato` | Sim | Código textual do Contrato (não confundir com `Numero` numérico auto-gerado); recebe foco automaticamente no `AfterInsert`. |
| `deData` | `TcxDBDateEdit` | grupo " Data " | `Contratos.Data` | Sim | `ImmediatePost=True`, `ShowTime=False`; inicializada com `Date` no `AfterInsert`. |
| `ceCliente` | `TcxDBCurrencyEdit` | grupo " Pessoa " | `Contratos.Pessoa` | Sim | Hint "Pressione F2 para Pesquisar"; F2 abre ajuda de Pessoa (`dbDispAjudaPessoa`, tipo `'C1'`); `OnEditValueChanged` dispara `BuscaPessoa` (preenche `lblPessoa`) e recarrega o combo de Fazenda (`dmConsulta.cdsUnd`, tabela `DetPessoas` filtrada pelo Cliente). |
| `lblPessoa` | `TcxLabel` | grupo " Pessoa " | não vinculado a BD (rótulo de exibição) | — | Recebe o nome do cliente (1ª linha do retorno de `BuscaPessoa`); é limpo (`Clear`) apenas quando `Pessoa<=0` — se `BuscaPessoa` não encontrar o código, exibe "Código do Cliente Inválido." mas **não** limpa o rótulo (mantém o texto anterior). |
| `cbFazenda` | `TcxDBLookupComboBox` | grupo " Fazenda " | `Contratos.LocalRetirada` | Sim | `ListSource=dmConsulta.dsUnd`, `KeyFieldNames='Codigo'`, `DropDownListStyle=lsFixedList`, `ImmediatePost=True`; a lista é recarregada a cada troca de Cliente (ver `ceCliente`). |
| `lblUnidNeg` | `TcxLabel` | grupo " Unidade de Negócio " | não vinculado a BD (rótulo puro) | — | `Caption` não é atribuído em nenhum ponto desta unit — herdado do comportamento genérico de `TFormBase` (ancestor comum das telas de edição). Seu `.Tag` (não o `Caption`) é lido em `cdsEdContratosBeforePost` para preencher `Contratos.UnidadeNegocio` na inclusão. |
| `rgPeso` | `TcxDBRadioGroup` | " Opção de Pesagem " | `Contratos.ControlePeso` | Sim | 2 opções fixas (`Properties.Columns=2`): "Recepção (Balanção)" → `'R'`, "Processamento Individual" → `'P'`; inicializado como `'P'` no `AfterInsert` (padrão é Processamento, não Recepção). |
| `deIniRetirada` | `TcxDBDateEdit` | " Período de Entrega / Recebimento " | `Contratos.IniRetirada` | Não (sem validação em `BeforePost`) | `ImmediatePost=True`, `ShowTime=False`; inicializado com `Date` no `AfterInsert`. |
| `deFinRetirada` | `TcxDBDateEdit` | " Período de Entrega / Recebimento " | `Contratos.FinRetirada` | Não (sem validação em `BeforePost`) | `ImmediatePost=True`, `ShowTime=False`; **sem** valor padrão no `AfterInsert` (fica em branco até o usuário preencher). |
| `dnNavega` | `TcxDBNavigator` | grupo topo direito | — | — | Mestre; só exibe Editar/Salvar/Cancelar (`Buttons.Insert.Visible=False`, `Buttons.Delete.Visible=False`) — a inclusão é automática no `FormShow` (`cdsEdContratos.Insert`) e não há exclusão do Contrato por este navigator. Atalhos F5/F6/F7. |

### 2.2 Grid "Animais do Contrato" (detalhe — `cdsItContratos`/`ItContratosPec`, `tvContrato`)

| Controle | Classe | Caption da coluna | Vinculado a (campo BD) | Obrigatório | Observações |
|---|---|---|---|---|---|
| `tvContratoEspecie` | `TcxGridDBColumn` (`TcxLookupComboBoxProperties`) | "Espécie" | `ItContratosPec.Especie` | Sim | Lookup em `dmPecuaria.dsEspeciesAnim` (`Tabelas.Tipo=208`, carregado no `FormShow`); `ShowHeader=False` na lista. |
| `tvContratoRaca` | `TcxGridDBColumn` (`TcxLookupComboBoxProperties`) | "Raça" | `ItContratosPec.Raca` | Sim | Lookup em `dmPecuaria.dsRaca` (`Tabelas.Tipo=166`, carregado no `FormShow`). |
| `tvContratoSexo` | `TcxGridDBColumn` (`TcxComboBoxProperties`) | sem `Caption` próprio (herda o nome do campo "Sexo") | `ItContratosPec.Sexo` | Sim | Itens fixos do combo são apenas os textos "MACHO"/"FÊMEA" (`Properties.Items.Strings`); a conversão real para `'M'`/`'F'` é feita pelo par `OnGetText`/`OnSetText` do campo `cdsItContratosSexo`, não pela lista do combo. |
| `tvContratoQtdAnimais` | `TcxGridDBColumn` | sem `Caption` próprio (herda "Quantidade") | `ItContratosPec.Quantidade` | Sim | Soma no rodapé do grid (`skSum`, `Styles.Footer=dmITP.cxStyleDisable`); campo obrigatório validado como `<=0` no `BeforePost`. |
| `tvContratoTipoValor` | `TcxGridDBColumn` (`TcxComboBoxProperties`) | "Tipo Valor" | `ItContratosPec.TipoValor` | Sim | Itens fixos "POR ARROBA"/"POR CABEÇA"; conversão para `'@'`/`'C'` via `OnGetText`/`OnSetText` do campo `cdsItContratosTipoValor` (mesmo padrão de `tvContratoSexo`). Ver campo calculado `Valor` na seção 1 (Conceito). |
| `tvContratoVlrUnit` | `TcxGridDBColumn` (`TcxCurrencyEditProperties`) | sem `Caption` próprio (herda "Valor") | campo calculado interno `cdsItContratosteste` (`FieldKind=fkInternalCalc`, `FieldName='Valor'`) | Sim | `DisplayFormat`/`EditFormat=',0.00'` (só formatação visual de 2 casas, sem `RoundTo` — ver seção 1); `ValidateOnEnter=True`. |
| `dnITNavega` | `TcxDBNavigator` | — | — | — | Detalhe; exibe CRUD completo (Inserir/Excluir/Editar/Salvar/Cancelar), mas cada ação é bloqueada via `Before*` enquanto o mestre estiver em `dsInsert`/`dsEdit` (ver Resumo executivo). Teclas F3-F7 alternam entre mestre e detalhe conforme o foco (`gdContrato.Tag`, setado por `gbAnimaisEnter`/`gbAnimaisExit`). |

---

## 5) Jornada do usuário + Especificação funcional

### SP-01 — Abrir a tela (`FormShow`)
Carrega Espécies (`Tabelas.Tipo=208`) e Raças (`Tabelas.Tipo=166`); verifica permissões
(mestre/detalhe independentes); carrega o Contrato (`Sequencial=iSeq`, `GrupoComercial=9`); define
título e modo conforme `Tag`/`iSeq` (ver Resumo executivo); se Inclusão, entra automaticamente em
modo de inserção (`cdsEdContratos.Insert`).

### SP-02 — Gravar o Contrato mestre (`cdsEdContratosBeforePost`)
Valida Número/Data/Cliente/Fazenda/Opção de Pesagem; se inserção, atribui
Empresa/Safra/GrupoComercial=9/Sequencial/Numero/UnidadeNegocio; grava log.

### SP-03 — Gerenciar itens do detalhe (`cdsItContratosBefore*`)
Bloqueia Inserir/Editar/Excluir enquanto o mestre não estiver salvo ("Salve o Contrato para
Inserir/Editar/Excluir Animais."); ao gravar um item, converte `Valor`→`VlrCabeca`/`Vlr@`
conforme `TipoValor`.

### SP-04 — Fechar a tela (`FormClose`)
Bloqueia o fechamento se houver edição pendente não salva no mestre ou no detalhe.

### 5.3 Regras de negócio e validações

- **BR-001 a BR-005 — validações do mestre:** Número, Data, Cliente, Fazenda do Cliente, Opção
  de Pesagem obrigatórios.
- **BR-006 a BR-011 — validações do item de detalhe:** Espécie, Raça, Sexo, Quantidade, Tipo de
  Valor, Valor obrigatórios.
- **BR-012 — Detalhe bloqueado sem mestre salvo** (ver Resumo executivo).
- **BR-013 — Fechamento bloqueado com edição pendente.**

---

## 6) Integrações e dados

### 6.1 Integrações (internas)

- **`[[ContratoBoitel]]`** — tela chamadora (consulta/listagem).

### 6.2 Modelo de dados

**Tabela `Contratos`** (`GrupoComercial=9`) — campos adicionais confirmados nesta unit, além dos
já documentados em `[[ContratoBoitel]]`: `Empresa`, `Safra`, `Numero` (sequência própria por
Empresa/Safra/GrupoComercial), `AgenteVendas`, `ComissaoAgente`, `Negociacao`, `Moeda` (não
utilizados pelo fluxo Boitel, preenchidos com neutro).

**Tabela `ItContratosPec`** — campos adicionais confirmados: `Quantidade`, `VlrCabeca`, `Vlr@`,
`TipoValor` (`'C'`=Por Cabeça / `'@'`=Por Arroba).

### 6.3 Triggers e Procedures do banco

**`[[TIU_ItContratosPec]]`**/**`[[TD_ItContratosPec]]`** — mantêm `Contratos.ValorTotal`/
`TotalQtd` como agregados automáticos de `ItContratosPec` (mesma origem confirmada em
`[[EdContVendaGado]]`/`[[EdContCompraGado]]`; disparadas por esta unit ao gravar
`ItContratosPec` de um Contrato Boitel). **`[[ti_Contratos]]`**/**`[[TD_Contratos]]`** —
genéricas sobre `Contratos`, disparadas por esta unit; bloqueio de exclusão por
`ClassFinComercial`/`MovFinComercial` (`GrupoComercial=9`, `<>7`) aplica-se normalmente.

---

## 7) Suporte: FAQ, mensagens, erros e troubleshooting

### 7.2 Catálogo de mensagens e erros

| Mensagem exata | Causa |
|---|---|
| "Indique o Número do Contrato." / "Indique a Data do Contrato." / "Indique o Cliente." / "Indique a Fazenda do Cliente." / "Indique a Opção de Pesagem." | Validação do mestre |
| "Indique a Espécie." / "Indique a Raça." / "Indique o Sexo." / "Indique a Quantidade." / "Indique o Tipo de Valor." / "Indique o Valor." | Validação do item de detalhe |
| "Salve o Contrato para Inserir/Editar/Excluir Animais." | Ação no detalhe com mestre não salvo |
| "Salve os Dados Antes de Sair." | Fechamento com edição pendente |
| "Código do Cliente Inválido." | Busca de Cliente sem correspondência |

---

## 9) Notas de revisão

- **2026-09-08** (auditoria campo-a-campo — resolução da dúvida sobre `Situacao`)
  - **O que mudou:** resolvida a dúvida em aberto sobre onde/como `Contratos.Situacao`
    (GrupoComercial=9) é gerenciado — confirmado via `[[RecepcaoAnimais]]` que `Situacao='2'`
    significa "Atendida", marcado pela ação "Finalizar" ao bater a quantidade recebida com o
    total negociado.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** `[[RecepcaoAnimais]]`.

- **2026-09-02** (auditoria de profundidade do dicionário de campos — módulo Pecuária)
  - **O que foi verificado:** releitura completa de `EdContratoBoitel.pas` (587 linhas) e `.dfm`
    especificamente para o dicionário de campos e as fórmulas de cálculo (as triggers genéricas de
    `Contratos`/`ItContratosPec` já haviam sido auditadas em 2026-09-01 e não foram refeitas).
  - **Gaps reais encontrados e corrigidos:**
    1. A seção 2 tratava o grid "Animais do Contrato" como uma única linha genérica — foi
       reescrita em duas subtabelas (2.1 cabeçalho/mestre, 2.2 grid/detalhe) listando
       individualmente as 6 `TcxGridDBColumn` (`tvContratoEspecie`, `tvContratoRaca`,
       `tvContratoSexo`, `tvContratoQtdAnimais`, `tvContratoTipoValor`, `tvContratoVlrUnit`) e os
       controles de cabeçalho que não estavam na tabela original (`lblPessoa`, `lblUnidNeg`,
       `deIniRetirada`/`deFinRetirada` separados).
    2. `lblUnidNeg` (label da Unidade de Negócio) não tinha `Caption` atribuído em nenhum ponto da
       unit — documentado que vem do comportamento genérico de `TFormBase`, e que é o `.Tag`
       (não o `Caption`) que é lido em `BeforePost`.
    3. `rgPeso`: os 2 valores do radio group (`'R'`=Recepção, `'P'`=Processamento) não estavam
       explícitos na nota (só uma referência cruzada) — adicionados, junto com o padrão de
       inicialização (`'P'` no `AfterInsert`, não `'R'`).
    4. Confirmado e declarado explicitamente: **não há `RoundTo`/`SimpleRoundTo`/`Round`/`Trunc`
       em nenhum cálculo desta unit** — a conversão `Valor`↔`VlrCabeca`/`Vlr@` usa `AsFloat` puro;
       a formatação `,0.00` da coluna de grid é só cosmética. Também confirmado e declarado que
       `Quantidade` e `Valor` são os únicos campos com checagem de sinal (`<=0`, cobrindo zero e
       negativo juntos) e que não há `OnValidate`/`OnEditValueChanged` adicional nesses campos.
    5. Identificado que o campo calculado que sustenta a coluna "Valor" se chama literalmente
       `cdsItContratosteste` no Object Inspector (`FieldKind=fkInternalCalc`, `FieldName='Valor'`)
       — nome residual de desenvolvimento, documentado para não confundir quem for ler o `.dfm`.
  - **Verificado e confirmado sem alteração:** caminho de menu (tela é aberta só
    programaticamente por `[[ContratoBoitel]]`, que por sua vez tem entrada de menu confirmada em
    `[[iniModuloPecuaria]]` — não há "chamador não identificado" nesta nota); satélites
    `[[ContratoBoitel]]` já documentado e completo; triggers de `Contratos`/`ItContratosPec` não
    reauditadas por instrução explícita (já corretas desde 2026-09-01).
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/EdContratoBoitel.pas` + `.dfm`; `[[iniModuloPecuaria]]`.

- **2026-09-01** (auditoria de profundidade — módulo Pecuária)
  - **O que mudou:** identificadas as triggers `[[TIU_ItContratosPec]]`/`[[TD_ItContratosPec]]` —
    gap real de trigger não encontrada na varredura estrutural original.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** ver `[[TIU_ItContratosPec]]`, `[[TD_ItContratosPec]]`.

- **2026-08-28** (criação da nota — módulo Pecuária)
  - **O que mudou:** nota criada do zero, a partir de leitura 100% literal de
    `Pecuaria/EdContratoBoitel.pas` (588 linhas) + `.dfm`. Completa o CRUD de
    `[[ContratoBoitel]]` (nota daquela deixa de ser parcial). Confirmado o achado de risco de FK
    compartilhada de `ItContratosPec` (aqui aponta para `Contratos.Sequencial`). Documentado o
    campo calculado `Valor`↔`VlrCabeca`/`Vlr@`, e a numeração dupla `Sequencial`/`Numero`.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/EdContratoBoitel.pas` + `.dfm`; ver
    `[[ContratoBoitel]]`, `[[ContratoCVGado]]`.
