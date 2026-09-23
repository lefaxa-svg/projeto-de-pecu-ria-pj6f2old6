> **Nota de método**: este documento descreve uma tela de um sistema LEGADO já em produção,
> reconstruída por engenharia reversa do código-fonte — não é uma especificação de feature nova
> obtida por entrevista com um PO. Por isso, toda seção que normalmente viria de uma conversa de
> negócio (motivação, métricas, objetivos) foi preenchida por **inferência a partir do
> comportamento do código**, e está marcada explicitamente como `(inferência)`. Onde nem o código
> nem o contexto do módulo permitem inferir nada com segurança, o campo está como `N/A`.
> Fonte: leitura 100% literal de `Pecuaria/EdRecepcaoIngredientes.pas` (1017 linhas, unit
> `EdRecepcaoIngredientes`, classe `TfmEdRecepcaoIngredientes`) e do `.dfm` correspondente
> (título confirmado "Edição da Recepção de Ingredientes"), nesta sessão — 84º arquivo `.pas`
> lido do módulo Pecuária. **Completa `[[RecepcaoIngredientes]]`** (CRUD real, delegado por
> aquela tela — nota daquela deixa de ser parcial). Ver nota de método completa (limitação de
> DDL/tipos de coluna) em `[[ExportaDietas]]`, válida para todo o módulo.

---

**Status da implementação:** Legado — em produção (documentado via engenharia reversa, sem item de trabalho associado)

**Owner (curadoria):** @jefferson.arantes
**Tags:** #Pecuaria #Ingredientes #Balanca #Classificacao #Descontos

---

## 0) Resumo executivo

- **O que é:** tela de pesagem/classificação de recebimento de um Ingrediente — cabeçalho único
  de `Romaneios` (`Origem='I'`), com **motor de descontos por classificação de qualidade**
  (Umidade/Impureza/Ardido/Avariado/Quebrado/Esverdeado, cada um com % informado e Kg descontado
  calculado ou digitado manualmente) — **mesmo padrão de classificação de recebimento de grãos do
  módulo Armazenagem/Agrícola**, reaproveitado aqui para ingredientes de ração (reforça o achado
  já registrado em `[[RecepcaoIngredientes]]` de que `Romaneios` é uma tabela de balança genérica
  do ERP).
- **Arredondamento confirmado:** os 6 Kg de desconto calculados automaticamente (`GetDesconto(...)`)
  usam `Trunc(SubTotal_ou_PesoLiq * Perc / 100)` — **truncamento puro** (descarta casas decimais,
  sempre "para baixo" em valor absoluto para números positivos), não há `Round`/`RoundTo`/
  `SimpleRoundTo` em nenhum dos 6 handlers. `ceValorTotal` (`PesoLiq × VlUnit`) também não aplica
  nenhum arredondamento — usa o resultado `Double` bruto do cálculo em memória.
- **Sinal:** nenhum dos 12 campos de %/Kg de classificação, nem `PesoBruto`/`Tara`/`VlUnit`, tem
  validação de "não permitir negativo" nesta unit — o `DisplayFormat` dos Kg
  (`',0.00;( ,0.00)'`) inclusive já prevê exibir valor negativo entre parênteses.
- **2 modos de cálculo de desconto** (`iBase`, 1 ou 2) — a ordem em que os descontos sucessivos
  são aplicados sobre o Peso Bruto muda conforme a base: modo 1 desconta Umidade **antes** dos
  demais (sobre o Subtotal bruto); modo 2 desconta Umidade **depois** dos demais (sobre o Peso
  Líquido já descontado de Impureza/Ardido/Avariado/Quebrado) — o campo que define qual modo usar
  (`iBase`) tem sua atribuição real **comentada/desativada no código-fonte**
  (`dbTabelaPropertiesEditValueChanged`), então na prática `iBase` nunca é setado por esse
  caminho — achado de risco: o valor de `iBase` usado em runtime provavelmente vem de outro lugar
  não identificado nesta unit, ou permanece no valor padrão de tipo (`0`), o que faria nenhum dos
  2 blocos `if ibase=1`/`elseif ibase=2` executar em alguns cálculos (ex.: `dbKgEsverdExit`).
- **"Liberar Desconto"** (`sLiberaDesconto`, ligado a `Tabelas.Desabilita` da Cultura do Produto)
  controla se o Kg de desconto é **calculado automaticamente** (`GetDesconto`, função genérica
  por Tabela de Desconto/Cultura) ou pode ser **digitado manualmente** pelo usuário — quando
  `sLiberaDesconto='N'`, todo `OnExit` de percentual recalcula todos os Kg automaticamente,
  ignorando eventual edição manual anterior.
- **Impacto principal:** `INSERT`/`UPDATE Romaneios` (`Origem='I'`); `Numero` (código do Romaneio)
  gerado por uma sequência **composta por Origem+Safra+UnidArmazDestino** (via `LoadSequencia`
  com múltiplas colunas de filtro).

---

## 1) Conceito

| Termo | Definição |
|-------|-----------|
| Cadeia de recálculo de `PesoLiq` repetida quase identicamente em 9 handlers | Cada `OnExit` de percentual (`cbPercUmidadeExit`, `cbPercImpurExit`, `dbPercArdidoExit`, etc.) recalcula `SubTotal` e depois `PesoLiq = SubTotal - ΣKg(6 descontos)` — a mesma fórmula de 5 linhas está duplicada literalmente 6+ vezes ao longo da unit (achado de duplicação de código extensa, mais pronunciada que em outras units do módulo). |
| Campo Peso lido de balança física (`btnPesoChegadaClick`) | Se `_sTipoLeituraPeso='P'` (porta serial, mesma variável de configuração global usada em outras integrações de balança do ERP), abre `TfmLerPeso` (leitura de porta serial); senão usa `BuscaPesoTxt` (leitura de arquivo texto) — 2 modos de integração com balança física, ambos genéricos do ERP (não específicos deste módulo). |
| Peso Bruto/Tara protegidos por permissão especial | `ceTara`/`cePesoBruto.Enabled` exigem `_sSupervisor='S'` ou permissão específica (`TemPermissao(22069)`) — apenas usuários com essa permissão elevada podem digitar manualmente os pesos de báscula (presumivelmente para coibir fraude/erro na pesagem oficial). |
| "Finalizar Recebimento" é opcional a cada gravação | `cdsRecepBeforePost`: pergunta "Deseja Finalizar o Recebimento de Ingredientes?" a cada Post — se sim, grava `DataSaida=Now` (mesmo campo consumido por `[[RecepcaoIngredientes]]` para habilitar "Gerar" Doc.Estoque); se não, o Romaneio permanece "em aberto" para edição posterior. |

---

## 2) Dicionário de campos da tela (`.dfm`)

| Controle | Classe | Rótulo/Caption | Vinculado a (campo BD) | Obrigatório | Observações |
|---|---|---|---|---|---|
| `deData` | `TcxDBDateEdit` | — | `Romaneios.Data` | Sim | Default: hoje. |
| `ceRomaneio` | `TcxDBCurrencyEdit` | "Romaneio" | `Romaneios.Romaneio` | — | `Enabled=False`, `Properties.ReadOnly=True` — número do Romaneio, só-leitura (gerado por sequência composta, ver 5.3). |
| `ceFornec` | `TcxDBCurrencyEdit` | — | `Romaneios.Produtor` | Sim | F2 abre ajuda de Pessoa. |
| `ceProduto` | `TcxDBCurrencyEdit` | — | `Romaneios.Produto` | Sim | Ao escolher, carrega Culturas vinculadas ao Produto. |
| `lkCultura` | `TcxDBLookupComboBox` | "Cultura" (aba Complementos) | `Romaneios.Cultura` | — | Herdado do módulo Agrícola; ao trocar define `sLiberaDesconto` e recarrega `dbTabela`/`lkTalhao` (ver SP-03). |
| `lkTalhao` | `TcxDBLookupComboBox` | "Talhão" (aba Complementos) | `Romaneios.Campo` | — | Herdado do módulo Agrícola (achado já registrado). |
| `dbTabela` | `TcxDBLookupComboBox` | "Tabela de Desconto" (aba Complementos) | `Romaneios.Tabela` | — | **Omitido da versão anterior desta tabela.** Lista `dmConsulta.cdsTabDescontos` (Tipo=33, filtrada pela Cultura escolhida) — é a Tabela de Desconto usada por `GetDesconto` em todos os 6 cálculos de Kg de classificação. `Properties.OnEditValueChanged = dbTabelaPropertiesEditValueChanged`, cujo corpo está **inteiramente comentado** (ver achado de risco do `iBase` no Conceito) — ou seja, trocar a Tabela na tela não recalcula `iBase` em runtime, apesar do handler existir. |
| `ceNFP` / `cePesoNFP` | `TcxDBCurrencyEdit` | "N.F.P." / "Peso N.F.P." (aba Complementos) | `Romaneios.NFP` / `PesoNFP` | — | **Omitidos da versão anterior desta tabela.** Sem `OnEditValueChanged`/validação própria — apenas digitação livre; não participam de nenhuma fórmula de cálculo desta unit. |
| `ceTicket` | `TcxDBCurrencyEdit` | "Ticket" | `Romaneios.Ticket` | — | **Omitido da versão anterior desta tabela.** Campo editável (sem `Enabled=False`), sem F2/validação — número de ticket digitado livremente pelo usuário, não gerado pela tela. |
| `cbVeiculo`/`btnVeiculo` | `TcxDBLookupComboBox`/`TcxButton` | — | `Romaneios.Placa` | — | Botão abre cadastro rápido de Caminhões. |
| `ceTransportadora`/`ceMotorista` | `TcxDBCurrencyEdit` | — | `Romaneios.Transportadora`/`Motorista` | — | F2 abre ajuda de Pessoa. |
| `cbUnidArmaz` | `TcxDBLookupComboBox` | — | `Romaneios.UnidArmazDestino` | Sim | — |
| `cePesoBruto`/`btnPesoChegada`, `ceTara`/`btnPesoTara` | `TcxDBCurrencyEdit`/`TcxButton` | — | `PesoBruto`/`Tara` | — | Protegidos por permissão; botão lê da balança física. |
| `cePesoLiq`, `cdSubTotal` | `TcxDBCurrencyEdit` | — | `PesoLiq`/`SubTotal` (calculados) | Sim (Líq>0) | Ambos `Enabled=False` no `.dfm` — são só-leitura na tela, exibem o resultado do recálculo automático (usuário nunca digita `PesoLiq`/`SubTotal` diretamente). |
| Grupo "Classificação" (`gbClassif`): 6× %+Kg | `TcxDBCurrencyEdit` | Umidade/Impureza/Ardido/Avariado/Quebrado/Esverdeado | `Perc*`/`Kg*` | — | Ver Conceito (2 modos de cálculo). Nenhum dos 12 campos tem `Enabled=False`/máscara de sinal — nada no código impede digitar valor negativo em `Perc*` ou `Kg*` (quando `sLiberaDesconto<>'N'`); `DisplayFormat=',0.00;( ,0.00)'` inclusive já prevê exibir negativo entre parênteses. Não há `OnValidate`/checagem de `>=0` em nenhum dos 12 handlers (`*Exit`/`*Enter`) desta unit. |
| `ceVlUnit`/`ceValorTotal` | `TcxDBCurrencyEdit`/`TcxCurrencyEdit` | — | `VlUnit` / calculado | Sim (VlUnit>0) | `ceValorTotal` tem `Enabled=False` e `Properties.ReadOnly=True`, e **não tem `DataBinding.DataField`** — é um campo puramente visual (não gravado em `Romaneios`), preenchido só em memória por `ceVlUnitPropertiesEditValueChanged` (`PesoLiq × VlUnit`, sem `RoundTo`/`Round` — usa o `Double` bruto do `EditValue`). |
| `ceOperacao` | `TcxDBCurrencyEdit` | — | `Romaneios.Operacao` | — | F2 abre ajuda de Operação. |
| `mmObs` | `TcxDBMemo` | — | `Romaneios.Observacao` | — | — |
| `dnNavega` | `TcxDBNavigator` | — | — | — | F5-F7. |

---

## 5) Jornada do usuário + Especificação funcional

### SP-01 — Abrir a tela (`FormShow`)
Restringe edição de Peso Bruto/Tara por permissão; carrega Unidades de Armazenagem, Veículos,
Operações; carrega o Romaneio (`Origem='I'`, `Sequencial=Tag`); modo Inclusão se `Tag=0`.

### SP-02 — Escolher Produto → `CarregaCulturas` (Culturas vinculadas ao Produto)

### SP-03 — Escolher Cultura → `CarregaTalhoes` + define `sLiberaDesconto`
Consulta `Tabelas` (Tipo=33, Tabela de Desconto da Cultura) e `Tabelas.Desabilita` (controla
cálculo automático vs. manual dos Kg de desconto).

### SP-04 — Ler Peso Bruto/Tara da balança (`btnPesoChegadaClick`) → `TfmLerPeso` ou
`BuscaPesoTxt`

### SP-05 — Editar % de Classificação → recalcula Kg + PesoLíq (ver Conceito, 9 handlers quase
idênticos)

### SP-06 — Gravar (`cdsRecepBeforePost`)
Valida Data/Fornecedor/Produto/U.A./Peso Líquido/Valor Unitário; se inserção, gera
`Sequencial`/`Numero` (sequência composta Origem+Safra+U.A.), `Origem='I'`, `TipoEntSai='E'`;
pergunta se deseja finalizar (`DataSaida=Now`).

### 5.3 Regras de negócio e validações

- **BR-001 a BR-005 — validações de gravação:** Data, Fornecedor, Produto, Unidade de
  Armazenagem, Peso Líquido (>0), Valor Unitário (>0) obrigatórios.
- **Achado de risco:** `iBase` (determina qual dos 2 modos de cálculo de desconto é usado) tem
  sua atribuição comentada no código — comportamento real em runtime não totalmente esclarecido
  por esta unit isoladamente.

---

## 6) Integrações e dados

### 6.1 Integrações (internas)

- **`[[RecepcaoIngredientes]]`** — tela chamadora (consulta/listagem).
- **`GetDesconto`**, **`TfmLerPeso`**, **`BuscaPesoTxt`**, **`TfmCaminhoes`**, **`CarregaOperacao`**
  — funções/telas utilitárias genéricas do ERP (compartilhadas com Armazenagem/Agrícola).

### 6.2 Modelo de dados

Confirma/expande `Romaneios` (já documentada em `[[RecepcaoIngredientes]]`): `Ticket`,
`PesoBruto`, `Tara`, `SubTotal`, `PercUmid`/`KgUmid`, `PercImpur`/`KgImpur`,
`PercArdido`/`KgArdido`, `PercAvariado`/`KgAvariado`, `PercQuebrado`/`KgQuebrado`,
`PercEsverd`/`KgEsverd`, `NomeDe`, `Tabela` (FK `Tabelas.Tipo=33`), `DataEntrada`, `NFP`,
`PesoNFP`.

### 6.3 Triggers e Procedures do banco

Nenhuma identificada nesta unit.

---

## 7) Suporte: FAQ, mensagens, erros e troubleshooting

### 7.2 Catálogo de mensagens e erros

| Mensagem exata | Causa |
|---|---|
| "Selecione a Data do Recebimento." / "...o Fornecedor..." / "...o Produto..." / "...a Unidade de Armazenamento..." | Validação de gravação |
| "Indique o Peso do Recebimento." / "Selecione o Valor Unitário do Recebimento." | Validação de gravação |
| "Deseja Finalizar o Recebimento de Ingredientes?" | Confirmação de finalização |
| "Código do Fornecedor/Produto/da Transportadora/do Motorista/da Operação Inválido." | Buscas sem correspondência |

---

## 9) Notas de revisão

- **2026-09-02** (auditoria de profundidade — releitura completa do `.pas`/`.dfm`)
  - **O que mudou:** dicionário de campos (seção 2) tinha 3 gaps reais — faltavam `dbTabela`
    (Tabela de Desconto, campo crítico do motor de descontos, com handler de troca
    `dbTabelaPropertiesEditValueChanged` inteiramente comentado), `ceNFP`/`cePesoNFP` (N.F.P./Peso
    N.F.P.) e `ceTicket` (Ticket, digitável livremente). Também não estava documentado que
    `ceRomaneio` é só-leitura, que `cePesoLiq`/`cdSubTotal`/`ceValorTotal` têm `Enabled=False` (só
    exibem cálculo), e que `ceValorTotal` não tem `DataBinding.DataField` (é campo em memória, não
    gravado). Confirmado e citado explicitamente: os 6 Kg de desconto usam `Trunc` puro (sem
    `Round`/`RoundTo`); nenhum campo de %/Kg/peso tem validação anti-negativo. Seções 1, 2 e 5.3
    corrigidas/expandidas.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** releitura de `Pecuaria/EdRecepcaoIngredientes.pas` (1017 linhas) e `.dfm`
    (2029 linhas) completos nesta sessão.

- **2026-08-28** (criação da nota — módulo Pecuária)
  - **O que mudou:** nota criada do zero, a partir de leitura 100% literal de
    `Pecuaria/EdRecepcaoIngredientes.pas` (1017 linhas) + `.dfm` (título confirmado "Edição da
    Recepção de Ingredientes"). Completa `[[RecepcaoIngredientes]]`. Documentado o motor de
    descontos por classificação (6 critérios, reaproveitado de Armazenagem/Agrícola) e a
    integração com balança física. Achado de risco: atribuição de `iBase` comentada no código.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/EdRecepcaoIngredientes.pas` + `.dfm`; ver
    `[[RecepcaoIngredientes]]`.
