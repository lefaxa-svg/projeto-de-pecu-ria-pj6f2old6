> **Nota de método**: este documento descreve uma tela de um sistema LEGADO já em produção,
> reconstruída por engenharia reversa do código-fonte — não é uma especificação de feature nova
> obtida por entrevista com um PO. Por isso, toda seção que normalmente viria de uma conversa de
> negócio (motivação, métricas, objetivos) foi preenchida por **inferência a partir do
> comportamento do código**, e está marcada explicitamente como `(inferência)`. Onde nem o código
> nem o contexto do módulo permitem inferir nada com segurança, o campo está como `N/A`.
> Fonte: leitura 100% literal de `Pecuaria/AtualizSisBov.pas` (634 linhas, unit `AtualizSisBov`,
> classe `TfmAtualizSisBov`) e do `.dfm` correspondente (título confirmado "Atualização de
> Brincos SisBov"), nesta sessão — 65º arquivo `.pas` lido do módulo Pecuária. Item de menu
> `'AtualizSisBov'` (`[[iniModuloPecuaria]]`). Integração externa via **ADO/OLEDB Jet 4.0** lendo
> um arquivo Excel como planilha-tabela (não é integração de rede/API — é leitura de arquivo
> local exportado manualmente do sistema BND/SisBov do governo). Ver nota de método completa
> (limitação de DDL/tipos de coluna) em `[[ExportaDietas]]`, válida para todo o módulo.

---

**Status da implementação:** Legado — em produção (documentado via engenharia reversa, sem item de trabalho associado)

**Owner (curadoria):** @jefferson.arantes
**Tags:** #Pecuaria #SisBov #BND #Reconciliacao #Integracao

---

## 0) Resumo executivo

- **O que é:** tela de **reconciliação (conciliação) entre os dados locais de identificação
  animal (`BrincosIndividuais`) e um extrato oficial do SisBov/BND** (Banco Nacional de Dados de
  identificação animal, mantido pelo governo — sigla "BND" usada no código) exportado como
  planilha Excel. Compara Raça/Nascimento/Data de Inclusão no SisBov/Data de Liberação/Sexo entre
  o cadastro local ("B" = "Banco"/local) e o arquivo importado ("A" = "Arquivo"/externo), destaca
  divergências, e permite atualizar o cadastro local em massa para refletir o extrato oficial.
- **Leitura de Excel via driver OLEDB Jet, tratando a planilha como uma tabela SQL** —
  `adoBND.ConnectionString` usa `Provider=Microsoft.Jet.OLEDB.4.0;...Extended Properties=Excel
  8.0` e consulta `SELECT * FROM [Excel 8.0;Database=<arquivo>].[<1ª aba>]` — mecanismo clássico
  de importação de planilha sem biblioteca dedicada, dependente de driver de 32 bits instalado no
  cliente (achado de risco de compatibilidade: Jet 4.0/Excel 8.0 é um driver legado, pode falhar
  em SO/Office modernos de 64 bits sem o driver ACE correspondente).
- **Data de Liberação calculada por 2 parâmetros do sistema** (`Parametros.SaidaSisBovInc`/
  `SaidaSisBovTransf`, em dias) — se o arquivo não trouxer a coluna "Liberacao" (coluna
  opcional, verificada dinamicamente por nome), a Data de Liberação é calculada como Data de
  Inclusão + N dias, onde N depende de `RegSisBov` (`'S'`=Registro original / outro=Transferência)
  — a distinção de prazo de liberação para venda entre animal de registro próprio vs. transferido.
- **Impacto principal:** `UPDATE BrincosIndividuais` (Raça/Nascimento/`IncSisBov`/
  `LiberaSisBov`/`RegSisBov`/`ConciliadoBND`, em massa, envolto em transação nomeada por
  registro); `UPDATE BrincosMov.Categoria` (quando o Sexo do arquivo implica mudança de
  Categoria).

---

## 1) Conceito

| Termo | Definição |
|-------|-----------|
| "Encontrado" (S/N) determina o tratamento de cada Brinco | Casa os registros locais com o arquivo por `SisBov` (número de identificação nacional); se não encontrado no arquivo, `LiberaSisBov` é **zerado** (`Null`) na atualização — interpretação: um Brinco que não está mais no extrato oficial perde sua liberação registrada (achado de regra implícita, não documentada em comentário). |
| Pré-condição bloqueante — divergência de Sexo com Categoria igual exige correção manual antes de atualizar | `btnAtualizarClick` primeiro filtra por `Encontrado='S' and SexoB<>SexoA and (CatB=CatA or CatA=Null)` — se houver qualquer registro nessa condição, a atualização inteira é abortada com aviso, pedindo que o usuário corrija a Categoria manualmente na grade antes de prosseguir (a Categoria tem regra de sexo implícita — `Tabelas.SexoPec` — então uma mudança de Sexo pode invalidar a Categoria atual). |
| Cada `UPDATE` de Brinco é uma transação nomeada com verificação pós-commit | `BEGIN TRANSACTION AtualizaBrincos` ... `UPDATE` ... depois um `SELECT` de confirmação (`IF ConciliadoBND = <data> BEGIN COMMIT END ELSE ROLLBACK`) — um padrão defensivo de "verificar se realmente gravou" antes de confirmar, incomum no restante do módulo (a maioria confia no sucesso do `Execute` sem reverificação). |
| Estilo visual de 3 estados na grade (achado positivo de UX) | `gdAtualizTabelaStylesGetContentStyle`: vermelho = não encontrado no arquivo; azul = encontrado mas com qualquer divergência de campo; padrão = encontrado e sem divergência — permite triagem visual rápida, reforçada pelos filtros de menu de contexto (Encontrados/Não Encontrados/Com Alterações/Sem Alterações/Todos). |

---

## 2) Dicionário de campos da tela (`.dfm`)

| Controle | Classe | Rótulo/Caption | Vinculado a (campo BD) | Obrigatório | Observações |
|---|---|---|---|---|---|
| `cbFazendas` | `TcxLookupComboBox` | — (grupo "Fazendas") | escopo (`_iUnidNegoc`) | Sim (pré-condição da consulta) | Lista `DetPessoas` filtrado por `Pecuaria='S'` e permissão `UN` do usuário (exceto supervisor). `OnEditValueChanged` recarrega `cbRetiros`. |
| `cbRetiros` | `TcxLookupComboBox` | — (grupo "Retiros") | escopo (`Retiros.Sequencial`) | Sim (pré-condição da consulta) | Repovoado a cada troca de Fazenda; auto-seleciona o 1º retiro (`First`). Usado no `WHERE L.Retiro = ...` da consulta de Brincos. |
| `deData` | `TcxDateEdit` | " Data Conciliação " | `BrincosIndividuais.ConciliadoBND` (novo valor gravado em todas as linhas atualizadas) | Sim | Padrão = data do dia (`FormShow`); `Properties.DateButtons=[btnToday]`. |
| `beCaminho` | `TcxButtonEdit` | " Caminho do Arquivo " | caminho do arquivo Excel (não persistido) | Sim | Botão (`bkEllipsis`, `Default=True`) chama `AbreSaveOpen('L', S)` — diálogo de abrir arquivo do próprio ERP (não o `TOpenDialog` padrão, que está comentado/morto no código). `OnEditValueChanged` habilita `btnConsultar` apenas se `FileExists`. |
| `btnConsultar` | `TcxButton` | "Consultar" | — | — | `Tag=11047` (código de rotina p/ permissão/hint). Inicia `Enabled=False`; habilitado só com arquivo válido selecionado. |
| `btnAtualizar` | `TcxButton` | "Atualizar" | — | — | Inicia `Enabled=False`; habilitado após `btnConsultarClick` retornar linhas (`cdsAtualiz.RecordCount > 0`). |
| `btnExportar` | `TcxButton` | "Exportar" | — | — | Sempre habilitado; exporta a grade inteira (não respeita filtro de contexto) para `.xls` via `ExportGrid4ToExcel`. |
| `btnCancelar` | `TcxButton` | "Cancelar" | — | — | Fecha a tela (`Close`). |
| `gbProgresso`/`pbProgresso` | `TcxGroupBox`/`TcxProgressBar` | " Consultando "/" Atualizando " (caption trocado em runtime) | — | — | Oculto por padrão (`Visible=False` no .dfm); exibido durante `btnConsultarClick`/`btnAtualizarClick`, com `Application.ProcessMessages` a cada iteração. |
| `mmQuery` | `TcxMemo` | — | último SQL de consulta (`S.Text`) | — | Oculto por padrão (`Width=185`, painel lateral); alternado por `F9` (`FormKeyDown`). Só recebe o SQL de `btnConsultarClick` (a query de `btnAtualizarClick` não é jogada em `mmQuery`). |
| `pmAtualiz` (menu de contexto da grade) | `TPopupMenu` | Ver Encontrados/Ver Não Encontrados/Ver Alterações/Ver Sem Alterações/Ver Todos | filtro local (`cdsAtualiz.Filter`) | — | 5 itens `TMenuItem` (`miEncontrados`, `miNaoEncontrados`, `miAlteracoes`, `miSemAlteracoes`, `miTodos`), mutuamente exclusivos via `Checked` manual (não é `RadioItem`); cada um seta `cdsAtualiz.Filter`/`Filtered` (client-side, não reconsulta o banco/Excel). |

**Grid `gdAtualiz` / `gdAtualizTabela` (`TcxGridDBBandedTableView`, dataset `cdsAtualiz`, montado em memória a partir de `dmConsulta.cdsAux` + `qryBND`) — 3 bandas.** `DataController.KeyFieldNames='Sequencial'`; rodapé com contagem (`skCount` sobre `SisBov`, formato `'00 Brincos'`); estilo por linha via `gdAtualizTabelaStylesGetContentStyle` (ver Conceito). Todas as colunas de data usam `TcxDateEditProperties` (exibição, sem edição própria salvo indicado). Nenhuma coluna numérica com casas decimais existe nesta grade — os únicos campos editáveis pelo usuário são `RegSisBov` (checkbox) e `CatA` (combo), abaixo:

*Banda "BRINCO" (Position.BandIndex=0):*

| Coluna (`DataBinding.FieldName`) | Classe/Properties | Visível | Editável | Observações |
|---|---|---|---|---|
| `Sequencial` | padrão | **Não** (`Visible=False`) | Não (`Options.Editing=False`) | Chave interna do Brinco (`BrincosIndividuais.Sequencial`); usada só para filtros/updates, nunca exibida. |
| `Brinco` | padrão (texto) | Sim | Não | Número do brinco físico local. |
| `SisBov` | padrão (texto) | Sim | Não | Número de identificação nacional (chave de casamento com o arquivo Excel — `Locate` case-insensitive). `Styles.Footer = cxStyleDisable`. |
| `Encontrado` | padrão | **Não** (`Visible=False`) | — | `'S'`/`'N'` — usada só como base dos estilos/filtros, nunca mostrada como coluna própria (é comunicada visualmente pela cor da linha, ver Conceito). |
| `RegSisBov` | `TcxCheckBoxProperties` — `DisplayChecked='S'`/`DisplayUnchecked='N'`, `ValueChecked='S'`/`ValueUnchecked='N'`, `NullStyle=nssUnchecked`, `ImmediatePost=True` | Sim (Caption "Reg. SisBov") | **Sim** — único checkbox editável da grade | `OnEditValueChanged = gdAtualizTabelaRegSisBovPropertiesEditValueChanged`: pergunta "Deseja Recalcular a Data de Liberação para Atualização?" e, se Sim, recalcula `LiberacaoA` = `IncA` + (`iSaidaSisBovInc` se `RegSisBov='S'`, senão `iSaidaSisBovTransf`) — mesma fórmula usada na carga inicial (SP-03). |
| `ConciliadoBND` | `TcxDateEditProperties` | Sim (Caption "Conciliado") | Não | Data da última conciliação já gravada (antes da atualização atual). |

*Banda "SISTEMA" (dados locais/"B", Position.BandIndex=1):*

| Coluna | Classe/Properties | Visível | Editável | Observações |
|---|---|---|---|---|
| `RacaB` | padrão | **Não** (`Visible=False`) | Não | Código da raça local; a descrição é exibida via `DescRacaB`. |
| `DescRacaB` | padrão (texto) | Sim (Caption "Raça") | Não | Raça vinda de `Tabelas.DescricaoVar` (Tipo 166). |
| `NascB` | `TcxDateEditProperties` | Sim (Caption "Nascimento") | Não | Data de nascimento local. |
| `IncB` | `TcxDateEditProperties` | Sim (Caption "Inclusão") | Não | `BrincosIndividuais.IncSisBov` local. |
| `LiberacaoB` | `TcxDateEditProperties` | Sim (Caption "Liberação") | Não | `BrincosIndividuais.LiberaSisBov` local. |
| `CatB` | padrão | **Não** (`Visible=False`) | Não | Código da categoria local; descrição em `DescCatB`. |
| `DescCatB` | padrão (texto) | Sim (Caption "Categoria") | Não | Categoria vigente do animal (via subquery de última movimentação). |
| `SexoB` | padrão (texto) | Sim (Caption "Sexo") | Não | `Tabelas.SexoPec` (Tipo 172) da categoria local. |

*Banda "ARQUIVO/AJUSTES" (dados do extrato Excel/"A", Position.BandIndex=2):*

| Coluna | Classe/Properties | Visível | Editável | Observações |
|---|---|---|---|---|
| `RacaA` | padrão | **Não** (`Visible=False`) | Não | Código da raça mapeado do arquivo (via `dmPecuaria.cdsRaca.Locate('RacaSisBov', ...)`, `Tabelas.DescricaoVar`, Tipo 166); permanece vazio se a descrição do arquivo não bater com nenhuma raça cadastrada. |
| `DescRacaA` | padrão (texto) | Sim (Caption "Raça") | Não | Texto de raça cru vindo da coluna "Raca" do Excel. |
| `NascA` | `TcxDateEditProperties` | Sim (Caption "Nascimento") | Não | Convertida via `StrToDate` da coluna "Nascimento" do Excel — sem tratamento de exceção específico (falha de formato de data no Excel propaga erro não tratado). |
| `IncA` | `TcxDateEditProperties` | Sim (Caption "Inclusão") | Não | Convertida via `StrToDate` da coluna "Inclusao". |
| `LiberacaoA` | `TcxDateEditProperties` | Sim (Caption "Liberação") | Não (via grade — só muda por recálculo automático ao editar `RegSisBov`) | Coluna "Liberacao" do Excel se existir e não vazia; senão calculada (ver fórmula em `RegSisBov` acima e em Conceito). |
| `CatA` | `TcxLookupComboBoxProperties` — `KeyFieldNames='Codigo'`, lista `dmPecuaria.dsCategorias` (coluna `Descricao`), `DropDownListStyle=lsFixedList`, `ImmediatePost=True` | Sim (Caption "Categoria") | **Sim** — único combo editável da grade | Pré-carregado com `CatB` se o Sexo da categoria local bater com o Sexo do arquivo, senão fica vazio (`Clear`) — é o campo que o usuário deve preencher manualmente para destravar o `btnAtualizar` quando há divergência de Sexo com Categoria igual (BR-001). |
| `SexoA` | padrão (texto) | Sim (Caption "Sexo") | Não | 1º caractere da coluna "Sexo" do Excel. |

**Achado de auditoria de profundidade:** nenhuma coluna desta grade envolve valor numérico decimal, e portanto não há `RoundTo`/`SimpleRoundTo`/`Round`/`Trunc`/`FormatFloat` em nenhum cálculo da tela — confirmado por leitura completa do `.pas`. O único "cálculo" da tela é a soma de dias em data (`LiberacaoA:= IncA + N`, aritmética de `TDateTime`, sem arredondamento aplicável) e `N` (`iSaidaSisBovInc`/`iSaidaSisBovTransf`) é sempre um inteiro não-negativo vindo de `Parametros` — não há campo de entrada numérico na tela (`RegSisBov` é checkbox, `CatA` é combo, os demais são datas/texto somente-leitura), logo a pergunta de "aceita valor negativo" não se aplica a nenhum campo editável desta tela.

---

## 5) Jornada do usuário + Especificação funcional

### SP-01 — Abrir a tela (`FormShow`)
Carrega `Parametros.SaidaSisBovInc`/`SaidaSisBovTransf` (prazos em dias); carrega Fazendas/Raças/
Categorias; Data padrão = hoje.

### SP-02 — Selecionar o arquivo Excel (`beCaminhoPropertiesButtonClick`)
Abre diálogo de seleção de arquivo; habilita "Consultar" apenas se o arquivo existir.

### SP-03 — Consultar/Comparar (`btnConsultarClick`)

**Pseudocódigo fiel (resumido):**
```
buscar Brincos ativos (não mortos) com Movimento no Retiro/Safra atual, incluindo Categoria
  vigente (via subquery de última MovAnimais/BrincosMov, mesmo padrão de "última movimentação"
  já visto em outras units do módulo)
se houver Brincos:
  conectar ao Excel via ADO/Jet (planilha inteira como 1 tabela)
  detectar dinamicamente se existe coluna "Liberacao" no arquivo
  para cada Brinco local:
    copiar dados "B" (local) para a grade cdsAtualiz
    localizar por SisBov no arquivo:
      se encontrado: Encontrado='S'; copiar dados "A" (arquivo); mapear Raça do SisBov para
        Raça local via Tabelas.DescricaoVar; calcular LiberacaoA (do arquivo, ou calculada por
        Inclusão+prazo); herdar Categoria se o Sexo bater, senão limpar
      senão: Encontrado='N'
  exibir progresso; ao final, habilitar "Atualizar" se houver linhas
```

### SP-04 — Corrigir Categoria manualmente (edição inline na coluna Categoria A)
Ao editar `RegSisBov` na grade, oferece recalcular a Data de Liberação.

### SP-05 — Atualizar em massa (`btnAtualizarClick`)
Bloqueia se houver divergência de Sexo com Categoria igual/não ajustada (ver Conceito); senão,
filtra apenas os registros não-encontrados ou com alguma divergência, e para cada um executa a
transação de `UPDATE` (ver Conceito) com verificação pós-commit; acumula falhas para relatar ao
final; recarrega a consulta.

### SP-06 — Exportar (`btnExportarClick`)
Exporta a grade inteira para `.xls` via `ExportGrid4ToExcel`.

### 5.3 Regras de negócio e validações

- **BR-001 — Divergência de Sexo com Categoria igual bloqueia a atualização inteira.** Mensagem:
  "Existem Brincos com Sexo diferente do Arquivo. Selecione a categoria correta para esses
  Brincos."
- **BR-002 — Apenas registros não-encontrados ou com divergência são de fato atualizados**
  (filtro aplicado antes do loop de `UPDATE`).
- **BR-003 — Brinco não encontrado no arquivo tem `LiberaSisBov` zerado.**

---

## 6) Integrações e dados

### 6.1 Integrações (internas/externas)

- **Arquivo Excel externo (extrato SisBov/BND)** — via ADO/OLEDB Jet 4.0, tratado como fonte de
  dados tabular somente-leitura.
- **`Parametros.SaidaSisBovInc`/`SaidaSisBovTransf`** — parâmetros de prazo (dias) para cálculo
  de Data de Liberação.
- **`ExportGrid4ToExcel`** — biblioteca de exportação de grid, genérica do ERP.

### 6.2 Modelo de dados

Atualiza **`BrincosIndividuais`** (campos adicionais confirmados: `ConciliadoBND`, `RegSisBov`,
`IncSisBov`, `LiberaSisBov`) e **`BrincosMov.Categoria`** — ambas já parcialmente documentadas em
notas anteriores do módulo.

### 6.3 Triggers e Procedures do banco

**Correção (auditoria 2026-09-08): `[[TU_BrincosIndividuais]]` é disparada** pelo `UPDATE
BrincosIndividuais` desta unit (trigger de tabela reage independente do mecanismo de escrita,
mesmo sendo SQL direto sem `EXEC` de procedure) — sempre que `IncSisBov` é alterado, recalcula
`MovAnimais.MediaIncSisBov` dos movimentos vinculados. Esta unit é o gatilho real que a nota da
trigger deixava como "origem não identificada".

---

## 7) Suporte: FAQ, mensagens, erros e troubleshooting

### 7.2 Catálogo de mensagens e erros

| Mensagem exata | Causa |
|---|---|
| "O Arquivo selecionado não contem informações validas." | Excel sem linhas |
| "Existem Brincos com Sexo diferente do Arquivo. Selecione a categoria correta para esses Brincos." | Bloqueio de atualização (ver BR-001) |
| "Serão Atualizados somente os brincos com informações diferentes, alteradas ou não encontrados." | Aviso informativo antes de atualizar |
| "Atualização dos Brincos concluída com Sucesso!" / "Os brincos abaixo não foram atualizados." + lista | Resultado da atualização em massa |
| "Nenhum brinco Inconsistente encontrado." | Nenhuma linha elegível para atualização |
| "Deseja Recalcular a Data de Liberação para Atualização?" | Ao editar `RegSisBov` manualmente |

---

## 9) Notas de revisão

- **2026-09-08** (auditoria campo-a-campo — correção de "nenhuma trigger identificada")
  - **O que mudou:** corrigido erro da nota — o `UPDATE BrincosIndividuais` desta unit **dispara**
    `[[TU_BrincosIndividuais]]` (recalcula `MovAnimais.MediaIncSisBov` quando `IncSisBov` muda).
    Resolve, do lado da trigger, a dúvida "gatilho de `UPDATE(IncSisBov)` não identificado".
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** `[[TU_BrincosIndividuais]]`.

- **2026-09-02** (auditoria de profundidade campo-a-campo, pós-achados do módulo Algodoeira)
  - **O que mudou:** releitura 100% literal de `AtualizSisBov.pas` (634 linhas) e `.dfm` (1267
    linhas) nesta sessão. Gap real encontrado: a seção "2) Dicionário de campos" resumia a grade
    `gdAtualiz` (22 colunas em 3 bandas — BRINCO/SISTEMA/ARQUIVO-AJUSTES) em **uma única linha**,
    sem listar campos ocultos (`Sequencial`, `Encontrado`, `RacaB`, `CatB`, `RacaA` — todos
    `Visible=False`, usados só internamente para chave/filtro/estilo) nem identificar quais
    colunas são de fato editáveis pelo usuário (apenas `RegSisBov`, um checkbox com
    `OnEditValueChanged` que recalcula `LiberacaoA`, e `CatA`, um combo de categoria que é o
    campo usado para destravar o BR-001). Corrigido: dicionário expandido para 1 tabela por banda,
    com Classe/Properties, Visível, Editável e Observações coluna a coluna. Também corrigido o
    controle `beCaminho` (o diálogo de arquivo é `AbreSaveOpen('L', S)`, um componente próprio do
    ERP — não o `TOpenDialog` comentado/morto no código, como uma leitura apressada poderia sugerir)
    e detalhado o menu de contexto `pmAtualiz` (5 filtros mutuamente exclusivos via `Checked`
    manual, client-side sobre `cdsAtualiz.Filter`).
  - **Confirmado (sem gap):** não há nenhum campo numérico decimal na tela — o único "cálculo" é
    soma de dias inteiros em data (`LiberacaoA:= IncA + N`), sem `RoundTo`/`Round`/`Trunc`/
    `FormatFloat` aplicável e sem campo de entrada que aceite valor negativo (declarado
    explicitamente agora na seção 2). Caminho de menu (`[[iniModuloPecuaria]]`, item
    `'AtualizSisBov'`) já estava correto e confirmado — não havia "chamador não identificado"
    pendente. Nenhuma tela satélite é aberta por esta unit (sem `ShowModal`/`CreateForm` de outro
    form no `.pas`), então não havia referência cruzada pendente a corrigir.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/AtualizSisBov.pas` + `.dfm` (releitura completa);
    `[[iniModuloPecuaria]]`.

- **2026-08-28** (criação da nota — módulo Pecuária)
  - **O que mudou:** nota criada do zero, a partir de leitura 100% literal de
    `Pecuaria/AtualizSisBov.pas` (634 linhas) + `.dfm` (título confirmado "Atualização de Brincos
    SisBov"). Documentada a reconciliação entre `BrincosIndividuais` e um extrato Excel oficial
    do SisBov/BND via ADO/Jet, com destaque visual de divergências e atualização transacional em
    massa. Achado de risco: dependência do driver legado Jet 4.0/Excel 8.0 (compatibilidade com
    SO/Office modernos).
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/AtualizSisBov.pas` + `.dfm`; ver
    `[[iniModuloPecuaria]]`.
