> **Nota de método**: este documento descreve uma tela de um sistema LEGADO já em produção,
> reconstruída por engenharia reversa do código-fonte — não é uma especificação de feature nova
> obtida por entrevista com um PO. Por isso, toda seção que normalmente viria de uma conversa de
> negócio (motivação, métricas, objetivos) foi preenchida por **inferência a partir do
> comportamento do código**, e está marcada explicitamente como `(inferência)`. Onde nem o código
> nem o contexto do módulo permitem inferir nada com segurança, o campo está como `N/A`.
> Fonte: leitura 100% literal de `Pecuaria/EdRecepcaoAnimais.pas` (1164 linhas, unit
> `EdRecepcaoAnimais`, classe `TfmEdRecepcaoAnimais`) e do `.dfm` correspondente (título
> confirmado "Edição da Recepção de Animais"), nesta sessão — 86º arquivo `.pas` lido do módulo
> Pecuária. **Completa a nota parcial `[[RecepcaoAnimais]]`** (CRUD real do Romaneio de GTA,
> aberto por `dnNavegaButtonsButtonClick`/duplo-clique daquela tela). Ver nota de método completa
> (limitação de DDL/tipos de coluna) em `[[ExportaDietas]]`, válida para todo o módulo.

---

**Status da implementação:** Legado — em produção (documentado via engenharia reversa, sem item de trabalho associado)

**Owner (curadoria):** @jefferson.arantes
**Tags:** #Pecuaria #GTA #Romaneio #Recepcao #Contrato #Comercial

---

## 0) Resumo executivo

- **O que é:** formulário de **inclusão/edição de 1 Romaneio de GTA** (`RomaneiosPec`) — reusa a
  mesma classe para Entrada (Recepção, `sTipo='E'`) e Saída (`sTipo='S'`) com rótulos/permissões
  invertidos, mesmo padrão de reaproveitamento visto em `[[RecepcaoAnimais]]`. 2 abas: "Romaneio"
  (dados comerciais/pesagem) e "GTA" (dados sanitários/de transporte da Guia).
- **Preço calculado com 2 modos mutuamente exclusivos** (`TipoPreco`: 'C'=por Cabeça, '@'=por
  Arroba) — em ambos os casos, Frete e Comissão são rateados pelo Total Desembarcado e somados ao
  preço base (`PcoUnit`), com fórmulas cruzadas para expressar o resultado tanto em `Preco@`
  quanto em `VlrUnitFinal` — mesmo conceito de "preço dual Cabeça/Arroba" já visto em
  `[[EdContVendaGado]]`/`[[EdContCompraGado]]`.
- **Vínculo opcional a Contrato filtra por 2 sistemas de Contrato simultaneamente** — a busca de
  Contratos disponíveis (`ceDbPropPropertiesEditValueChanged`) usa a tabela genérica `Contratos`
  com `GrupoComercial IN (7,9)` para Entrada (Compra ou Boitel) ou `= 8` para Saída (Venda),
  **exigindo** que exista ao menos 1 item em `ItContratosPec` vinculado — reforça o achado já
  catalogado de que `ItContratosPec` é compartilhado como tabela-filha entre múltiplos contextos
  de Contrato-pai (`Contratos`/`ContratosPec`).
- **GTA "Complementar" grava um registro espelho em `DocumentosGTA`** (`prVinculaGtaDocumento`,
  chamada só se houver `Documento` vinculado) — monta dinamicamente um `INSERT` ou `UPDATE`
  (`CASE WHEN NULL THEN novo ELSE mantém`) só com os campos efetivamente preenchidos, usando uma
  lista fixa de ~26 campos (`prPreencheListaDeCampos`) — mecanismo de "preencher documento fiscal
  a partir da 1ª GTA que trouxer os dados", útil quando GTAs complementares da mesma guia física
  chegam em romaneios separados e nenhuma isolada tem todos os dados.
- **Impacto principal:** `INSERT`/`UPDATE RomaneiosPec` (via `CommitTransacaoTabelas`, mesmo
  wrapper padrão de commit do módulo); `INSERT`/`UPDATE DocumentosGTA` condicional (GTA vinculada
  a Documento).

---

## 1) Conceito

| Termo | Definição |
|-------|-----------|
| `Sequencial`/`Data`/`Hora`/`Fazenda`/`Tipo` são imutáveis, atribuídos só no Insert | `cdsRecepAfterInsert`/`BeforePost` (`State=dsInsert`): `LoadSequencia('RomaneiosPec','Sequencial')`, Data/Hora = agora, Fazenda = `lblFazenda.Tag` (herdado da tela-mãe), Tipo = `sTipo`. |
| Validação da aba GTA só é obrigatória quando `Utilizado='S'` (GTA principal, não complementar) | Se `Utilizado='N'` (complementar), pula toda a validação de Emissão/Vencimento/Transporte/Finalidade/Espécie/Categoria/Qtd — só a GTA "principal" de uma guia precisa desses dados completos. |
| "Quebra" (`ceQuebra`) é a diferença percentual entre Peso Líquido de Chegada e Peso de Embarque | Calculada automaticamente a cada mudança de Peso de Chegada/Tara/Embarque — indicador de perda de peso no transporte (não persistido, campo calculado em tela). |
| Botão "Peso" (Chegada/Tara) integra com balança ou leitura manual | `btnPesoChegadaClick`: `_sTipoLeituraPeso='P'` abre `TfmLerPeso` (hardware de balança); senão usa `BuscaPesoTxt` (leitura de arquivo texto) — mesmo padrão dual já visto em outras pesagens do módulo. |
| Contrato pré-preenche Fornecedor/Fazenda de Origem e Espécie/Forma de Preço | `lkContratoPropertiesEditValueChanged`: ao selecionar um Contrato, copia `PessoaOrigem`/`FazOrigem` (e `Consultor` na Saída) do próprio Contrato, e Espécie/TipoPreco do 1º item de `ItContratosPec` correspondente. |
| Sem `RoundTo`/`Round` no cálculo de `VlrUnitFinal` (confirmado, auditoria 2026-09-02) | As 2 fórmulas de `VlrUnitFinal` (por Cabeça e por Arroba) usam `AsFloat` puro — nenhum `RoundTo`/`SimpleRoundTo`/`Round`/`Trunc` em toda a cascata de cálculo de preço desta unit. |

---

## 2) Dicionário de campos da tela (`.dfm`)

| Controle | Classe | Rótulo/Caption | Vinculado a (campo BD) | Obrigatório | Observações |
|---|---|---|---|---|---|
| `ceDbProp` | `TcxDBCurrencyEdit` | Proprietário | `RomaneiosPec.Proprietario` | Sim | F2 abre ajuda de Pessoa (grupo 'P3'). |
| `ceDbFornec` | `TcxDBCurrencyEdit` | Fornecedor/Cliente | `RomaneiosPec.PessoaOrigem` | Sim | Grupo 'F1' (Entrada) / 'C1' (Saída). |
| `lkFazenda` | `TcxDBLookupComboBox` | Fazenda do Fornecedor/Cliente | `RomaneiosPec.FazOrigem` | Sim | Recarregado ao trocar Fornecedor. |
| `lkContrato` | `TcxDBLookupComboBox` | — | `RomaneiosPec.Contrato` | — | Filtrado por Proprietário/Fornecedor + `GrupoComercial`. |
| `ceDbComprador` | `TcxDBCurrencyEdit` | Vendedor/Comprador | `RomaneiosPec.Consultor` | — | Grupo 'C3' (Entrada) / 'V1' (Saída). |
| `teMinuta`/`cedbDoc` | `TcxDBTextEdit`/`TcxDBCurrencyEdit` | Minuta/Documento | `RomaneiosPec.Minuta`/`Documento` | — | F2 em `cedbDoc` abre `TfmBuscaDocumento`. |
| `cbVeiculo`/`btnVeiculo` | `TcxDBLookupComboBox`/`TcxButton` | — | `RomaneiosPec.Caminhao` | — | Botão abre cadastro de Caminhões (`Principal/Materiais/Caminhoes.pas`, lido — ver "6.1 Integrações"). |
| `ceOdomSaida`/`ceOdomChegada`/`cePercurso` | `TcxDBCurrencyEdit` | Odômetro Saída/Chegada/Percurso | `RomaneiosPec.OdometroSaida`/`OdometroEnt`/`KmPercurso` | — | Percurso calculado automaticamente. |
| `ceEmbarque`/`ceChegada`/`ceTara`/`ceQuebra`/`ceLiq` | `TcxDBCurrencyEdit`/`TcxCurrencyEdit` | Peso Embarque/Chegada/Tara/Quebra/Líquido | `RomaneiosPec.KgEmbarque`/`kgChegada`/`Tara` | Sim (Chegada) | Chegada/Tara habilitados só com permissão (22068 Entrada / 22070 Saída) ou Supervisor. |
| `ceTotalDesembarque`/`ceTotalAnimais` | `TcxDBCurrencyEdit` | Total Desembarque / Total Animais (calc.) | `RomaneiosPec.TotalDesembarque` | Sim | Confirmação se diferir do somatório de Categorias. |
| `cbCategoria`..`cbCategoria8`/`ceQtdAnimais`..`8` | `TcxDBLookupComboBox`/`TcxDBCurrencyEdit` | Categoria 1-8 / Qtd 1-8 | `RomaneiosPec.Categoria..8`/`QtdAnimais..8` | Cat/Qtd 1 obrig. (GTA) | Somados em `clTotalAnimais` (calc field). |
| `cbForma` | `TcxDBComboBox` | Forma (Preço/Cabeça ou Arroba) | `RomaneiosPec.TipoPreco` | — | Pode ser pré-preenchido pelo Contrato. |
| `ceUnitario`/`ceFrete`/`ceComissao`/`ceArroba`/`ceUnitFinal` | `TcxDBCurrencyEdit` | Preço Unit./Frete/Comissão/Preço@/Vlr Unit. Final | `RomaneiosPec.PcoUnit`/`PcoFrete`/`PcoComissao`/`Preco@`/`VlrUnitFinal` | — | Calculados, ver Conceito. |
| `ceMortos`/`ceLesao`/`ceSemBrinco` | `TcxDBCurrencyEdit` | Mortos/Lesão/Sem Brinco | `RomaneiosPec.QtdMortos`/`QtdLesao`/`QtdSembrinco` | — | — |
| `mmObs` | `TcxDBMemo` | Observação | `RomaneiosPec.Observacao` | — | — |
| **Aba GTA:** `teGTA`, `cbComplemento` | `TcxDBTextEdit`/`TcxDBCheckBox` | Nº GTA / É Complemento | `RomaneiosPec.GTA`/`Utilizado` (invertido: marcado = Complemento = `'N'`) | Sim (se principal) | Aviso se GTA já existente na base. |
| `deEmissaoGTA`/`deVencimentoGTA` | `TcxDBDateEdit` | Emissão/Vencimento | `RomaneiosPec.EmissaoGTA`/`VencimentoGTA` | Sim (se principal) | — |
| `lkEspecies`/`cbFinalidade`/`cbTipoTransp` | vários | Espécie/Finalidade/Tipo Transporte | `RomaneiosPec.Especie`/`Finalidade`/`TipoTransporte` | Sim (se principal) | Finalidade: domínio fixo A/E/R/X/L/S/T/O. |
| `deAftosa`/`deTuberculose`/`deOutras` | `TcxDBDateEdit` | Datas de Vacinação/Exames | `RomaneiosPec.DtAftosa`/`DtBrucelose`/`DtOutras` | — | — |

---

## 5) Jornada do usuário + Especificação funcional

### SP-01 — Abrir (`FormShow`)
Ajusta título/rótulos conforme `sTipo`; habilita Peso de Chegada/Tara por permissão; consulta o
Romaneio pela PK (`Tag`) ou inicia Insert se `Tag=0`.

### SP-02 — Selecionar Proprietário/Fornecedor (`ceDbPropPropertiesEditValueChanged`/
`ceDbFornecPropertiesEditValueChanged`) → recarrega Contratos disponíveis (filtro por
Proprietário OU PessoaOrigem + GrupoComercial + existência de item em `ItContratosPec`).

### SP-03 — Selecionar Contrato (`lkContratoPropertiesEditValueChanged`)
Pré-preenche PessoaOrigem/FazOrigem(/Consultor) e Espécie/TipoPreco do 1º item correspondente.

### SP-04 — Informar pesagens/quantidades → cálculos automáticos em cascata
Quebra%, Peso Líquido, Peso/Preço Médio por Cabeça e por Arroba (`ceUnitarioPropertiesEditValueChanged`).

### SP-05 — Gravar (`cdsRecepBeforePost`) → `[[EdRecepcaoAnimais]]` (auto-referência)
Validações completas (ver 5.3); grava PK/Safra/Fazenda/Tipo se Insert.

### SP-06 — Pós-gravação (`cdsRecepAfterPost`)
`CommitTransacaoTabelas` (commit padrão do módulo) + `prVinculaGtaDocumento` (se houver Documento
vinculado — grava/atualiza `DocumentosGTA`).

### 5.3 Regras de negócio e validações

- **BR-001 — Proprietário/Fornecedor/Fazenda de Origem/Total Desembarque/Peso de Chegada sempre obrigatórios.**
- **BR-002 — Se GTA informada e `Utilizado='S'` (principal): Emissão/Vencimento/Tipo
  Transporte/Finalidade/Espécie/Categoria 1/Qtd 1 obrigatórios.**
- **BR-003 — Se GTA informada e `Utilizado='N'` (complementar): valida apenas se já existe GTA
  correspondente cadastrada (não permite complemento "órfão").**
- **BR-004 — GTA duplicada gera aviso informativo (não bloqueia) ao sair do campo.**

---

## 6) Integrações e dados

### 6.1 Integrações (internas)

- **`[[RecepcaoAnimais]]`** — tela-mãe (grade de consulta), abre esta em modo Insert/Edit/ReadOnly.
- **`Principal/Materiais/Caminhoes.pas`** (fora do módulo Pecuária; lida em auditoria posterior,
  2026-09-01) — CRUD genérico de cadastro de veículos (tabela `Caminhoes`), aberto pelo botão
  `btnVeiculo`. Confirmado: opera exclusivamente sobre a própria tabela `Caminhoes` (+ vínculo
  opcional com `Bens`/`SolicitacaoPesagem` para tara fixa) — **nenhuma escrita em tabelas do
  módulo Pecuária** (`RomaneiosPec` etc.); não é um satélite "load-bearing" como
  `[[TravamentoCambio]]` foi para Algodoeira, apenas um cadastro auxiliar compartilhado.
- **`Compartilhada/PesagemRomaneios/LerPeso.pas`** (fora do módulo Pecuária; lida em auditoria
  posterior, 2026-09-01) — widget de leitura de peso via porta serial (balança), configurado por
  arquivo `.cfg` externo (`_sBalanca+usuário+'.cfg'` ou `balanca.cfg`). Confirmado: **não acessa
  banco de dados** — só lê a porta serial, popula `cePeso`/`nPeso` em memória e fecha; o
  chamador (`btnPesoChegadaClick` aqui) é quem decide o que fazer com o valor lido.
- **`Compartilhada/Documentos/BuscaDocumento.pas`** (fora do módulo Pecuária; lida em auditoria
  posterior, 2026-09-01) — diálogo de busca/seleção de `Documentos` (notas fiscais), reutilizado
  por vários módulos comerciais (parâmetro `iTela` alterna o layout/filtro conforme o módulo
  chamador). Confirmado: **somente leitura** — a única gravação é a flag `Marcado` local ao grid
  em memória (não persistida); devolve `iCodigo`/`sNumero` do documento escolhido ao chamador via
  campos públicos, sem tocar em tabelas do módulo Pecuária.
- **`ItContratosPec`/`Contratos`** — mesmo par de tabelas já catalogado como achado de risco
  (FK compartilhada sem discriminador entre `Contratos`/`ContratosPec`) em
  `[[ContratoBoitel]]`/`[[EdContratoBoitel]]`/`[[EdContVendaGado]]`.

### 6.2 Modelo de dados

**Tabela `RomaneiosPec`** (campos adicionais confirmados aqui, complementando `[[RecepcaoAnimais]]`):
todos os campos do dicionário acima já cobrem a totalidade das colunas usadas pela tela.

**Tabela `DocumentosGTA`** (introduzida nesta unit) — espelho de dados de GTA vinculados a um
`Documentos.Sequencial`, atualizado incrementalmente (só campos não-nulos) a cada Romaneio gravado
com aquele Documento — colunas: mesma lista de `prPreencheListaDeCampos` (Utilizado, datas de
GTA, Tipo Transporte, Finalidade, Espécie, 8× Categoria/QtdAnimais, TotalDesembarque, 3 datas
sanitárias, Observação) + `Sequencial`/`Data`/`Hora`/`GTA`.

### 6.3 Triggers e Procedures do banco

Nenhuma identificada nesta unit — persistência via `TDataSetProvider`/`ApplyUpdates` padrão
(`dspRecepUpdateError` só exibe a mensagem de erro do SQL Server, sem procedure customizada) e
`prExecutaCds`/`prAbreCds` (helpers genéricos de execução SQL ad-hoc, não são procedures de banco).
Confirmado (auditoria 2026-09-02): `scripts/triggers` não tem nenhum arquivo para `RomaneiosPec`.

---

## 7) Suporte: FAQ, mensagens, erros e troubleshooting

### 7.2 Catálogo de mensagens e erros

| Mensagem exata | Causa |
|---|---|
| "Indique o Propriet�rio/o Fornecedor/a Fazenda do Fornecedor/a Quantidade Total/o Peso de Chegada do Recebimento." | BR-001 |
| "N�o foi encontrado GTA correspondente para o complemento informado. Verifique o n�mero do GTA." | BR-003 |
| "Indique a Emiss�o/o Vencimento/o Tipo de Transporte/a Finalidade/a Esp�cie do GTA." / "Selecione pelo menos a Categoria 1/a Quantidade de Animais 1 do GTA." | BR-002 |
| "GTA j� Existente na Base da Dados." | Aviso informativo, não bloqueia |
| "Recalcular o Total?" | Confirmação ao divergir Total Desembarque × soma de Categorias |
| "C�digo do Propriet�rio/Fornecedor/Comprador Inv�lido." | Busca de Pessoa sem correspondência |

---

## 9) Notas de revisão

- **2026-09-02** (auditoria campo-a-campo — módulo Pecuária)
  - **O que mudou:** confirmado explicitamente ausência de `RoundTo`/`Round` na cascata de
    cálculo de preço; confirmado (grep em `scripts/triggers`) que `RomaneiosPec` não tem trigger.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/EdRecepcaoAnimais.pas`.

- **2026-09-01** (auditoria de profundidade — módulo Pecuária)
  - **O que mudou:** lidos os 3 satélites cross-module antes marcados como "Pendente"
    (`Caminhoes.pas`, `LerPeso.pas`, `BuscaDocumento.pas` — nenhum físicamente na pasta
    `Pecuaria/`). Confirmado que nenhum dos 3 grava em tabelas do módulo Pecuária — são
    utilitários genéricos compartilhados (cadastro de veículo, leitura de balança, busca de nota
    fiscal), não satélites "load-bearing" como `[[TravamentoCambio]]` foi para Algodoeira. Ver
    "6.1 Integrações" para o detalhamento de cada um.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** `Principal/Materiais/Caminhoes.pas`, `Compartilhada/PesagemRomaneios/
    LerPeso.pas`, `Compartilhada/Documentos/BuscaDocumento.pas`.

- **2026-08-28** (criação da nota — módulo Pecuária)
  - **O que mudou:** nota criada do zero, a partir de leitura 100% literal de
    `Pecuaria/EdRecepcaoAnimais.pas` (1164 linhas) + `.dfm` (título confirmado "Edição da Recepção
    de Animais"). **Completa a nota parcial `[[RecepcaoAnimais]]`** — CRUD real do Romaneio de
    GTA. Documentado o cálculo dual de preço (Cabeça/Arroba), o filtro de Contrato reforçando o
    achado de risco de `ItContratosPec` compartilhada, e o mecanismo de espelhamento incremental
    em `DocumentosGTA` para GTAs complementares.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/EdRecepcaoAnimais.pas` + `.dfm`; ver
    `[[RecepcaoAnimais]]`, `[[ContratoBoitel]]`, `[[EdContratoBoitel]]`, `[[EdContVendaGado]]`.
