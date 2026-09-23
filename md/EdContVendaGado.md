> **Nota de método**: este documento descreve uma tela de um sistema LEGADO já em produção,
> reconstruída por engenharia reversa do código-fonte — não é uma especificação de feature nova
> obtida por entrevista com um PO. Por isso, toda seção que normalmente viria de uma conversa de
> negócio (motivação, métricas, objetivos) foi preenchida por **inferência a partir do
> comportamento do código**, e está marcada explicitamente como `(inferência)`. Onde nem o código
> nem o contexto do módulo permitem inferir nada com segurança, o campo está como `N/A`.
> Fonte: leitura 100% literal de `Pecuaria/EdContVendaGado.pas` (710 linhas, unit
> `EdContVendaGado`, classe `TfmEdContVendaGado`) e do `.dfm` correspondente (título confirmado
> "Edição do Contrato de Venda de Gado"), nesta sessão — 68º arquivo `.pas` lido do módulo
> Pecuária. **Completa `[[ContVendaGado]]`** (CRUD real, delegado por aquela tela — nota daquela
> deixa de ser parcial). **Achado de risco reforçado:** confirma que `ItContratosPec.Contrato`
> também referencia `Contratos.Sequencial` para `GrupoComercial=8` (Venda) — o mesmo padrão já
> visto em `[[EdContratoBoitel]]` (`GrupoComercial=9`) e distinto de `[[ContratoCVGado]]`
> (`ContratosPec.Sequencial`) — agora **3 contextos de "Contrato pai"** compartilham a mesma
> tabela de detalhe `ItContratosPec` sem discriminador visível. Ver nota de método completa
> (limitação de DDL/tipos de coluna) em `[[ExportaDietas]]`, válida para todo o módulo.

---

**Status da implementação:** Legado — em produção (documentado via engenharia reversa, sem item de trabalho associado)

**Owner (curadoria):** @jefferson.arantes
**Tags:** #Pecuaria #Contrato #Venda #Comercial #CRUD

---

## 0) Resumo executivo

- **O que é:** tela de Inclusão/Edição/Visualização de um Contrato de Venda de Gado — mestre
  (`Contratos`, `GrupoComercial=8`) + detalhe (`ItContratosPec`, 1 linha por Categoria/Avaliação
  de animais negociados, com Quantidade, Peso, Rendimento de Carcaça e 3 formas de valor
  interligadas: por Cabeça, por Arroba, Total).
- **Cálculo circular entre 5 campos do detalhe, com guarda `bRecalc` contra loop infinito** —
  `VlrCabeca`, `Vlr@`, `VlrTotal`, `PesoTotal`/`DescontoKG`/`RenCarcaca`→`Total@`→`PesoMedio@`
  formam uma rede de dependências onde editar qualquer um recalcula os outros; a flag privada
  `bRecalc` impede que a cadeia de recálculo dispare a si mesma recursivamente.
- **Mesmo padrão mestre-detalhe rígido de `[[EdContratoBoitel]]`**: detalhe bloqueado
  (Inserir/Editar/Excluir) enquanto o mestre não estiver salvo.
- **Impacto principal:** `INSERT`/`UPDATE Contratos` (`GrupoComercial=8` fixo); `INSERT`/
  `UPDATE`/`DELETE ItContratosPec`.

---

## 1) Conceito

| Termo | Definição |
|-------|-----------|
| Rede de cálculo circular do detalhe (achado central) | `PesoTotal`/`DescontoKG`/`RenCarcaca` → `Total@ = (PesoTotal × (1-Desconto%) × RenCarcaca%) / 15` → `PesoMedio@ = Total@ / Quantidade` → dispara recálculo de `VlrCabeca`/`Vlr@`/`VlrTotal`; e cada um dos 3 campos de valor (`VlrCabeca`, `Vlr@`, `VlrTotal`) recalcula os outros 2 quando editado diretamente — todos guardados por `bRecalc` (seta `false` antes de alterar outro campo, `true` depois, para o próprio `OnChange` do campo alterado não disparar de novo). |
| `15` como divisor fixo em `Total@` — conversão de Kg para Arrobas | `/ 15` — constante numérica sem nome/comentário explicando a unidade (1 arroba = 15 kg é a convenção padrão brasileira de peso de carcaça bovina) — mesma conversão implícita já vista sem nomeação em outras partes do módulo. |
| Papéis Pessoa/Produtor idênticos a `[[ContVendaGado]]` | `Pessoa`=Empresa/Origem, `Produtor`=Cliente/Destino — reconfirma o mapeamento já documentado na tela de consulta. |
| Campo "Situação" inicializado como `'1'` (string), mesmo padrão de `[[EdContratoBoitel]]` | Reforça a inconsistência de convenção `'1'` (tabela genérica `Contratos`) vs. `'A'`/`'C'` (`ContratosPec`) entre as 2 famílias de contrato. |
| Sem `RoundTo`/`Round` em toda a unit (confirmado, auditoria 2026-09-02) | Nenhuma chamada a `RoundTo`/`SimpleRoundTo`/`Round`/`Trunc`/`FormatFloat` em todo o `.pas` (710 linhas) — inclui a rede de cálculo circular do detalhe (`VlrCabeca`/`Vlr@`/`VlrTotal`/`Total@`/`PesoMedio@`) e o divisor `/15`. Todas as 11 validações obrigatórias (`Numero`/`Negociacao`/`Pessoa`/`LocalRetirada`/`Produtor`/`LocalEntrega` no mestre; `Avaliacao`/`Categoria`/`Quantidade`/`RenCarcaca`/`PesoTotal` no detalhe) usam consistentemente `<=0`, cobrindo negativo e zero de forma uniforme — mas os 3 campos de valor calculado (`VlrCabeca`/`Vlr@`/`VlrTotal`), que participam da rede circular, **não têm nenhuma validação de obrigatoriedade/sinal própria** (podem ficar em zero ou negativo se a rede de recálculo produzir esse resultado, sem aviso). |

---

## 2) Dicionário de campos da tela (`.dfm`)

| Controle | Classe | Rótulo/Caption | Vinculado a (campo BD) | Obrigatório | Observações |
|---|---|---|---|---|---|
| `ceNumero` | `TcxDBCurrencyEdit` | — | `Contratos.Numero` | Sim | — |
| `deData` | `TcxDBDateEdit` | — | `Contratos.Data` | Sim | — |
| `cbNegociacao` | `TcxDBLookupComboBox` | — | `Contratos.Negociacao` (`Tabelas.Tipo=22`, `GrupoComercial=8`) | Sim | — |
| `ceCodPessoaOrigem`/`lkFazOrigem` | `TcxDBCurrencyEdit`/`TcxDBLookupComboBox` | — | `Contratos.Pessoa`/`LocalRetirada` | Sim | F2 abre ajuda ('F1'). |
| `ceCodPessoaDest`/`lkFazDest` | `TcxDBCurrencyEdit`/`TcxDBLookupComboBox` | — | `Contratos.Produtor`/`LocalEntrega` | Sim | F2 abre ajuda ('C1'). |
| `ceCodConsultor` | `TcxDBCurrencyEdit` | — | `Contratos.Consultor` | — | F2 abre ajuda ('C3'). |
| `mmObs` | `TcxDBMemo` | — | `Contratos.Observacao1` | — | — |
| Grid `gdITContratosPec` | `TcxGridDBBandedTableView` | Avaliação/Categoria/Quantidade/Vlr Cabeça/Vlr@/Vlr Total/Peso Total/Rend.Carcaça/Desconto Kg/Peso Médio@/Total@ | `cdsItContratosPec` | — | Edição inline; bloqueada até o mestre ser salvo. |
| `dnNavega`/`dnITNavega` | `TcxDBNavigator` | — | — | — | Mestre e detalhe. |

---

## 5) Jornada do usuário + Especificação funcional

### SP-01 — Abrir a tela (`FormShow`)
Verifica permissões; carrega Categorias (`Tipo=172`), Avaliações (`Tipo=207`), Tipos de
Negociação (`Tipo=22`, `GrupoComercial=8`); carrega o Contrato; modo Inclusão entra em `Insert`.

### SP-02 — Gravar o Contrato mestre (`cdsEdContratosPecBeforePost`)
Valida Número/Data/Negociação/Pessoa Origem/Fazenda Origem/Pessoa Destino/Fazenda Destino; se
inserção, atribui Empresa/Safra/`GrupoComercial=8`/Sequencial/Situação=`'1'`/Moeda/
AgenteVendas=0/ComissaoAgente=0.

### SP-03 — Gerenciar itens do detalhe (`cdsItContratosPecBefore*`)
Bloqueia Inserir/Editar/Excluir com mestre não salvo.

### SP-04 — Gravar item do detalhe (`cdsItContratosPecBeforePost`)
Valida Avaliação/Categoria/Quantidade/Rendimento de Carcaça/Peso Total obrigatórios; se inserção,
gera `Sequencial` via `LoadSequencia` e vincula ao Contrato.

### SP-05 — Recalcular valores (rede circular, ver Conceito)

### 5.3 Regras de negócio e validações

- **BR-001 a BR-006 — validações do mestre:** Número, Data, Tipo de Negociação, Pessoa Origem,
  Fazenda Origem, Pessoa Destino, Fazenda Destino.
- **BR-007 a BR-011 — validações do item de detalhe:** Avaliação, Categoria, Quantidade,
  Rendimento de Carcaça, Peso Total.
- **BR-012 — Detalhe bloqueado sem mestre salvo.**

---

## 6) Integrações e dados

### 6.1 Integrações (internas)

- **`[[ContVendaGado]]`** — tela chamadora (consulta/listagem).

### 6.2 Modelo de dados

**Tabela `Contratos`** (`GrupoComercial=8`) — campos adicionais confirmados: `Empresa`, `Safra`,
`Numero`, `AgenteVendas`, `ComissaoAgente`, `Moeda`, `TotalQtd`, `ValorTotal` (agregados,
provavelmente mantidos por trigger não identificada nesta unit).

**Tabela `ItContratosPec`** (campos adicionais confirmados, distintos dos já vistos em
`[[EdContratoBoitel]]`): `Avaliacao` (FK `Tabelas.Tipo=207`), `Categoria` (FK
`Tabelas.Tipo=172`), `VlrCabeca`, `Vlr@`, `VlrTotal`, `PesoTotal`, `RenCarcaca`, `DescontoKG`,
`PesoMedio@`, `Total@`.

### 6.3 Triggers e Procedures do banco

**`[[TIU_ItContratosPec]]`**/**`[[TD_ItContratosPec]]`** (lidas e documentadas integralmente em
sessão posterior) — mantêm `Contratos.ValorTotal`/`TotalQtd` como agregados automáticos de
`SUM(ItContratosPec.VlrTotal)`/`SUM(Quantidade)`, resolvendo a dúvida original: nenhum código
desta unit precisa atualizar esses campos, é a trigger quem faz. **`[[ti_Contratos]]`**/
**`[[TD_Contratos]]`** — genéricas sobre `Contratos` (`INSERT`/`DELETE`), disparadas por esta
unit; ver achados de aplicabilidade parcial a Pecuária em `[[TD_Contratos]]` (bloqueio de
`ClassFinComercial`/`MovFinComercial` aplicado aqui — `GrupoComercial=8`).

---

## 7) Suporte: FAQ, mensagens, erros e troubleshooting

### 7.2 Catálogo de mensagens e erros

| Mensagem exata | Causa |
|---|---|
| "Indique um Número para o Contrato." / "Indique a Data do Contrato." / "Indique um Tipo de Negociação." / "Indique a Pessoa de Origem." / "Indique a Fazenda de Origem." / "Indique a Pessoa de Destino." / "Indique a Fazenda de Destino." | Validação do mestre |
| "Indique a Avaliação." / "Indique a Categoria." / "Indique a Quantidade." / "Indique o Rendimento de Carcaça." / "Indique o Peso Total." | Validação do item de detalhe |
| "Salve o Contrato para Inserir/Editar/Excluir os Itens/Animais Negociados." | Ação no detalhe com mestre não salvo |
| "Código da Pessoa de Origem/Destino Inválido." / "Código do Comprador Inválido." | Busca de Pessoa sem correspondência |

---

## 9) Notas de revisão

- **2026-09-02** (auditoria campo-a-campo — módulo Pecuária)
  - **O que mudou:** confirmado explicitamente que não há nenhum `RoundTo`/`Round` em toda a
    unit. Achado: os 3 campos de valor calculado da rede circular (`VlrCabeca`/`Vlr@`/
    `VlrTotal`) não têm validação de sinal/obrigatoriedade própria, ao contrário dos demais
    campos do detalhe (todos `<=0`).
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/EdContVendaGado.pas`.

- **2026-09-01** (auditoria de profundidade — módulo Pecuária)
  - **O que mudou:** identificadas as triggers `[[TIU_ItContratosPec]]`/`[[TD_ItContratosPec]]`
    como origem de `Contratos.ValorTotal`/`TotalQtd` — resolve o achado/dúvida registrado na
    criação desta nota. Este era um gap real de trigger não encontrada na varredura estrutural
    original (a busca por triggers foi feita, mas o nome `ItContratosPec` só foi associado à
    tabela genérica após leitura mais profunda em sessão posterior).
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** ver `[[TIU_ItContratosPec]]`, `[[TD_ItContratosPec]]`.

- **2026-08-28** (criação da nota — módulo Pecuária)
  - **O que mudou:** nota criada do zero, a partir de leitura 100% literal de
    `Pecuaria/EdContVendaGado.pas` (710 linhas) + `.dfm` (título confirmado "Edição do Contrato
    de Venda de Gado"). Completa o CRUD de `[[ContVendaGado]]`. Reforça o achado de risco de FK
    compartilhada de `ItContratosPec` (agora 3 contextos de "Contrato pai" confirmados: Boitel,
    Venda, e `ContratosPec` de `[[ContratoCVGado]]`). Documentada a rede de cálculo circular
    entre os campos de valor do detalhe.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/EdContVendaGado.pas` + `.dfm`; ver
    `[[ContVendaGado]]`, `[[EdContratoBoitel]]`, `[[ContratoCVGado]]`. Pendente:
    `EdContCompraGado.pas` (trará confirmação análoga para `GrupoComercial=7`).
