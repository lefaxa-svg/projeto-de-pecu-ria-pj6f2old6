> **Nota de método**: este documento descreve uma tela de um sistema LEGADO já em produção,
> reconstruída por engenharia reversa do código-fonte — não é uma especificação de feature nova
> obtida por entrevista com um PO. Por isso, toda seção que normalmente viria de uma conversa de
> negócio (motivação, métricas, objetivos) foi preenchida por **inferência a partir do
> comportamento do código**, e está marcada explicitamente como `(inferência)`. Onde nem o código
> nem o contexto do módulo permitem inferir nada com segurança, o campo está como `N/A`.
> Fonte: leitura 100% literal de `Pecuaria/CustoRacoes.pas` (447 linhas, unit `CustoRacoes`,
> classe `TfmCustoRacoes`) e do `.dfm` correspondente (título confirmado "Custos das Dietas"),
> nesta sessão — 45º arquivo `.pas` lido do módulo Pecuária. Cadastro de `CustoRacoes`, que ao
> gravar/excluir chama `[[spGeraCustoDieta]]` (118 linhas, lida integralmente nesta sessão) —
> gera/desfaz um par de documentos de estoque simbólicos que ajusta o preço médio do Produto
> associado à Dieta. Ver nota de método completa (limitação de DDL/tipos de coluna) em
> `[[ExportaDietas]]`, válida para todo o módulo.

---

**Status da implementação:** Legado — em produção (documentado via engenharia reversa, sem item de trabalho associado)

**Owner (curadoria):** @jefferson.arantes
**Tags:** #Pecuaria #Dieta #Custo #Estoque #PrecoMedio

---

## 0) Resumo executivo

- **O que é:** cadastro em grade "Custos das Dietas" — registra, por Fazenda/Unidade de
  Armazenamento e Data, o custo por Kg (`CustoKg`) de uma Dieta (`Produto` associado, via
  `Tabelas.Tipo=183`), e ao gravar dispara `[[spGeraCustoDieta]]` para lançar um par de
  documentos de estoque de Entrada/Saída que **ajusta o preço médio corrente** do Produto.
- **Impacto principal:** `INSERT`/`DELETE` em `CustoRacoes` + `INSERT`/`DELETE` em
  `DocEstoque`/`ItDocEstoque` (via `[[spGeraCustoDieta]]`) — efeito real no preço médio do
  Produto usado em outras rotinas de custo (`[[TIU_TratosPec]]`).

---

## 1) Conceito

| Termo | Definição |
|-------|-----------|
| A geração do par de documentos só ocorre na **inclusão**, não na edição | `cdsCadastroAfterPost`: `bGeraCustoDieta := bInsert` (capturado **antes** de `CommitTransacaoTabelas`, que reseta as flags) — só chama `GeraCustoDieta(1)` quando o registro foi recém-inserido; editar um `CustoKg` já existente **não** gera um novo ajuste de preço médio. |
| A Fazenda é travada durante Inclusão/Edição, com aviso ao tentar trocar | `cbFazendaPropertiesInitPopup`: mesmo padrão já visto em `[[FracaoMSRacoes]]`/`[[FracMSProd]]` — "Salve o registro para alterar a Fazenda." |
| A exclusão desfaz o ajuste de preço médio antes de excluir o registro de custo | `cdsCadastroBeforeDelete`: chama `GeraCustoDieta(0)` **antes** da confirmação de exclusão prosseguir — se a reversão dos documentos de estoque falhar (exceção em `GeraCustoDieta`), `Abort` interrompe todo o fluxo, incluindo a exclusão do registro de `CustoRacoes` (que só ocorre depois, via `ApplyUpdates`). |
| Erro em `GeraCustoDieta` sempre aborta a operação corrente | `GeraCustoDieta`: em caso de exceção, mostra "Ocorreram erros na Geração do Custo da Dieta." e chama `Abort` — garante que o registro de `CustoRacoes` não fique "órfão" sem seus documentos de estoque correspondentes (mas não hà rollback explícito do lado Delphi além do que a trigger/provider já fariam). |
| A lista de Dietas é carregada 2 vezes com filtros idênticos, em datasets diferentes | Mesmo padrão de duplicação já visto em outras telas do módulo — `cdsCadDietas` (local, com "..: TODOS :..") para o filtro, `dmPecuaria.cdsCadDietas` (compartilhado) para a grade. |

---

## 2) Dicionário de campos da tela (`.dfm`)

| Controle | Classe | Rótulo/Caption | Vinculado a (campo BD) | Obrigatório | Observações |
|---|---|---|---|---|---|
| `cbFazenda` | `TcxLookupComboBox` (grupo "Fazenda") | — | `CustoRacoes.Fazenda` (aplicado a todo novo registro) | Sim (implícito — sempre há uma Fazenda selecionada, default `_iUnidNegoc`) | Travada durante Inclusão/Edição (`cbFazendaPropertiesInitPopup` aborta com "Salve o registro para alterar a Fazenda."); ao trocar, recarrega `UnidArmaz`/`cbDieta`/grade de Dietas e reconsulta automaticamente. |
| `cbDieta` (grupo "Critérios de Seleção"→"Dieta") | `TcxLookupComboBox` | — | filtro apenas, sobre `Produto` | Não | Lista `Tabelas.Tipo=183` da Fazenda+Safra + "..: TODOS :.." (`Codigo=0`); `DropDownListStyle` fixo (não editável livre, presumido pelo padrão do módulo). |
| `deInicio`/`deFinal` (grupo "Data") | `TcxDateEdit` | — | filtro apenas, sobre `Data` | Não | Default: 1º de janeiro do ano corrente / hoje. Filtro só é aplicado se ambas as datas forem não-nulas e `>0` (`deInicio.EditValue<>null` e `.Date>0`). |
| `btnConsulta` | `TcxButton` | "Consultar" | — | — | Dispara SP-03. |
| `btnImprimir` | `TcxButton` | — | — | — | Dispara SP-05 (relatório `CustoDietasSimples.rtm`). |
| `btnExcel` | `TcxButton` | — | — | — | Dispara SP-06 (exportação `ExportGrid4ToExcel`). |
| `dnNavega` | `TcxDBNavigator` | — | — | — | Apenas Inserir/Excluir visíveis (`Edit`/`First`/`PriorPage`/`Prior`/`Next`/`NextPage`/`Last`/`Refresh`/`SaveBookmark`/`GotoBookmark`/`Filter` com `Visible=False`) — **confirma "sem F5"**: não há botão Editar porque a edição é sempre inline na própria grade (célula focada), não há modo "Editar registro" separado do "clicar na célula". |
| `mmQuery` | `TcxMemo` | — | — | Oculto por padrão (`Visible=False` no `.dfm`) | Painel de debug — alternado por `Ctrl+F9` (`mmQuery.Visible:= NOT mmQuery.Visible`), populado com o SQL da última consulta (`mmQuery.Lines:=S` em `btnConsultaClick`). |

**Grid `gdCadastroTabela`** (`TcxGridDBTableView`, editável inline — `OptionsCustomize.ColumnMoving=False`, sem bandas):

| Coluna | Caption | Campo | Editável | Obrigatório (`BeforePost`) | Formatação/Origem |
|---|---|---|---|---|---|
| `gdCadastroTabeladata` | "Data" | `Data` | Sim | **Sim** — nula → "Indique a Data." | Sem `PropertiesClassName` explícito (edit de data padrão do grid); default = hoje (`Date`) ao inserir. |
| `gdCadastroTabelaproduto` | "Dieta" | `Produto` | Sim | **Sim** — nula → "Indique o produto." | `TcxLookupComboBoxProperties`, lista `dmPecuaria.dsCadDietas` (`Tabelas.Tipo=183` da Fazenda+Safra, **sem** opção "..: TODOS :.." — diferente do filtro `cbDieta`), `KeyFieldNames='Codigo'`, `ImmediatePost=True`. |
| `gdCadastroTabelaUnidArmaz` | "Unid. Armaz." | `UnidArmaz` | Sim | **Não** — não há checagem `IsNull`/`<=0` em `cdsCadastroBeforePost`; **gap confirmado nesta releitura**: o campo é apresentado como editável na grade (lookup de `Locais TipoLocal='UA'`) mas pode ficar não preenchido sem nenhum aviso, diferente de Data/Produto/CustoKg. | `TcxLookupComboBoxProperties`, lista `dmConsulta.dsUnidArmaz` (filtrada por `cbFazenda` + permissão `'UA'`), `KeyFieldNames='Codigo'`, `ImmediatePost=True`. |
| `gdCadastroTabelacustoKg` | "Custo/Kg" | `CustoKg` | Sim | **Sim** — nulo → "Indique o custo por Kg." | `TcxCurrencyEditProperties`, `DisplayFormat`/`EditFormat='0.0000'` (**4 casas decimais**, mais preciso que o padrão `0.00` de valores monetários vistos em outras telas do módulo — coerente com ser um custo unitário por Kg), `Nullable=False`, `NullString='0.0000'`, alinhado à direita. **Sem `Properties.MinValue`** — nenhuma trava contra valor negativo no `.dfm`, e `cdsCadastroBeforePost` só verifica `IsNull` (não verifica `<=0` nem `<0`) — um `CustoKg` negativo ou zero é tecnicamente aceito e gravado, e seria propagado por `[[spGeraCustoDieta]]` ao ajuste de preço médio do Produto. |
| `gdCadastroTabelaDocEstEnt` | "Doc. Ent." | `DocEstEnt` | **Não** (`Options.Editing=False`) | — | Somente-exibição, estilizada com `Styles.Content=dmITP.cxStyleDisable` (visual de campo desabilitado) — número do documento de estoque de Entrada gerado por `[[spGeraCustoDieta]]`, via `JOIN ItDocEstoque`→`DocEstoque`. |
| `gdCadastroTabelaDocEstSaida` | "Doc. Saída" | `DocEstSaida` | **Não** (`Options.Editing=False`) | — | Idêntico a `DocEstEnt`, para o documento de Saída. |

Não há fórmula de cálculo nesta tela — `CustoKg` é digitado manualmente pelo usuário (não derivado de
outros campos); a única operação matemática relacionada ocorre dentro de `[[spGeraCustoDieta]]`
(fora do escopo `.pas`/`.dfm` desta unit, já documentada separadamente), não em nenhum
`OnEditValueChanged`/`BeforePost` desta tela.

---

## 5) Jornada do usuário + Especificação funcional

### SP-01 — Abrir a tela (`FormShow`)
Aplica permissão de somente-leitura; carrega Fazendas permitidas e Dietas da Fazenda+Safra
corrente; período padrão desde 1º de janeiro. **Não consulta automaticamente** (comentário
`//btnConsultaClick(Sender)`).

### SP-02 — Trocar Fazenda (`cbFazendaPropertiesEditValueChanged`)
Recarrega Unidades de Armazenamento (`Locais`, `TipoLocal='UA'`, com checagem de permissão) e
Dietas; reconsulta automaticamente.

### SP-03 — Consultar (`btnConsultaClick`)
```
SELECT C.Sequencial, C.Safra, C.Data, C.Produto, C.CustoKg, C.Fazenda, C.UnidArmaz, C.MovEstEnt,
       DE.Numero DocEstEnt, C.MovEstSaida, DS.Numero DocEstSaida
FROM CustoRacoes C
  LEFT JOIN ItDocEstoque IE ON C.MovEstEnt = IE.Sequencial LEFT JOIN DocEstoque DE ON IE.SeqMov = DE.Sequencial
  LEFT JOIN ItDocEstoque I ON C.MovEstSaida = I.Sequencial LEFT JOIN DocEstoque DS ON I.SeqMov = DS.Sequencial
WHERE C.Safra=<_iSafra> AND C.Fazenda=<cbFazenda>
[AND C.Produto=<cbDieta>] [AND C.Data BETWEEN ... AND ...]
ORDER BY C.Data
```

### SP-04 — Incluir/Editar/Excluir na grade (navegador `dnNavega`, atalhos F3/F4/F6/F7 — **sem
F5**)

**Pseudocódigo fiel:**
```
ao inserir novo registro:
  Data := hoje
  focar a grade, coluna "Data"

ao gravar (Post):
  se Data nula: avisar "Indique a Data." e abortar
  senão se Produto nulo: avisar "Indique o produto." e abortar
  senão se CustoKg nulo: avisar "Indique o custo por Kg." e abortar
  senão se é Inclusão:
    Sequencial := LoadSequencia('CustoRacoes', 'Sequencial')
    Safra := _iSafra
    Fazenda := cbFazenda.EditValue
  CommitTransacaoTabelas(...)
  se foi Inclusão: EXEC spGeraCustoDieta(Acao=1, ...) — gera par de docs de estoque
  Refresh (recarrega a linha com DocEstEnt/DocEstSaida atualizados)

ao excluir:
  EXEC spGeraCustoDieta(Acao=0, ...) — desfaz o par de docs de estoque
  (se falhar, aborta antes de prosseguir)
  confirmar "Deseja Realmente Excluir o Registro Selecionado?"
  se confirmado: prosseguir com a exclusão do registro de CustoRacoes
```
**Achado:** a chamada de `GeraCustoDieta(0)` acontece **antes** da confirmação
("Deseja Realmente Excluir...?") ser exibida — ou seja, os documentos de estoque já são desfeitos
mesmo que o usuário cancele a confirmação em seguida (a ordem no código é: `GeraCustoDieta(0)`
primeiro, depois `MessageDlg` de confirmação) — **risco real**: se o usuário responder "Não" à
confirmação, o par de documentos de estoque já foi excluído, mas o registro `CustoRacoes`
permanece (com `MovEstEnt`/`MovEstSaida` agora `NULL`), ficando num estado inconsistente sem os
documentos de estoque correspondentes.

### SP-05 — Imprimir (`btnImprimirClick`, template `CustoDietasSimples.rtm`)

### SP-06 — Exportar para Excel (`btnExcelClick`)

### 5.3 Regras de negócio e validações

#### BR-001 — Data obrigatória
- **Mensagem:** "Indique a Data."

#### BR-002 — Produto obrigatório
- **Mensagem:** "Indique o produto."

#### BR-003 — Custo por Kg obrigatório
- **Mensagem:** "Indique o custo por Kg."

#### BR-004 — Risco de inconsistência na exclusão (ver Conceito/SP-04)

#### BR-005 — `UnidArmaz` e `CustoKg` sem validação de conteúdo/sinal (achado da auditoria de
profundidade 2026-09-02)
- `UnidArmaz` (Unidade de Armazenamento) é editável na grade mas **não é validado** em
  `cdsCadastroBeforePost` — pode ficar vazio (`0`/`Null`) sem nenhum aviso, diferente de
  Data/Produto/CustoKg.
- `CustoKg` só é validado quanto a `IsNull` — não há checagem de valor negativo ou igual a zero;
  um custo negativo é aceito e propagado ao ajuste de preço médio via `[[spGeraCustoDieta]]`.

---

## 6) Integrações e dados

### 6.1 Integrações (internas)

- **`[[spGeraCustoDieta]]`** (118 linhas, lida integralmente) — gera/desfaz documentos de
  estoque simbólicos.
- **`Tabelas.Tipo=183`** (Dieta) — via `Produto`.
- **`Locais`** (`TipoLocal='UA'`) — Unidades de Armazenamento.
- **`DocEstoque`/`ItDocEstoque`** — módulo de Estoque do ERP (fora do módulo Pecuária).

### 6.2 Modelo de dados

**Tabela `CustoRacoes`** (própria):

| Coluna | Tipo (Delphi/inferido) | Papel nesta tela |
|---|---|---|
| `Sequencial` | `TIntegerField` (persistente) — `int` (alta confiança) | Chave — gerada por `LoadSequencia`. |
| `Safra`/`Fazenda`/`UnidArmaz` | `TIntegerField` (persistente) — `int` (alta confiança) | Escopo. |
| `Data` | `TSQLTimeStampField` (persistente) — `datetime` (alta confiança) | Data de vigência do custo. |
| `Produto` | `TIntegerField` (persistente) — `int` (alta confiança) | FK para `Tabelas.Codigo` (`Tipo=183`). |
| `CustoKg` | `TFloatField` (persistente) — `float`/`real` (alta confiança) | Custo por Kg informado manualmente. |
| `MovEstEnt`/`MovEstSaida` | `TIntegerField` (persistente, nullable) — `int` (alta confiança) | FK para `ItDocEstoque.Sequencial` (par de documentos gerado por `spGeraCustoDieta`). |

### 6.3 Triggers e Procedures do banco

- **`[[spGeraCustoDieta]]`** — gera/desfaz o par de documentos de estoque.

---

## 7) Suporte: FAQ, mensagens, erros e troubleshooting

### 7.2 Catálogo de mensagens e erros

| Mensagem exata | Causa |
|---|---|
| "Indique a Data." | BR-001 |
| "Indique o produto." | BR-002 |
| "Indique o custo por Kg." | BR-003 |
| "Salve o registro para alterar a Fazenda." | Tentativa de trocar Fazenda durante Inclusão/Edição |
| "Ocorreram erros na Geração do Custo da Dieta." + detalhe | Falha em `spGeraCustoDieta` |
| "Deseja Realmente Excluir o Registro Selecionado?" | Confirmação de exclusão (após já ter desfeito os docs de estoque — ver achado) |

---

## 9) Notas de revisão

- **2026-09-02** (auditoria de profundidade campo-a-campo — dicionário de campos)
  - **O que mudou:** seção "2) Dicionário de campos" expandida — grade `gdCadastroTabela`
    desmembrada coluna a coluna (6 colunas) em vez de resumo em uma linha; adicionados `dnNavega`
    e detalhamento de `btnImprimir`/`btnExcel` que faltavam. **Achados**: (1) coluna `UnidArmaz`
    é editável na grade mas não é validada em `cdsCadastroBeforePost` (pode ficar vazia sem
    aviso); (2) `CustoKg` usa `DisplayFormat='0.0000'` (4 casas decimais, não 2) e não tem
    `Properties.MinValue` nem validação de sinal — apenas `IsNull` é checado, então valor
    negativo/zero é tecnicamente aceito e propagado ao ajuste de preço médio via
    `[[spGeraCustoDieta]]`; (3) confirmado explicitamente que não há nenhuma fórmula de cálculo
    nesta unit (`CustoKg` é digitado manualmente, não derivado); (4) confirmado, via `.dfm`, que
    `DocEstEnt`/`DocEstSaida` são as únicas colunas com `Options.Editing=False` (estilo visual
    "desabilitado", `cxStyleDisable`) — nenhum outro controle oculto/desabilitado identificado.
    Achados registrados como BR-005. Não foi necessário reabrir a investigação de
    `[[spGeraCustoDieta]]` (já documentada e correta).
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** releitura de `Pecuaria/CustoRacoes.pas` (447 linhas) e `.dfm` nesta sessão.

- **2026-08-28** (criação da nota — módulo Pecuária)
  - **O que mudou:** nota criada do zero, a partir de leitura 100% literal de
    `Pecuaria/CustoRacoes.pas` (447 linhas) + `.dfm` (título confirmado "Custos das Dietas").
    Documentado o cadastro de custo manual de Dieta e a integração com `[[spGeraCustoDieta]]`
    (lida integralmente, gera par de documentos de estoque simbólicos para ajustar preço médio).
    Achado de risco: a reversão dos documentos de estoque na exclusão ocorre **antes** da
    confirmação do usuário, podendo deixar o registro `CustoRacoes` inconsistente se o usuário
    cancelar a confirmação.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/CustoRacoes.pas` + `.dfm`; `[[spGeraCustoDieta]]`;
    ver `[[FracaoMSRacoes]]`, `[[FracMSProd]]`, `[[TIU_TratosPec]]`.
