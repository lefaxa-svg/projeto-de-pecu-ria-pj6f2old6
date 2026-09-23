> **Nota de método**: este documento descreve uma tela de um sistema LEGADO já em produção,
> reconstruída por engenharia reversa do código-fonte — não é uma especificação de feature nova
> obtida por entrevista com um PO. Por isso, toda seção que normalmente viria de uma conversa de
> negócio (motivação, métricas, objetivos) foi preenchida por **inferência a partir do
> comportamento do código**, e está marcada explicitamente como `(inferência)`. Onde nem o código
> nem o contexto do módulo permitem inferir nada com segurança, o campo está como `N/A`.
> Fonte: leitura 100% literal de `Pecuaria/EdDadosAbate.pas` (850 linhas, unit `EdDadosAbate`,
> classe `TfmEdDadosAbate`) e do `.dfm` correspondente (título confirmado "Edição dos Dados de
> Abate"), nesta sessão — 75º arquivo `.pas` lido do módulo Pecuária. **Completa `[[DadosAbate]]`**
> (CRUD real, delegado por aquela tela — nota daquela deixa de ser parcial). Chama
> `[[spRatearDadosAbate]]` (54 linhas, lida integralmente nesta sessão). Ver nota de método
> completa (limitação de DDL/tipos de coluna) em `[[ExportaDietas]]`, válida para todo o módulo.

---

**Status da implementação:** Legado — em produção (documentado via engenharia reversa, sem item de trabalho associado)

**Owner (curadoria):** @jefferson.arantes
**Tags:** #Pecuaria #Abate #Frigorifico #Rateio #Comercial

---

## 0) Resumo executivo

- **O que é:** tela de Inclusão/Edição de um registro de `DadosAbates` (dados fiscais/comerciais
  de uma Nota de venda a Frigorífico) com um mecanismo central de **vinculação de Movimentos de
  Venda** (`MovAnimais.Operacao='V'`) e **rateio dos valores da Nota entre os animais/Brincos
  individuais** vendidos.
- **Fluxo de 3 etapas**: (1) preencher o cabeçalho fiscal (Frigorífico/Data/Peso/Valor/Rend.
  Carcaça/encargos); (2) **"Selecionar"** — escolher quais Movimentos de Venda (ainda não
  vinculados a nenhum Dado de Abate, do mesmo Sexo/Frigorífico/Data) pertencem a esta Nota,
  opcionalmente filtrando por Processamento (romaneio de abate); (3) **"Ratear"** — distribuir
  proporcionalmente Peso de Carcaça, Preço, Incentivo Fiscal, Outras Receitas, Impostos e
  Despesas da Nota para cada `MovAnimais` e cada `BrincosIndividuais.Carcaca` vinculado, via
  `[[spRatearDadosAbate]]`.
- **"Desvincular"** reverte a seleção, **zerando** todos os campos calculados do Movimento
  (`PrecoMedio`/`VlrArroba`/médias/pesos) — não apenas removendo o vínculo, mas desfazendo
  qualquer rateio já aplicado.
- **Impacto principal:** `INSERT`/`UPDATE DadosAbates`; `UPDATE MovAnimais.DadosAbate` (vincular/
  desvincular); `UPDATE MovAnimais`/`BrincosIndividuais.Carcaca` (rateio, via
  `[[spRatearDadosAbate]]`).

---

## 1) Conceito

| Termo | Definição |
|-------|-----------|
| "Selecionar" busca candidatos por Sexo/Frigorífico/Data/sem vínculo prévio | `dsEdDadosAbateDataChange`, ramo `Sender=btnSelecionar`: filtra `MovAnimais` de Venda (`Operacao='V'`) do Retiro/Safra, com `Categoria.SexoPec` = Sexo da Nota, `UnidNegMov`(comprador)=Frigorífico da Nota, `DataMov`=Data da Venda da Nota, e **ainda sem** `DadosAbate` — candidatos automaticamente restritos aos que fazem sentido para aquela Nota específica. |
| Filtro adicional por "Processamento" (romaneio de abate finalizado) | `cbProc`/`OpenProcessamentos`: lista Processamentos (`Processamentos.TipoOperacao='S'`, `Finalizado='S'`) do mesmo Frigorífico, permitindo restringir ainda mais a seleção a 1 romaneio de abate específico — sugere que `Processamentos` é o rastreamento de remessas físicas de animais ao frigorífico (não documentado em profundidade nesta sessão). |
| `VlrBase` ('C'=Por Cabeça / '@'=Por Arroba) determina qual campo é a "fonte da verdade" | Conversão bidirecional `VlrUnit ↔ Vlr@` via `PesoCarcaca/15` (mesma constante de conversão Kg→Arroba já vista em `[[EdContVendaGado]]`); comentário no código confirma que a fórmula anterior (baseada em `Total@Kg`/`QtdAnimais`) foi **substituída em definição com "Ricardo"** em 29/11/2010 — raro registro explícito de decisão de negócio datada preservado como comentário morto no código-fonte. |
| Rateio é proporcional a `PercRC` (Rendimento de Carcaça) uniforme da Nota | `[[spRatearDadosAbate]]` aplica o **mesmo** `%RC` da Nota a todos os Movimentos/Brincos vinculados — não há rateio diferenciado por Movimento individual (achado: se os animais tiverem rendimentos de carcaça reais diferentes entre si, o rateio usa uma média/valor único da Nota, não um valor por animal). |
| Sem `RoundTo`/`Round` nas conversões de valor/`%RC` (confirmado, auditoria 2026-09-02) | `PercRC := (PesoCarcaca*100)/PesoVivo` (guardado contra `PesoVivo=0`); `VlrUnit ↔ Vlr@` via `PesoCarcaca/15.00` — nenhuma das 3 fórmulas usa `RoundTo`/`SimpleRoundTo`/`Round`/`Trunc`. Nenhum campo numérico do cabeçalho tem validação de sinal além do `<=0`/vazio já citado nas BRs — cobre negativo uniformemente. |

---

## 2) Dicionário de campos da tela (`.dfm`)

| Controle | Classe | Rótulo/Caption | Vinculado a (campo BD) | Obrigatório | Observações |
|---|---|---|---|---|---|
| `deVenda`/`deVenc` | `TcxDBDateEdit` | — | `DadosAbates.Venda`/`Vencimento` | Sim | — |
| `ceFrig` | `TcxDBCurrencyEdit` | — | `DadosAbates.Frigorifico` | Sim | F2 abre ajuda de Pessoa. |
| `ceQtdAnimais` | `TcxDBCurrencyEdit` | — | `DadosAbates.QtdAnimais` | Sim | — |
| `cbSexo` | `TcxDBComboBox` | — | `DadosAbates.Sexo` | Sim | — |
| `cbVlrBase` | `TcxDBComboBox` | — | `DadosAbates.VlrBase` | — | Por Cabeça/Por Arroba — habilita campo correspondente. |
| `ceVlrUnit`/`ceVlrArroba` | `TcxDBCurrencyEdit` | — | `VlrUnit`/`Vlr@` | — | Conversão bidirecional. |
| `cePesoVivo`/`cePesoCarcaca`/`cePercRC` | `TcxDBCurrencyEdit` | — | `PesoVivo`/`PesoCarcaca`/`PercRC` (calculado) | Sim (Carcaça) | `%RC` calculado ao editar Peso Carcaça. |
| `ceDesconto`, `ceVlrIncFiscal`/`ceAnimaisIncFiscal`, `ceVlrQutRec`/`ceAnimaisOutRec`, `ceVlrImpTaxas`, `ceVLrOutDesp` | `TcxDBCurrencyEdit` | — | encargos/receitas diversos | — | — |
| `ceAusente`/`ceEscasso`/`ceMediano`/`ceUniforme`/`ceExcessivo` | `TcxDBCurrencyEdit` | — | classificação de acabamento/uniformidade (novos campos) | — | Domínio não detalhado em profundidade nesta sessão. |
| `cbAbateAcomp` | `TcxDBCheckBox` | — | `DadosAbates.AbateAcomp` | — | "Abate Acompanhado" (inferência). |
| `ceQtdInteiros`/`ceQtdCastrados` | `TcxDBCurrencyEdit` | — | `DadosAbates.QtdInteiros`/`QtdCastrados` | — | — |
| Grid `gdVendas` | `TcxGridDBBandedTableView` | Proprietário/Lote/U.O./Data Mov/Qtd/Sexo/Preço/Peso Vivo/Peso Carcaça/@ Total/... | `cdsVendas` | — | Coluna "Marcar" só visível durante Selecionar/Desvincular. |
| `btnSelecionar`/`btnDesvincular`/`btnRatear` | `TcxButton` | — | — | — | Ver Conceito. |
| `cbProc` | `TcxLookupComboBox` | — | filtro por Processamento | — | Só ativo durante Selecionar/Desvincular. |
| `btnConfirmar`/`btnCancelar` | `TcxButton` | — | — | — | Confirma/cancela a seleção em andamento. |

---

## 5) Jornada do usuário + Especificação funcional

### SP-01 — Abrir a tela (`FormShow`) → `ConsultaPrincipal`
Carrega o registro (`fmEdDadosAbate.Tag`); modo Inclusão se `Tag<=0`; desabilita ações se
`ReadOnly`.

### SP-02 — Gravar o cabeçalho (`cdsEdDadosAbateBeforePost`)
Valida Venda/Vencimento/Frigorífico/Qtd Animais/Sexo/Peso Carcaça; gera `Sequencial` via
`LoadSequencia`.

### SP-03 — Selecionar Vendas (`btnSelecionarClick`)
Exige cabeçalho salvo; carrega candidatos (ver Conceito); trava o cabeçalho em modo somente-
leitura durante a seleção; grade ganha coluna "Marcar" e menu de contexto.

### SP-04 — Marcar/Desmarcar em massa (menu de contexto → `MarcarDesmarcar`)

### SP-05 — Confirmar seleção (`btnConfirmarClick`)
`UPDATE MovAnimais.DadosAbate` (vincula, `Tag=1`) ou zera todos os campos calculados
(desvincula, `Tag=2`) para os Movimentos marcados; recarrega.

### SP-06 — Desvincular (`btnDesvincularClick`)
Mesmo fluxo de seleção, mas partindo dos já vinculados, para remoção.

### SP-07 — Ratear (`btnRatearClick`) → `[[spRatearDadosAbate]]`
Exige cabeçalho salvo, seleção finalizada, e ao menos 1 Movimento vinculado.

### 5.3 Regras de negócio e validações

- **BR-001 a BR-006 — validações do cabeçalho:** Venda, Vencimento, Frigorífico, Qtd Animais,
  Sexo, Peso Carcaça obrigatórios.
- **BR-002 — Rateio exige seleção finalizada e ao menos 1 Movimento vinculado.**
- **BR-003 — Rateio aplica o mesmo `%RC` da Nota a todos os Movimentos/Brincos** (ver achado).

---

## 6) Integrações e dados

### 6.1 Integrações (internas)

- **`[[DadosAbate]]`** — tela chamadora (consulta/listagem).
- **`[[spRatearDadosAbate]]`** (54 linhas, lida integralmente) — rateio de valores.
- **`Processamentos`** — filtro opcional por romaneio de abate (tabela não detalhada).

### 6.2 Modelo de dados

**Tabela `DadosAbates`** (campos adicionais confirmados, complementando `[[DadosAbate]]`):
`Vencimento`, `VlrBase` (`'C'`/`'@'`), `Ausente`/`Escasso`/`Mediano`/`Uniforme`/`Excessivo`
(classificação de acabamento/uniformidade — % ou quantidade, tipo exato não confirmado),
`AbateAcomp`, `QtdInteiros`, `QtdCastrados`, `Total@Kg` (calculado).

**`MovAnimais`** — campos adicionais confirmados: `DadosAbate` (FK), `FormaPco`, `MediaImpTaxas`,
`MediaDespesas`.

### 6.3 Triggers e Procedures do banco

- **`[[spRatearDadosAbate]]`**.

---

## 7) Suporte: FAQ, mensagens, erros e troubleshooting

### 7.2 Catálogo de mensagens e erros

| Mensagem exata | Causa |
|---|---|
| "Selecione a Data de Venda/Vencimento/o Frigorífico/a Quantidade de Animais/o Sexo/Peso da Carcaça dos Dados de Abate." | Validação do cabeçalho |
| "Salve os Dados do Abate antes de Selecionar/Ratear as Vendas." | Ação sem cabeçalho salvo |
| "Selecione as Vendas a serem Vinculadas/Desvinculadas aos Dados de Abate." | Confirmação sem seleção |
| "Finalize a Seleção dos Movimentos de Vendas antes de Efetuar o Rateio." / "Selecione os Movimentos de Vendas antes de Efetuar o Rateio." | Rateio sem pré-condição |
| "Rateio Finalizado com Sucesso!" / "Erro na Execução do Rateio." | Resultado do rateio |
| "Código do Frigorífico Inválido." | Busca de Pessoa sem correspondência |

---

## 9) Notas de revisão

- **2026-09-02** (auditoria campo-a-campo — módulo Pecuária)
  - **O que mudou:** confirmado explicitamente que não há `RoundTo`/`Round` em nenhuma das
    fórmulas de conversão (`PercRC`, `VlrUnit`↔`Vlr@`); confirmado guard contra divisão por zero
    em `PercRC` (`PesoVivo<>0`).
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/EdDadosAbate.pas`.

- **2026-08-28** (criação da nota — módulo Pecuária)
  - **O que mudou:** nota criada do zero, a partir de leitura 100% literal de
    `Pecuaria/EdDadosAbate.pas` (850 linhas) + `.dfm` (título confirmado "Edição dos Dados de
    Abate") + `[[spRatearDadosAbate]]` (54 linhas, lida integralmente). Completa
    `[[DadosAbate]]`. Documentado o fluxo Selecionar→Ratear e o mecanismo de Desvincular (zera
    campos calculados). Achado: rateio usa `%RC` único da Nota para todos os animais.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/EdDadosAbate.pas` + `.dfm`; ver `[[DadosAbate]]`,
    `[[EdContVendaGado]]` (conversão Kg→Arroba). Pendente: tabela `Processamentos`.
