> **Nota de método**: este documento descreve uma tela de um sistema LEGADO já em produção,
> reconstruída por engenharia reversa do código-fonte — não é uma especificação de feature nova
> obtida por entrevista com um PO. Por isso, toda seção que normalmente viria de uma conversa de
> negócio (motivação, métricas, objetivos) foi preenchida por **inferência a partir do
> comportamento do código**, e está marcada explicitamente como `(inferência)`. Onde nem o código
> nem o contexto do módulo permitem inferir nada com segurança, o campo está como `N/A`.
> Fonte: leitura 100% literal de `Pecuaria/EntradaAnimais.pas` (1740 linhas, unit
> `EntradaAnimais`, classe `TfmEntradaAnimais`) e do `.dfm` correspondente (título confirmado
> "Entrada de Animais"), nesta sessão — 92º arquivo `.pas` lido do módulo Pecuária. Já
> referenciada como pendência por `[[MonitoramentoBaiasLotes]]` (`miEntradasClick`). Chama
> `[[GravaBrinco]]` (117 linhas) e `[[GravaPesagens]]` (61 linhas, já lida em
> `[[SaidaAnimais]]`), ambas lidas integralmente, além de `[[RegistroAutAnimais]]` e `[[MovGTAs]]`
> (lidas e documentadas integralmente em sessão posterior — mesmos satélites já vistos em
> `[[SaidaAnimais]]`). Ver nota de método
> completa (limitação de DDL/tipos de coluna) em `[[ExportaDietas]]`, válida para todo o módulo.

---

**Status da implementação:** Legado — em produção (documentado via engenharia reversa, sem item de trabalho associado)

**Owner (curadoria):** @jefferson.arantes
**Tags:** #Pecuaria #Entrada #Compra #Brinco #Pesagem

---

## 0) Resumo executivo

- **O que é:** CRUD mestre-detalhe de **Entrada (Compra/Nascimento) de Animais** — mestre
  `MovAnimais` (`Operacao IN ('C','N')`, `TipoMov='E'`), detalhe **em memória** (`cdsBrincos`,
  como em `[[SaidaAnimais]]`), gravado explicitamente via `[[GravaBrinco]]` (que **também cria**
  o registro em `BrincosIndividuais`, diferente da Saída que só reaproveita brincos existentes) +
  `[[GravaPesagens]]`.
- **É o ponto de origem do cadastro de `BrincosIndividuais`** — ao contrário de
  `[[SaidaAnimais]]` (que só vincula Brincos já cadastrados), aqui o usuário digita todos os dados
  do animal novo (Brinco, SisBov opcional, Brinco Eletrônico opcional, Raça, Espécie, Nascimento)
  e a linha é inserida do zero via `[[GravaBrinco]]` `@Tipo='I'`.
- **3 identificadores opcionais e não-exclusivos por Brinco**: Brinco (manejo, sempre), SisBov
  (auto-preenche o Brinco a partir dos 6 últimos dígitos do SisBov, `Copy(SisBov,9,6)`), Brinco
  Eletrônico — diferente de `[[SaidaAnimais]]` (onde são modos de **busca** mutuamente
  exclusivos), aqui são **campos de cadastro** preenchidos livremente.
- **Validações de consistência não-bloqueantes, acumuladas em 1 única mensagem final** — Raça/
  Categoria/Castrado/Sexo divergentes do SubGrupo, Peso fora da faixa por Sexo, Peso Médio/Qtd que
  serão recalculados, Faixa Etária incompatível com Data de Nascimento — todas acumulam texto em
  `sMSG` e são exibidas juntas em `cdsBrincosAfterPost`, em vez de bloquear/confirmar uma a uma
  (mudança de padrão em relação a `[[SaidaAnimais]]`, que confirma cada divergência individualmente).
- **Impacto principal:** `INSERT`/`UPDATE`/`DELETE MovAnimais`; `INSERT`/`UPDATE`/`DELETE
  BrincosIndividuais`/`BrincosMov` (via `[[GravaBrinco]]`); `INSERT`/`UPDATE`/`DELETE
  BrincosPesagens` (via `[[GravaPesagens]]`); recalcula Saldo do SubGrupo.

---

## 1) Conceito

| Termo | Definição |
|-------|-----------|
| SubGrupo só pode ser trocado na edição se ainda não teve outros movimentos | `cdsCadastroBeforeEdit`: `Options.Editing := QtdMov <= 1` (a query de consulta já traz `QtdMov` = soma de MovAnimais+RegMortesPec+HospitalizacoesPec do SG) — evita reatribuir um SubGrupo que já tem histórico. |
| Movimento/Brinco gerado por Processamento é somente-leitura aqui | Mesma trava recorrente do módulo (`Processamento>0`), replicada em Insert/Edit/Delete do mestre e do detalhe. |
| SisBov auto-preenche o Brinco (não o contrário) | `gdBrincosDBTableView1SisBovPropertiesEditValueChanged`: `Brinco := Copy(SisBov, 9, 6)` — os 6 dígitos finais do SisBov (15 dígitos) são convencionalmente o próprio número do Brinco manejo. |
| Validação de Peso por faixa Sexo é feita 2x (Insert e Post) redundantemente | Mesmo cálculo repetido em `cdsBrincosBeforePost`, ambos usando `ParamRetiro.PesoMin/MaxM/F`. |
| "Forma de Preço" tem 3 modos (Unitário/Arroba/Moeda) com campos habilitados dinamicamente | `cbFormaPropertiesEditValueChanged` alterna `cbMoeda`/`ceVlrArroba`/`cePrecoMedio` — Moeda usa `ConverteMoeda` para calcular o Valor da Arroba na moeda corrente convertida. |

---

## 2) Dicionário de campos da tela (`.dfm`)

| Controle | Classe | Rótulo/Caption | Vinculado a (campo BD) | Obrigatório | Observações |
|---|---|---|---|---|---|
| `lcbFazRetiro` | `TcxLookupComboBox` | — | filtro | Sim | — |
| `deInicio`/`deFinal`/`cbLotesBaias`/`cbLoteFim`/`ceSGIni`/`ceSGFim`/`ceFornecedor`/`lcbFazenda`/`lcbRetiros`/`cbTipoPreco`/`cbFormaTransp`/`ceProc`/`ceBrinco`/`ceBrincoAux`/`ceProp`/`cbRaca`/`cbCategoria` | vários | — | filtros | — | — |
| Grid `gdCadastro` (mestre) | `TcxGridDBBandedTableView` | SubGrupo/Data/Fazenda/Retiro/Qtd/Peso/Preço/CCVG/Fornecedor | `cdsCadastro` | — | SubGrupo/Data não-editáveis se `Processamento>0`. |
| `cbTipoPrec`/`cbFormaTransporte`/`ceDistanciaTransp`/`cbForma`/`cbMoeda`/`ceVlrArroba`/`cePrecoMedio` | vários | — | mestre (detalhe de preço) | Sim (Tipo Preço/Transporte) | — |
| Grid `gdBrincos` (detalhe) | `TcxGridDBTableView` | Brinco Eletrônico/Brinco/BrincoAux/SisBov/Espécie/Raça/Categoria/Idade/Castrado/Sexo/Peso/Carcaça/Altura | `cdsBrincos` | Brinco/Espécie/Raça/Categoria/Peso/Idade | Em memória, gravado via `[[GravaBrinco]]`. |
| `deNascimento`/`lkIdade`/`deIncSisBov`/`cbCarcaca`/`ceAltura` | vários | — | detalhe | — | `lkIdade` valida Faixa Etária × Nascimento. |
| `dnNavega` | `TcxDBNavigator` | — | — | — | F3/F4/F5/F6/F7; botão 6 = Registro Automatizado. |
| `btnMovGTAs` | `TcxButton` | GTA's Mov. | — | — | — |
| `btnExportar` | `TcxButton` | — | — | — | — |
| `mmQuery` | `TcxMemo` | — | — | Oculto por padrão | F9. |

---

## 5) Jornada do usuário + Especificação funcional

### SP-01 — Abrir/Consultar (`FormShow`→`btnConsultaClick`)
Filtros combinados; consulta base em `MovAnimais` com `Operacao IN ('C','N')`/`TipoMov='E'`,
incluindo `QtdMov` calculado (uso em BR abaixo).

### SP-02 — Incluir/Editar movimento mestre (`cdsCadastroBefore/AfterInsert/Edit`)
Valida Fazenda/Retiro selecionado; defaults na inserção (`FormaPco='U'`, `DataMov=hoje`).

### SP-03 — Gravar movimento mestre (`cdsCadastroBeforePost`)
Valida SubGrupo/Data/Fornecedor/Fazenda/Tipo Preço/Forma Transporte; na inserção, gera
`Sequencial`, força `Operacao='C'`/`TipoMov='E'`.

### SP-04 — Incluir/Editar Brinco no detalhe (`cdsBrincosBefore/AfterInsert/Edit`)
Pré-preenche Raça/Categoria/Castrado/Sexo a partir do SubGrupo (`SubGruposLotes`); bloqueia se
mestre em edição ou movimento de Processamento.

### SP-05 — Gravar Brinco (`cdsBrincosBeforePost`→`AfterPost`) → `[[GravaBrinco]]` + `[[GravaPesagens]]`
Valida Brinco/Espécie/Raça/Categoria/Peso/Idade; acumula avisos não-bloqueantes de divergência
(ver Resumo Executivo) em `sMSG`, exibidos após o `Post`.

### SP-06 — Excluir Brinco (`cdsBrincosBeforeDelete`) → `[[GravaPesagens]]`(D) + `[[GravaBrinco]]`(D ou D+I)
Bloqueia se o Brinco já tem movimento de saída (`QtdMov>=2` e `Ativo<>'S'`); se puder excluir,
recria o Brinco reprocessando D seguido de I (código com padrão pouco usual de "excluir e
reinserir" em vez de simplesmente `DELETE`).

### SP-07 — Vincular GTA (`btnMovGTAsClick`) → `[[MovGTAs]]`

### SP-08 — Registro Automatizado (`dnNavegaButtonsButtonClick`, botão 6) → `RegistroAutAnimais.pas`

### 5.3 Regras de negócio e validações

- **BR-001 — SubGrupo do mestre só editável se ainda não teve outros movimentos.**
- **BR-002 — Movimento/Brinco gerado por Processamento não pode ser alterado/excluído aqui.**
- **BR-003 — SubGrupo/Data/Fornecedor/Fazenda/Tipo de Preço/Forma de Transporte obrigatórios no mestre.**
- **BR-004 — Brinco/Espécie/Raça/Categoria/Peso/Idade obrigatórios no detalhe.**
- **BR-005 — Divergências (Raça/Categoria/Castrado/Sexo vs. SubGrupo; Peso fora da faixa; Peso
  Médio/Qtd recalculados; Faixa Etária vs. Nascimento) são avisos acumulados, não bloqueios.**

---

## 6) Integrações e dados

### 6.1 Integrações (internas)

- **`[[GravaBrinco]]`** (117 linhas, lida integralmente).
- **`[[GravaPesagens]]`** (61 linhas, já lida em `[[SaidaAnimais]]`).
- **[[RegistroAutAnimais]]**, **[[MovGTAs]]** (lidas e documentadas integralmente).
- **`[[MonitoramentoBaiasLotes]]`** — chamadora já confirmada (`miEntradasClick`).

### 6.2 Modelo de dados

**Tabela `MovAnimais`** (campos adicionais confirmados aqui): `Moeda`, `VlrArroba`, `FormaPco`
('U'/'@'/'M'), `Observacao`.

**Tabelas `BrincosIndividuais`/`BrincosMov`** — escrita confirmada via `[[GravaBrinco]]`, não por
`INSERT` direto do `.pas` (mesmo padrão de `[[SaidaAnimais]]`).

### 6.3 Triggers e Procedures do banco

- **`[[GravaBrinco]]`**, **`[[GravaPesagens]]`**.
- **`[[TI_MovAnimais]]`**/**`[[TU_MovAnimais]]`**/**`[[TIU_MovAnimais]]`**/**`[[TD_MovAnimais]]`**
  (achado, auditoria 2026-09-02) — disparadas pelo `INSERT`/`UPDATE`/`DELETE MovAnimais` do
  mestre desta unit; já confirmavam esta tela como chamadora (a partir das notas das triggers),
  mas não estavam cruzadas aqui.

---

## 7) Suporte: FAQ, mensagens, erros e troubleshooting

### 7.2 Catálogo de mensagens e erros

| Mensagem exata | Causa |
|---|---|
| "Selecione a Fazenda/Retiro do Movimento." | Inserção sem Fazenda/Retiro |
| "Selecione o Lote/SG para o Movimento." / "Indique a Data./o Fornecedor./a Fazenda./o Tipo de Pre�o./a Forma de Transporte." | BR-003 |
| "O Movimento foi gerado atrav�s de um processamento e n�o pode ser exclu�do." / "...adicionado Brincos." / "O Brinco do Movimento foi gerado atrav�s de um processamento e n�o pode ser alterado/exclu�do." | BR-002 |
| "Indique o Brinco./a Esp�cie./a Ra�a./a Categoria./o Peso./a Idade." | BR-004 |
| "Verique os Seguintes Itens: ..." | BR-005 (mensagem consolidada) |
| "Brinco com registro de sa�da, Verifique." | Exclusão bloqueada |
| "O Campo SisBov aceita no m�ximo 15 Caracteres, Verifique." | Validação de tamanho |
| "N�o � Permitida a Inser��o de Caracteres Especiais!" | Validação de `BrincoAux` |
| "Faixa Et�ria escolhida n�o condiz com a Data de Nascimento." | Aviso de idade |

---

## 9) Notas de revisão

- **2026-09-08** (auditoria campo-a-campo — módulo Pecuária)
  - **O que mudou:** identificadas as 4 triggers de `MovAnimais` como disparadas por esta unit —
    não estavam cruzadas aqui.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** ver `[[TI_MovAnimais]]`, `[[TU_MovAnimais]]`, `[[TIU_MovAnimais]]`,
    `[[TD_MovAnimais]]`.

- **2026-08-28** (criação da nota — módulo Pecuária)
  - **O que mudou:** nota criada do zero, a partir de leitura 100% literal de
    `Pecuaria/EntradaAnimais.pas` (1740 linhas) + `.dfm` (título confirmado "Entrada de Animais")
    + `[[GravaBrinco]]` (lida integralmente). Documentado que esta tela é o ponto de origem do
    cadastro de `BrincosIndividuais`, a diferença de padrão de identificadores (campos de
    cadastro, não modos de busca exclusivos como em `[[SaidaAnimais]]`), e o padrão de
    validações acumuladas não-bloqueantes.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/EntradaAnimais.pas` + `.dfm`; ver `[[GravaBrinco]]`,
    `[[GravaPesagens]]`, `[[SaidaAnimais]]`, `[[MonitoramentoBaiasLotes]]`, `[[RegistroAutAnimais]]`,
    `[[MovGTAs]]`.
