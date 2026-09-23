> **Nota de método**: este documento descreve uma tela de um sistema LEGADO já em produção,
> reconstruída por engenharia reversa do código-fonte — não é uma especificação de feature nova
> obtida por entrevista com um PO. Por isso, toda seção que normalmente viria de uma conversa de
> negócio (motivação, métricas, objetivos) foi preenchida por **inferência a partir do
> comportamento do código**, e está marcada explicitamente como `(inferência)`. Onde nem o código
> nem o contexto do módulo permitem inferir nada com segurança, o campo está como `N/A`.
> Fonte: leitura 100% literal de `Pecuaria/EdContCompraGado.pas` (710 linhas, unit
> `EdContCompraGado`, classe `TfmEdContCompraGado`) e do `.dfm` correspondente (título confirmado
> "Edição do Contrato de Compra de Gado" — mesmo padrão de título de `[[EdContVendaGado]]`),
> nesta sessão — 69º arquivo `.pas` lido do módulo Pecuária. **Tela irmã quase idêntica,
> componente-a-componente, de `[[EdContVendaGado]]`** — completa `[[ContCompraGado]]` (nota
> daquela deixa de ser parcial). Ver aquela nota para o detalhamento completo da rede de cálculo
> circular do detalhe (`VlrCabeca`/`Vlr@`/`VlrTotal`/`Total@`/`PesoMedio@`) e do achado de risco
> de FK compartilhada de `ItContratosPec` — idênticos aqui. Ver nota de método completa
> (limitação de DDL/tipos de coluna) em `[[ExportaDietas]]`, válida para todo o módulo.

---

**Status da implementação:** Legado — em produção (documentado via engenharia reversa, sem item de trabalho associado)

**Owner (curadoria):** @jefferson.arantes
**Tags:** #Pecuaria #Contrato #Compra #Comercial #CRUD

---

## 0) Resumo executivo

- **O que é:** tela de Inclusão/Edição/Visualização de um Contrato de Compra de Gado — espelho
  de `[[EdContVendaGado]]`, com `GrupoComercial=7` e os papéis de `Pessoa`/`Produtor` **invertidos**
  em relação à Venda (consistente com o achado já documentado em `[[ContCompraGado]]`).
- Todo o restante (estrutura mestre-detalhe, rede de cálculo circular, travas de detalhe
  bloqueado sem mestre salvo, validações) é **idêntico** a `[[EdContVendaGado]]`.

---

## 1) Conceito — diferenças em relação a `[[EdContVendaGado]]`

| Termo | Definição |
|-------|-----------|
| **Papéis de Pessoa/Produtor invertidos** | `ceCodPessoaOrigem` (rótulo "Pessoa Origem") edita/exibe `Contratos.Produtor` (o Fornecedor/vendedor de quem se compra); `ceCodPessoaDest` (rótulo "Pessoa Destino") edita/exibe `Contratos.Pessoa` (a Empresa compradora) — exatamente o inverso de `[[EdContVendaGado]]`, onde `ceCodPessoaOrigem`→`Pessoa` e `ceCodPessoaDest`→`Produtor`. Confirma, no nível do CRUD, o achado já registrado na tela de consulta `[[ContCompraGado]]`: o significado de `Contratos.Pessoa`/`Produtor` é contextual ao `GrupoComercial`, não fixo — aqui fica evidente que **os mesmos rótulos de tela** ("Pessoa Origem"/"Pessoa Destino") mapeiam para colunas diferentes conforme Compra vs. Venda, com o código-fonte das 2 units sendo cópias quase idênticas com essa única troca. |
| `GrupoComercial=7` fixo no Insert (vs. `8` em Venda) | — |
| `Tabelas.Tipo=22` filtrado por `GrupoComercial=7` (vs. `8`) | Mesmo domínio de Tipos de Negociação, subconjunto de Compra. |
| Mensagem de erro do Consultor mantém "Código do Comprador Inválido." (idêntica à de Venda) | Achado de pequena inconsistência textual: em Compra, o "Consultor" do contrato deveria semanticamente ser o "Vendedor"/Fornecedor que negocia, mas a mensagem de erro copiada de `[[EdContVendaGado]]` não foi ajustada — permanece "Comprador" em ambas as units (diferente da tela de consulta `[[ContCompraGado]]`, que ajusta essa mensagem para "Vendedor" — achado de inconsistência entre a tela de consulta e a de edição). |

---

## 2) Dicionário de campos da tela (`.dfm`)

Estruturalmente idêntico a `[[EdContVendaGado]]` (mesmos componentes, mesmos nomes internos),
com `ceCodPessoaOrigem`→`Contratos.Produtor` e `ceCodPessoaDest`→`Contratos.Pessoa` (invertido —
ver Conceito). Dicionário completo (releitura desta sessão, coluna a coluna):

### 2.1 Cabeçalho do Contrato (`cdsEdContratosPec`)

| Controle | Classe | Rótulo/Caption | Vinculado a (campo BD) | Obrigatório | Observações |
|---|---|---|---|---|---|
| `lblSequencial` | `TcxDBLabel` | (grupo "Sequencial") | `Sequencial` | — | Somente leitura (label, não é edit); PK gerada por `LoadSequencia('Contratos','Sequencial')` no `BeforePost` de inserção. |
| `ceNumero` | `TcxDBCurrencyEdit` | (grupo "Número") | `Numero` | **Sim** | Validado em `cdsEdContratosPecBeforePost`: `<=0` → "Indique um Número para o Contrato." `DecimalPlaces=0`. |
| `deData` | `TcxDBDateEdit` | (grupo "Data") | `Data` | **Sim** | Validado em `BeforePost`: nulo → "Indique a Data do Contrato."; default = `Date` em `AfterInsert`. |
| `cbNegociacao` | `TcxDBLookupComboBox` | (grupo "Tipo de Negociação") | `Negociacao` | **Sim** | Lista `Tabelas.Tipo=22 AND GrupoComercial=7`; `<=0` → "Indique um Tipo de Negociação." |
| `ceCodPessoaOrigem` (grupo "Origem"→"Pessoa") | `TcxDBCurrencyEdit` | — | **`Produtor`** (invertido vs. Venda) | **Sim** | Busca F2 (`dbDispAjudaPessoa(..., 'F1', 'P')`); `<=0` → "Indique a Pessoa de Origem." |
| `lblPessoaOrigem` | `TcxLabel` | — | somente exibição (nome buscado) | — | Vazio (`''`) quando `Produtor<=0`; **diferente de `[[ContVendaGado]]`** (que usa "..:: TODOS ::.." como placeholder — aqui não há opção "Todos" pois é tela de edição de 1 registro). |
| `lkFazOrigem` (grupo "Origem"→"Fazenda") | `TcxDBLookupComboBox` | — | `LocalRetirada` | **Sim** | Lista `DetPessoas` filtrada pelo `Produtor` atual; `<=0` → "Indique a Fazenda de Origem." |
| `ceCodPessoaDest` (grupo "Destino"→"Pessoa") | `TcxDBCurrencyEdit` | — | **`Pessoa`** (invertido vs. Venda) | **Sim** | Busca F2 (`dbDispAjudaPessoa(..., 'P3', 'P')`); `<=0` → "Indique a Pessoa de Destino." Em caso de código inválido, além do aviso, executa `ceCodPessoaDest.SelectAll` (não visto no equivalente de Origem). |
| `lblPessoaDest` | `TcxLabel` | — | somente exibição (nome buscado) | — | Mesma mecânica de `lblPessoaOrigem`. |
| `lkFazDest` (grupo "Destino"→"Fazenda") | `TcxDBLookupComboBox` | — | `LocalEntrega` | **Sim** | Lista `DetPessoas` filtrada pela `Pessoa` atual; `<=0` → "Indique a Fazenda de Destino." |
| `ceCodConsultor` (grupo **"Comprador"**) | `TcxDBCurrencyEdit` | — | `Consultor` | Não (sem validação em `BeforePost`) | Busca F2 (`'C3'`); mensagem de erro "Código do Comprador Inválido." (ver achado de nomenclatura no Conceito) + `SelectAll` em caso de inválido — **bug de indentação no Pascal original** (`SelectAll` está fora do `else`, então executa sempre após qualquer digitação, não só quando inválido; comportamento inofensivo pois só reposiciona a seleção do próprio edit). |
| `lblConsultor` | `TcxLabel` | — | somente exibição (nome buscado) | — | Mesma mecânica. |
| `mmObs` (grupo "Observações") | `TcxDBMemo` | — | `Observacao1` | Não | Controla `gbOBS.Tag` (1 dentro/0 fora) para `TrataTeclaForm` não interceptar teclas de navegação enquanto o usuário digita observações. |
| `dnNavega` | `TcxDBNavigator` | — | — | — | Apenas Editar/Salvar/Cancelar visíveis (`Insert`/`Delete`/demais com `Visible=False`) — **inclusão de novo Contrato só ocorre implicitamente**: `FormShow` chama `cdsEdContratosPec.Insert` automaticamente quando `iSeq=0`, não há botão "Inserir" nesta tela (diferente da tela de listagem `[[ContCompraGado]]`, que decide Novo vs. Editar antes de abrir esta tela). |

Nenhum controle do cabeçalho está oculto (`Visible=False`) ou desabilitado (`Enabled=False`) por
padrão nesta releitura — o único bloqueio dinâmico é `cdsEdContratosPec.ReadOnly`/
`cdsItContratosPec.ReadOnly`, setado em `FormShow` conforme permissão do usuário
(`TemPermissao`) e forçado a `True` quando `Tag=1` (modo Visualização, aberto por duplo-clique em
`[[ContCompraGado]]`).

### 2.2 Grade "Animais Negociados" (`cdsItContratosPec` = `ItContratosPec`)

`TcxGridDBBandedTableView` com 3 bandas: sem título / "Peso" / "Valor". Bloqueada para
Inserir/Editar/Excluir enquanto o Contrato (mestre) está em `dsInsert`/`dsEdit` (mensagens
"Salve o Contrato para Inserir/Editar/Excluir os Animais..."). Colunas na ordem das bandas:

| Coluna | Banda | Caption | Campo | Obrigatório | Formatação | `OnEditValueChanged` |
|---|---|---|---|---|---|---|
| `gdITContratosPecTabelaAvaliacao` | 0 (sem título) | "Tipo de Avaliação" | `Avaliacao` | **Sim** (`<=0` → "Indique a Avaliação.") | `TcxLookupComboBoxProperties`, lista `dmPecuaria.cdsAvaliacoes` (`Tabelas.Tipo=207`) | — (só validado no `BeforePost`) |
| `gdITContratosPecTabelaCategoria` | 0 (sem título) | (sem caption próprio) | `Categoria` | **Sim** (`<=0` → "Indique a Categoria.") | `TcxLookupComboBoxProperties`, lista `dmPecuaria.cdsCategorias` (`Tabelas.Tipo=172`) | — |
| `gdITContratosPecTabelaQuantidade` | 0 (sem título) | "Qtd." | `Quantidade` | **Sim** (`<=0` → "Indique a Quantidade.") | `TcxCurrencyEditProperties`, `DecimalPlaces=0` | `QuantidadePropertiesEditValueChanged` → recalcula `Total@`/`PesoMedio@` e depois `VlrCabeca`/`Vlr@`/`VlrTotal` (dispara toda a cadeia). |
| `gdITContratosPecTabelaRenCarcaca` | 0 (sem título) | "R.C. (%)" | `RenCarcaca` | **Sim** (`<=0` → "Indique o Rendimento de Carcaça.") | `,0.00` (2 casas) | `PesoTotalPropertiesEditValueChanged` → recalcula `Total@`. |
| `gdITContratosPecTabelaDescontoKG` | 1 "Peso" | "Desc. (%)" | `DescontoKG` | Não (sem validação `<=0`; pode ficar `0`) | `,0.00` | `PesoTotalPropertiesEditValueChanged` → recalcula `Total@`. |
| `gdITContratosPecTabelaPesoTotal` | 1 "Peso" | "Total" | `PesoTotal` | **Sim** (`<=0` → "Indique o Peso Total.") | `,0.00` | `PesoTotalPropertiesEditValueChanged` (handler próprio, também aciona o de `Total@`). |
| `gdITContratosPecTabelaTotal` | 1 "Peso" | "Total @" | `Total@` | Não (sem validação própria; alimentado pela fórmula, mas também editável manualmente) | `,0.00` | `TotalPropertiesEditValueChanged` → recalcula `PesoMedio@` e a cadeia de `VlrCabeca`. |
| `gdITContratosPecTabelaPesoMedio` | 1 "Peso" | "Médio @" | `PesoMedio@` | Não | `,0.00` | **Nenhum** — coluna sem `Properties.OnEditValueChanged` no `.dfm`; é preenchida programaticamente por `TotalPropertiesEditValueChanged` (`PesoMedio@ := Total@ / Quantidade`), mas se o usuário digitar um valor manualmente nela, nada recalcula em cadeia a partir dela (fica "solta" até a próxima alteração de `Total@`/`Quantidade` sobrescrevê-la). |
| `gdITContratosPecTabelaVlrCabeca` | 2 "Valor" | "Por Cab." | `VlrCabeca` | Não (sem validação `<=0` no `BeforePost`) | `,0.00` | `VlrCabecaPropertiesEditValueChanged` → recalcula `Vlr@` (se `PesoMedio@>0`, senão `Vlr@:=0`) e `VlrTotal := Quantidade * VlrCabeca`. |
| `gdITContratosPecTabelaVlr` | 2 "Valor" | "Por @" | `Vlr@` | Não | `,0.00` | `VlrPropertiesEditValueChanged` → recalcula `VlrCabeca := Vlr@ * PesoMedio@` e `VlrTotal := Quantidade * VlrCabeca`. |
| `gdITContratosPecTabelaVlrTotal` | 2 "Valor" | "Total" | `VlrTotal` | Não | `,0.00` | `VlrTotalPropertiesEditValueChanged` → recalcula `VlrCabeca := VlrTotal / Quantidade` e `Vlr@ := VlrCabeca / PesoMedio@`. |

**Achado confirmado nesta releitura — handler órfão `ppCalculoPopup`:** a unit declara
`procedure TfmEdContCompraGado.ppCalculoPopup(Sender: TObject)` (aborta o popup se
`gdITContratosPecTabelaVlrCabeca` não estiver focado), mas **não existe nenhum `TPopupMenu` no
`.dfm`** desta tela (nem `OnPopup` associado a nenhum componente) — é código morto, provavelmente
resquício de uma versão anterior com menu de contexto de cálculo, removido do `.dfm` sem remover o
handler do `.pas`. Mesma situação em `[[EdContVendaGado]]` (confirmado por comparação).

**Arredondamento e sinal — confirmação explícita (releitura completa dos 6 handlers de cálculo,
`gdITContratosPecTabelaVlrCabeca/PesoTotal/Quantidade/VlrTotal/Vlr` +
`PropertiesEditValueChanged`):**
- **Nenhuma** das 6 fórmulas (`Vlr@`, `VlrTotal`, `Total@`, `PesoMedio@`, `VlrCabeca` recalculado a
  partir de `VlrTotal`, `VlrCabeca` recalculado a partir de `Vlr@`) usa `RoundTo`, `SimpleRoundTo`,
  `Round`, `Trunc` ou `FormatFloat` no código Pascal — os campos são `TFMTBCDField` (BCD/decimal) e
  a única "formatação" aplicada é visual, via `Properties.DisplayFormat`/`EditFormat = ',0.00'`
  nas colunas do grid (2 casas decimais na exibição/edição, sem arredondamento programático
  explícito do valor armazenado — o valor gravado no BCD mantém a precisão total do cálculo em
  ponto flutuante `Double`, convertida para BCD apenas na gravação via `AsFloat`).
- **Nenhum campo de entrada desta grade tem trava de valor negativo** (`Properties.MinValue` não
  está setado em nenhuma das colunas do `.dfm`, e nenhum `BeforePost`/`OnEditValueChanged` rejeita
  valores `<0`) — as únicas validações são "obrigatório e diferente de zero/negativo-ou-zero"
  (`<=0`) para `Avaliacao`, `Categoria`, `Quantidade`, `RenCarcaca`, `PesoTotal`; **`VlrCabeca`,
  `Vlr@`, `VlrTotal`, `Total@`, `PesoMedio@`, `DescontoKG` não têm nenhuma validação de sinal ou de
  obrigatoriedade** — tecnicamente aceitam zero ou negativo sem aviso (ex.: um `DescontoKG`
  negativo digitado a mão infla `Total@` em vez de reduzir, já que a fórmula é
  `PesoTotal * (1 - DescontoKG/100) * (RenCarcaca/100) / 15`).
- Divisão por `Quantidade` (em `Total@→PesoMedio@`, `VlrTotal→VlrCabeca`) e por `PesoMedio@` (em
  `VlrCabeca→Vlr@`, `Vlr@→VlrCabeca`) não tem proteção contra divisão por zero além do guard
  explícito em `VlrCabecaPropertiesEditValueChanged` (`if PesoMedio@ > 0.00 then ... else
  Vlr@:=0.00`); as demais divisões (`/Quantidade`) confiam na validação `<=0` de `Quantidade` no
  `BeforePost` para nunca chegarem a zero em produção, mas **nada impede uma divisão por zero em
  tempo real durante a digitação** (antes do `Post`) se o usuário limpar `Quantidade` e digitar em
  outro campo da cadeia — mesmo padrão de risco já documentado em `[[EdContVendaGado]]`.

---

## 5) Jornada do usuário + Especificação funcional

Idêntica a `[[EdContVendaGado]]` (SP-01 a SP-05), com `GrupoComercial=7` e os campos de Pessoa
invertidos nas validações (`cdsEdContratosPecBeforePost`): "Indique a Pessoa de Origem" valida
`Produtor`; "Indique a Pessoa de Destino" valida `Pessoa`.

### 5.3 Regras de negócio e validações

Idênticas a `[[EdContVendaGado]]`.

---

## 6) Integrações e dados

### 6.1 Integrações (internas)

- **`[[ContCompraGado]]`** — tela chamadora (consulta/listagem).

### 6.2 Modelo de dados

Mesma estrutura de `Contratos` (`GrupoComercial=7`) e `ItContratosPec` já documentada em
`[[EdContVendaGado]]`.

### 6.3 Triggers e Procedures do banco

**`[[TIU_ItContratosPec]]`**/**`[[TD_ItContratosPec]]`** — mantêm `Contratos.ValorTotal`/
`TotalQtd` como agregados automáticos (mesma origem de `[[EdContVendaGado]]`, agora confirmada).
**`[[ti_Contratos]]`**/**`[[TD_Contratos]]`** — genéricas sobre `Contratos`, disparadas por esta
unit; **achado**: para `GrupoComercial=7` (Compra), o bloqueio de exclusão por
`ClassFinComercial`/`MovFinComercial` vinculado é **explicitamente pulado por design** (comentário
no código-fonte da trigger: "GRUPOCOMERCIAL 7 é o Grupo do Pecuária") — diferente de Venda/Boitel
(`8`/`9`), onde o bloqueio se aplica.

---

## 7) Suporte: FAQ, mensagens, erros e troubleshooting

### 7.2 Catálogo de mensagens e erros

Idêntico a `[[EdContVendaGado]]`, com "Código do Comprador Inválido." mantido também para o
Consultor de Compra (achado de inconsistência textual, ver Conceito).

---

## 9) Notas de revisão

- **2026-09-02** (auditoria de profundidade campo-a-campo — dicionário de campos)
  - **O que mudou:** seção "2) Dicionário de campos" reescrita por completo — antes apenas
    remetia a `[[EdContVendaGado]]` ("idêntico a"), agora lista os 11 controles do cabeçalho e as
    10 colunas da grade "Animais Negociados" individualmente, com validações e handlers de
    `OnEditValueChanged` explícitos. **Achados**: (1) handler órfão `ppCalculoPopup` — declarado no
    `.pas` mas sem `TPopupMenu` correspondente no `.dfm` (código morto, mesma situação em
    `[[EdContVendaGado]]`); (2) coluna `PesoMedio@` não tem `OnEditValueChanged` — se editada
    manualmente não dispara recálculo em cadeia; (3) confirmado explicitamente, releitura dos 6
    handlers de cálculo: nenhum usa `RoundTo`/`SimpleRoundTo`/`Round`/`Trunc`/`FormatFloat`
    (arredondamento só visual via `DisplayFormat=',0.00'`); (4) confirmado que `VlrCabeca`,
    `Vlr@`, `VlrTotal`, `Total@`, `PesoMedio@` e `DescontoKG` não têm nenhuma trava de valor
    negativo nem exigência de obrigatoriedade (só `Avaliacao`/`Categoria`/`Quantidade`/
    `RenCarcaca`/`PesoTotal` são validados `<=0` no `BeforePost`); (5) confirmado risco de divisão
    por zero em tempo real (antes do `Post`) se `Quantidade` for zerada durante a digitação —
    mesmo padrão já registrado em `[[EdContVendaGado]]`, apenas não estava explícito nesta nota.
    Não foi necessário reabrir a investigação de triggers `Contratos`/`ItContratosPec` (já
    documentada e correta).
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** releitura de `Pecuaria/EdContCompraGado.pas` (710 linhas) e `.dfm` (1365+
    linhas) nesta sessão.

- **2026-09-01** (auditoria de profundidade — módulo Pecuária)
  - **O que mudou:** identificadas as triggers `[[TIU_ItContratosPec]]`/`[[TD_ItContratosPec]]`
    como origem de `Contratos.ValorTotal`/`TotalQtd` — gap real de trigger não encontrada na
    varredura estrutural original.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** ver `[[TIU_ItContratosPec]]`, `[[TD_ItContratosPec]]`.

- **2026-08-28** (criação da nota — módulo Pecuária)
  - **O que mudou:** nota criada do zero, a partir de leitura 100% literal de
    `Pecuaria/EdContCompraGado.pas` (710 linhas) + `.dfm` (título confirmado "Edição do Contrato
    de Compra de Gado"). Documentada como tela irmã quase idêntica de `[[EdContVendaGado]]`,
    completando `[[ContCompraGado]]`. Achado: mensagem de erro do Consultor não ajustada
    ("Comprador" mantido em Compra, diferente da tela de consulta que ajusta para "Vendedor").
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/EdContCompraGado.pas` + `.dfm`; ver
    `[[EdContVendaGado]]`, `[[ContCompraGado]]`.
