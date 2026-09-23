> **Nota de método**: este documento descreve uma tela de um sistema LEGADO já em produção,
> reconstruída por engenharia reversa do código-fonte — não é uma especificação de feature nova
> obtida por entrevista com um PO. Por isso, toda seção que normalmente viria de uma conversa de
> negócio (motivação, métricas, objetivos) foi preenchida por **inferência a partir do
> comportamento do código**, e está marcada explicitamente como `(inferência)`. Onde nem o código
> nem o contexto do módulo permitem inferir nada com segurança, o campo está como `N/A`.
> Fonte: leitura 100% literal de `Pecuaria/EdContratoCVGado.pas` (758 linhas, unit
> `EdContratoCVGado`, classe `TfmEdContratoCVGado`) e do `.dfm` correspondente, nesta sessão —
> 72º arquivo `.pas` lido do módulo Pecuária. **Completa `[[ContratoCVGado]]`** (CRUD real,
> delegado por aquela tela — nota daquela deixa de ser parcial; permanece o achado de que essa
> família de telas não tem entrada no menu principal, ver `[[iniModuloPecuaria]]`). **Achado de
> risco crítico confirmado nesta sessão** (2026-09-01): as triggers `[[TIU_ItContratosPec]]`/
> `[[TD_ItContratosPec]]` disparam ao gravar aqui e fazem `UPDATE Contratos ... WHERE Sequencial =
> @Contrato` usando um `ContratosPec.Sequencial` como se fosse `Contratos.Sequencial` — risco real
> de corrupção silenciosa ou no-op silencioso, ver "6.3". Ver nota de
> método completa (limitação de DDL/tipos de coluna) em `[[ExportaDietas]]`, válida para todo o
> módulo.

---

**Status da implementação:** Legado — em produção (documentado via engenharia reversa, sem item de trabalho associado)

**Owner (curadoria):** @jefferson.arantes
**Tags:** #Pecuaria #Contrato #Compra #Venda #Comercial #CRUD

---

## 0) Resumo executivo

- **O que é:** tela de Inclusão/Edição/Visualização de Contrato de Compra/Venda de Gado —
  mestre `ContratosPec` + detalhe `ItContratosPec` (Avaliação/Categoria/Quantidade/Peso/Valor),
  reutilizável para os 2 sentidos (`sTipo` público 'C'/'V', setado pelo chamador), mesmo padrão
  de reaproveitamento de classe já visto em `[[ContratoCVGado]]`.
- **Cálculo do detalhe é modularizado numa única procedure `Calculos(C: Integer)` com 3
  "modos"**, diferente da rede de handlers individuais usada em `[[EdContVendaGado]]`/
  `[[EdContCompraGado]]` — mesmo conjunto de fórmulas (Peso Total/Desconto/Rend.Carcaça→Total@→
  Peso Médio@; Vlr Total/Quantidade→Vlr Cabeça; Vlr Cabeça/Peso Médio@→Vlr@ e Vlr Total), mas
  organizado como uma função central chamada com um parâmetro de "modo" em vez de 5 handlers
  independentes — mesma lógica de negócio, estilo de implementação diferente entre as 2 famílias
  de tela de contrato do módulo.
- **`Negociacao` tem 4 valores textuais próprios** (`'C'`=Compra de Gado, `'P'`=Parceria,
  `'D'`=Diárias de Boitel, `'T'`=Transferência) — domínio fixo em código (não vindo de
  `Tabelas.Tipo=22` como nas outras 2 famílias de contrato) — achado de mais uma divergência de
  convenção entre `ContratosPec` e a tabela genérica `Contratos`.
- **Impacto principal:** `INSERT`/`UPDATE ContratosPec`; `INSERT`/`UPDATE`/`DELETE
  ItContratosPec` (aqui referenciando `ContratosPec.Sequencial`, não `Contratos.Sequencial` —
  reforça o achado de FK compartilhada já documentado em `[[ContratoBoitel]]`/
  `[[EdContVendaGado]]`).

---

## 1) Conceito

| Termo | Definição |
|-------|-----------|
| `Calculos(1/2/3)` como despachante central de recálculo | Modo 1 (chamado ao editar Peso Total/Desconto/Rend.Carcaça/Quantidade): `Total@ := (PesoTotal - DescontoKG) * RenCarcaca/100 / 15`; depois `PesoMedio@ := Total@ / Quantidade`. Modo 2 (Quantidade/Vlr Total): `VlrCabeca := VlrTotal / Quantidade`. Modo 3 (Vlr Cabeça/Vlr@): `Vlr@ := VlrCabeca / PesoMedio@` e `VlrTotal := VlrCabeca * Quantidade`. Diferente de `[[EdContVendaGado]]`, aqui **não há guarda `bRecalc`** contra recursão — a ausência de guarda funciona porque cada handler chama um subconjunto fixo e não-circular de modos (ex.: mudar Quantidade chama Calculos(1) e Calculos(2), nunca 3), evitando o ciclo que a outra família precisa prevenir explicitamente. **Arredondamento**: confirmado por releitura linha a linha de `Calculos` (linhas 634-666 do `.pas`) que **não há nenhum `RoundTo`/`SimpleRoundTo`/`Round`/`Trunc`/`RoundX`** em nenhuma das 5 fórmulas — todas as atribuições são `TField.AsFloat := <divisão/multiplicação direta>`. A precisão exibida vem só da máscara cosmética `,0.00`/`0` dos `TcxCurrencyEditProperties`/`TFMTBCDField` (formatação de exibição, não altera o valor persistido). **Sinal/negativos**: nenhum handler de cálculo nem `cdsItContratosPecBeforePost` bloqueia valor negativo explicitamente — as únicas checagens são `<=0` em `Avaliacao`, `Categoria`, `Quantidade`, `RenCarcaca` e `PesoTotal` (que barram zero e negativo pela mesma condição); `DescontoKG`, `VlrCabeca`, `Vlr@` e `VlrTotal` **não têm nenhuma validação de sinal** — um valor negativo digitado diretamente nessas 4 colunas do grid é aceito e propagado pelas fórmulas sem erro. |
| Modo de Visualização recarrega os rótulos de Fazenda mesmo sem edição | `FormShow`: no modo Visualização (`Tag=1`), chama `ceCodPessoaOrigemExit`/`ceCodPessoaDestExit` mesmo com os campos somente-leitura — garante que os combos de Fazenda (`lkFazOrigem`/`Dest`) exibam a opção correta mesmo sem o usuário ter "saído" do campo (que normalmente dispara esse recarregamento). |
| Papéis Pessoa/Rótulos idênticos a `[[ContratoCVGado]]` | `sTipo='C'`→Fornecedor/Empresa/Comprador; `'V'`→Empresa/Cliente/Vendedor — mesmo padrão já documentado na tela de consulta. |

---

## 2) Dicionário de campos da tela (`.dfm`)

Estrutura equivalente a `[[EdContVendaGado]]`/`[[EdContCompraGado]]`, mas sobre `ContratosPec`/
`ItContratosPec`.

### 2.1 Mestre (`ContratosPec`, grupos fora do grid)

| Controle | Classe | Rótulo/Caption | Vinculado a (campo BD) | Obrigatório | Observações |
|---|---|---|---|---|---|
| `lblSequencial` | `TcxDBLabel` | " Sequencial " (grupo) | `Sequencial` | — (gerado) | Somente exibição; PK gerada por `LoadSequencia('ContratosPec','Sequencial')` no `BeforePost`, não editável pelo usuário. |
| `ceNumero` | `TcxDBCurrencyEdit` | " Número " | `Numero` | Sim | `DecimalPlaces=0`; validado em `cdsEdContratosPecBeforePost` (`<=0` bloqueia com "Indique um Número para o Contrato."). |
| `cbTipoNegociacao` | `TcxDBComboBox` | " Tipo de Negociação " | `Negociacao` | Sim | Lista fixa embutida no `.dfm` (`Properties.Items.Strings`): `COMPRA DE GADO`/`PARCERIA`/`DIÁRIAS DE BOITEL`/`TRANSFERÊNCIA`, mapeadas para `'C'/'P'/'D'/'T'` via `GetText`/`SetText` do campo `Negociacao` (grava só a 1ª letra) — não vem de `Tabelas.Tipo=22`. `ImmediatePost=True`. Validado (`EditValue=''` bloqueia com "Indique um Tipo de Negociação."). |
| `ceCodPessoaOrigem` | `TcxDBCurrencyEdit` | rótulo dinâmico (Fornecedor/Empresa, ver "1) Conceito") dentro de " Origem "→" Pessoa " | `PessoaOrigem` | Sim | `DecimalPlaces=0`; F2 abre `dbDispAjudaPessoa` (papel `'P1'/'E1'` conforme `sTipo`); `OnExit`→recarrega combo de Fazenda; `EditValueChanged`→busca nome em `DetPessoas` e preenche `lblPessoaOrigem` (não gravado, só exibição), com aviso "Pessoa não Cadastrada." se não encontrar. Validado (`<=0` bloqueia). |
| `lblPessoaOrigem` | `TcxLabel` | (sem caption fixo) | não vinculado a campo — texto calculado | — | Somente exibição do nome resolvido da Pessoa Origem. |
| `lkFazOrigem` | `TcxDBLookupComboBox` | " Fazenda " (grupo Origem) | `FazOrigem` (lookup `Descricao` de `DetPessoas`) | Sim | Lista (`cdsFazOrigem`) é recarregada a cada `ceCodPessoaOrigemExit`/no `FormShow` em modo Visualização — filtrada por `DetPessoas.Codigo=PessoaOrigem`. Validado (`<=0` bloqueia). |
| `ceCodPessoaDest` | `TcxDBCurrencyEdit` | rótulo dinâmico (Empresa/Cliente) dentro de " Destino "→" Pessoa " | `PessoaDest` | Sim | Mesmo padrão de `ceCodPessoaOrigem`, papel F2 `'E1'/'C1'` conforme `sTipo`; preenche `lblPessoaDest`. Validado (`<=0` bloqueia). |
| `lblPessoaDest` | `TcxLabel` | (sem caption fixo) | não vinculado a campo — texto calculado | — | Somente exibição do nome resolvido da Pessoa Destino. |
| `lkFazDest` | `TcxDBLookupComboBox` | " Fazenda " (grupo Destino) | `FazDest` (lookup `Descricao` de `DetPessoas`) | Sim | Análogo a `lkFazOrigem`, filtrado por `PessoaDest`. Validado (`<=0` bloqueia). |
| `ceCodConsultor` | `TcxDBCurrencyEdit` | rótulo dinâmico (Comprador/Vendedor) | `Consultor` | Não (sem checagem em `BeforePost`) | F2 abre `dbDispAjudaPessoa` (papel `'C3'/'V1'`); preenche `lblConsultor`; aviso "Consultor não Cadastrado." se código informado não existir — mas campo em si **não é obrigatório** para gravar o Contrato mestre (ausente da lista de validações do `BeforePost`). |
| `lblConsultor` | `TcxLabel` | (sem caption fixo) | não vinculado a campo — texto calculado | — | Somente exibição do nome resolvido do Consultor. |
| `mmObs` | `TcxDBMemo` | " Observações " | `Observacao` | Não | Texto livre. |
| `dnNavega` | `TcxDBNavigator` | (grupo topo) | — | — | Só expõe **Post** e **Cancel** (First/PriorPage/Prior/Next/NextPage/Last/Insert/Delete/Refresh/SaveBookmark/GotoBookmark/Filter todos `Visible=False`) — Inclusão/Edição/Exclusão do mestre são disparadas pelo chamador (`iSeq`/`Tag`), não por este navigator. |

Campos do dataset mestre presentes no `.dfm`/unit mas **sem controle editável na tela** (só carregados via SQL e usados internamente): `Tipo` (setado programaticamente = `sTipo`), `Data` (setada = `hoje` no insert), `Safra` (setada = `_iSafra` no insert), `Situacao`, `DocsRecebidos` — nenhum desses 4 últimos tem campo de edição no formulário (não aparecem em nenhum `TcxDB*Edit` do `.dfm`); ficam gravados com o valor herdado do registro (edição) ou em branco/default (inserção).

### 2.2 Detalhe — grid `gdITContratosPec` / `gdITContratosPecTabela` (`ItContratosPec`)

10 colunas em 3 bandas (Position.BandIndex 0/1/2), todas as colunas do `.dfm` estão listadas abaixo (nenhuma coluna omitida, nenhuma oculta):

| Coluna (`DataBinding.FieldName`) | Caption no grid | Classe/Properties | Editável pelo usuário | Obrigatório/Validação (`cdsItContratosPecBeforePost`) | Recalcula ao editar |
|---|---|---|---|---|---|
| `Avaliacao` | "Tipo de Avaliação" | `TcxLookupComboBoxProperties`, lista `dmPecuaria.dsAvaliacoes` (`Tabelas.Tipo=207`) | Sim | Sim — `<=0` bloqueia ("Indique a Avaliação.") | — |
| `Categoria` | (sem Caption custom, herda nome do campo) | `TcxLookupComboBoxProperties`, lista `dmPecuaria.dsCategorias` (`Tabelas.Tipo=172`) | Sim | Sim — `<=0` bloqueia ("Indique a Categoria.") | — |
| `Quantidade` | "Qtd." | `TcxCurrencyEditProperties`, `DecimalPlaces=0` | Sim | Sim — `<=0` bloqueia ("Indique a Quantidade.") | `Calculos(1)` e `Calculos(2)` |
| `RenCarcaca` | "R.C. (%)" | `TcxCurrencyEditProperties`, formato `,0.00` | Sim | Sim — `<=0` bloqueia ("Indique o Rendimento de Carcaça.") | `Calculos(1)` |
| `PesoTotal` | "Total" (banda Peso) | `TcxCurrencyEditProperties`, formato `,0.00` | Sim | Sim — `<=0` bloqueia ("Indique o Peso Total.") | `Calculos(1)` |
| `Total@` | "Total @" (banda Peso) | `TcxCurrencyEditProperties`, formato `,0.00`; **`Options.Editing=False`/`Options.Focusing=False`** | **Não** (somente calculado/exibição) | Não (não editável) | — (é destino do cálculo, não origem) |
| `PesoMedio@` | "Médio @" (banda Peso) | `TcxCurrencyEditProperties`, formato `,0.00`; **`Options.Editing=False`/`Options.Focusing=False`** | **Não** (somente calculado/exibição) | Não (não editável) | — (é destino do cálculo, não origem) |
| `DescontoKG` | "Deságio (%)" | `TcxCurrencyEditProperties`, formato `,0.00` | Sim | Não (sem checagem própria no `BeforePost` — só participa da fórmula do Modo 1) | `Calculos(1)` |
| `VlrCabeca` | "Por Cab." (banda Valor) | `TcxCurrencyEditProperties`, formato `,0.00` | Sim | Não | `Calculos(3)` |
| `Vlr@` | "Por @" (banda Valor) | `TcxCurrencyEditProperties`, formato `,0.00` | Sim | Não | `Calculos(3)` |
| `VlrTotal` | "Total" (banda Valor) | `TcxCurrencyEditProperties`, formato `,0.00` | Sim | Não | `Calculos(2)` e `Calculos(3)` |

Todas as colunas têm `Properties.Nullable=False`/`NullString='0'` — nenhum valor nulo é persistido, sempre `0` como piso de exibição. `dnITNavega` (navigator do detalhe) expõe Insert/Delete/Post/Cancel (First/Prior/Next/Last/Refresh/etc. ocultos) — Insert bloqueado se o mestre não estiver salvo (`cdsItContratosPecBeforeInsert`); Delete pede confirmação (`MessageDlg` Yes/No) e também exige mestre salvo.

---

## 5) Jornada do usuário + Especificação funcional

### SP-01 — Abrir a tela (`FormShow`)
Ajusta rótulos conforme `sTipo`; carrega o Contrato (`ContratosPec`); modo Inclusão/Edição/
Visualização conforme `iSeq`/`Tag`; carrega Categorias/Avaliações.

### SP-02 — Gravar o Contrato mestre (`cdsEdContratosPecBeforePost`)
Valida Número/Tipo de Negociação/Pessoa Origem/Fazenda Origem/Pessoa Destino/Fazenda Destino; se
inserção, gera `Sequencial` via `LoadSequencia`, `Safra`, `Tipo=sTipo`, `Data=hoje`.

### SP-03 — Gerenciar itens do detalhe
Mesmo padrão de bloqueio (detalhe requer mestre salvo) e validações (Avaliação/Categoria/
Quantidade/Rend.Carcaça/Peso Total) das 2 outras famílias de contrato.

### SP-04 — Recalcular valores → `Calculos(1/2/3)` (ver Conceito)

### 5.3 Regras de negócio e validações

Idênticas em espírito a `[[EdContVendaGado]]`/`[[EdContCompraGado]]`, aplicadas a `ContratosPec`/
`ItContratosPec`.

---

## 6) Integrações e dados

### 6.1 Integrações (internas)

- **`[[ContratoCVGado]]`** — tela chamadora (consulta/listagem).

### 6.2 Modelo de dados

**Tabela `ContratosPec`** — campos adicionais confirmados nesta unit, complementando
`[[ContratoCVGado]]`: `Safra`.

**Tabela `ItContratosPec`** (neste contexto, FK para `ContratosPec.Sequencial`) — mesmos campos
já documentados em `[[EdContVendaGado]]`.

### 6.3 Triggers e Procedures do banco

**`[[TIU_ItContratosPec]]`**/**`[[TD_ItContratosPec]]`** disparam ao gravar `ItContratosPec` aqui
— **achado de risco crítico, concreto**: essas triggers sempre executam `UPDATE Contratos SET
ValorTotal=..., TotalQtd=... WHERE Sequencial = @Contrato`, mas nesta unit `ItContratosPec.Contrato`
é um `ContratosPec.Sequencial`, **não** um `Contratos.Sequencial` (ver achado de FK compartilhada
em "1) Conceito"). Ou seja, toda gravação de um item de Contrato de Compra/Venda de Gado (`Tipo`)
dispara um `UPDATE` na tabela genérica `Contratos` usando um número que pertence a outro espaço de
PK — se os 2 espaços colidirem numericamente, **corrompe silenciosamente o total de um Contrato
não relacionado** (`GrupoComercial=7/8/9`); se não colidirem, o `UPDATE` é um no-op silencioso.
Nenhum erro é lançado em nenhum dos 2 casos.

---

## 7) Suporte: FAQ, mensagens, erros e troubleshooting

### 7.2 Catálogo de mensagens e erros

| Mensagem exata | Causa |
|---|---|
| "Indique um Número para o Contrato." / "Indique um Tipo de Negociação." / "Indique a Pessoa de Origem/Destino." / "Indique a Fazenda de Origem/Destino." | Validação do mestre |
| "Indique a Avaliação/Categoria/Quantidade/Rendimento de Carcaça/Peso Total." | Validação do detalhe |
| "Salve o Contrato para Inserir/Editar/Excluir Animais." | Ação no detalhe com mestre não salvo |
| "Pessoa não Cadastrada." / "Consultor não Cadastrado." | Busca de Pessoa sem correspondência |

---

## 9) Notas de revisão

- **2026-09-02** (auditoria de profundidade — dicionário de campos, módulo Pecuária)
  - **O que mudou:** releitura completa de `.pas` (689 linhas) e `.dfm` (1201 linhas). Seção "2)
    Dicionário de campos" reescrita: antes era um parágrafo resumido citando os controles "por
    nome"; agora lista, em tabela, **todos** os 11 controles do mestre (incluindo `lblSequencial`,
    `lblPessoaOrigem`/`Dest`/`Consultor` como rótulos calculados não-BD, e o achado de que
    `Consultor` **não é obrigatório** — ausente da lista de validações do `BeforePost`, apesar de
    ter aviso de "não cadastrado") e as **10 colunas do grid de detalhe** uma a uma, incluindo o
    achado de que `Total@` e `PesoMedio@` têm `Options.Editing=False`/`Options.Focusing=False`
    (somente calculados, não editáveis diretamente pelo usuário — só `PesoTotal`/`DescontoKG`/
    `RenCarcaca`/`Quantidade` alimentam esses 2 via `Calculos(1)`). Também documentados os 4 campos
    do mestre sem controle editável na tela (`Tipo`/`Data`/`Safra`/`Situacao`/`DocsRecebidos`).
  - **Fórmulas de cálculo:** confirmado e declarado explicitamente que as 5 fórmulas de
    `Calculos(1/2/3)` **não aplicam nenhum arredondamento** (`RoundTo`/`SimpleRoundTo`/`Round`/
    `Trunc`/`RoundX` ausentes) — só há máscara cosmética de exibição `,0.00`. Confirmado e
    declarado que **não há bloqueio de valor negativo** em `DescontoKG`, `VlrCabeca`, `Vlr@` e
    `VlrTotal` (as únicas checagens `<=0` do `BeforePost` cobrem `Avaliacao`/`Categoria`/
    `Quantidade`/`RenCarcaca`/`PesoTotal`).
  - **Não refeito (por instrução explícita):** investigação das triggers `TIU_ItContratosPec`/
    `TD_ItContratosPec` e o achado de risco crítico de corrupção silenciosa (seção 6.3) — já
    correto e detalhado, mantido sem alteração.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/EdContratoCVGado.pas` + `.dfm` (releitura completa
    nesta sessão).

- **2026-09-01** (auditoria de profundidade — módulo Pecuária)
  - **O que mudou:** identificadas `[[TIU_ItContratosPec]]`/`[[TD_ItContratosPec]]` — gap real de
    trigger não encontrada na varredura estrutural original. **Achado de risco crítico**: essas
    triggers concretizam o risco de FK compartilhada de `ItContratosPec` já suspeitado em
    `[[ContratoBoitel]]` — mostram o mecanismo exato (um `UPDATE Contratos` cego usando
    `ContratosPec.Sequencial` como chave) pelo qual a ambiguidade pode corromper dados
    silenciosamente ou falhar silenciosamente, sem gerar nenhum erro visível ao usuário.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** ver `[[TIU_ItContratosPec]]`, `[[TD_ItContratosPec]]`, `[[ContratoBoitel]]`.

- **2026-08-28** (criação da nota — módulo Pecuária)
  - **O que mudou:** nota criada do zero, a partir de leitura 100% literal de
    `Pecuaria/EdContratoCVGado.pas` (758 linhas) + `.dfm`. Completa o CRUD de
    `[[ContratoCVGado]]`. Documentado o despachante `Calculos(1/2/3)` (estilo de implementação
    diferente da família `Contratos` genérica) e o domínio fixo de `Negociacao` (4 valores,
    divergente de `Tabelas.Tipo=22`).
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/EdContratoCVGado.pas` + `.dfm`; ver
    `[[ContratoCVGado]]`, `[[EdContVendaGado]]`, `[[EdContCompraGado]]`.
