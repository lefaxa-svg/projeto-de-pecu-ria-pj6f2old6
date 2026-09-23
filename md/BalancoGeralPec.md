> **Nota de método**: este documento descreve uma tela de um sistema LEGADO já em produção,
> reconstruída por engenharia reversa do código-fonte — não é uma especificação de feature nova
> obtida por entrevista com um PO. Por isso, toda seção que normalmente viria de uma conversa de
> negócio (motivação, métricas, objetivos) foi preenchida por **inferência a partir do
> comportamento do código**, e está marcada explicitamente como `(inferência)`. Onde nem o código
> nem o contexto do módulo permitem inferir nada com segurança, o campo está como `N/A`.
> Fonte: leitura 100% literal de `Pecuaria/BalancoGeralPec.pas` (213 linhas, unit
> `BalancoGeralPec`, classe `TfmBalancoGeralPec`) e do `.dfm` correspondente (título confirmado
> "Balanço Geral do Retiro"), nesta sessão — 4º arquivo `.pas` lido do módulo Pecuária. Tela
> **100% somente-leitura** (relatório) que delega toda a lógica de cálculo a 2 stored procedures,
> ambas lidas integralmente e documentadas em notas próprias: `[[spBalancoGeralPec]]` (motor
> principal — receita, custo, GPD do Retiro) e `[[spAnalVendasPec]]` (usada aqui apenas para
> extrair o GPD segregado por Sexo). Ver nota de método completa (limitação de DDL/tipos de
> coluna) em `[[ExportaDietas]]`, válida para todo o módulo.

---

**Status da implementação:** Legado — em produção (documentado via engenharia reversa, sem item de trabalho associado)

**Owner (curadoria):** @jefferson.arantes
**Tags:** #Pecuaria #Retiro #Balanco #GPD #Relatorio #Confinamento

---

## 0) Resumo executivo

- **O que é:** relatório "Balanço Geral do Retiro" — imprime, para um Retiro e uma data de corte,
  o balanço financeiro e zootécnico completo (entradas, saídas/vendas, custos de ração/fixo/
  despesas, animais expurgados/mortos, GPD Global e por Sexo) via `EXEC dbo.spBalancoGeralPec`.
- **Quando usar (inferência):** para avaliar o resultado acumulado de um Retiro (lote de
  confinamento/pasto) até uma data qualquer, tipicamente ao encerrar um ciclo ou para
  acompanhamento gerencial periódico.
- **Impacto principal:** nenhum no banco — tela 100% de consulta/impressão; os únicos `.Post`
  ocorrem em `ClientDataSet`s locais (`cdsBalancoGeral`) para injetar o GPD por sexo no relatório
  antes de imprimir, sem persistência.

---

## 1) Conceito

| Termo | Definição |
|-------|-----------|
| Toda a lógica de cálculo mora nas procedures, não na tela | A unit Delphi apenas monta os parâmetros (Empresa, Safra, Fazenda, Retiro, Data) e passa para `EXEC dbo.spBalancoGeralPec`/`EXEC dbo.spAnalVendasPec` — nenhum cálculo de negócio ocorre em Object Pascal. Ver `[[spBalancoGeralPec]]` para a fórmula completa. |
| GPD por Sexo é obtido com uma chamada **redundante e cara** à procedure de Análise de Vendas | `spAnalVendasPec` é uma procedure de ~750 linhas com cursor e sub-chamadas (`spConsumoMedioPec`) desenhada para produzir 7 níveis de relatório completo — aqui é chamada **2 vezes** (uma por sexo) só para ler a coluna `GPD` do primeiro registro do "Resumo Geral", descartando toda a informação de custo/receita que ela também calcula. Ver achado equivalente em `[[spAnalVendasPec]]`. |
| Retiro padrão é o primeiro da Fazenda selecionada, sem opção "Todos" | `cbFazendasPropertiesEditValueChanged`: ao trocar a Fazenda, recarrega `dmPecuaria.cdsRetiros` filtrado por `Fazenda` e seleciona automaticamente o **primeiro** registro (`First` + `cbRetiros.EditValue := FieldByName('Sequencial')`) — o relatório é sempre por 1 Retiro específico, nunca consolidado. |
| Atalho de depuração Ctrl+F9 copia o último SQL para a área de transferência | `FormKeyDown`: `Clipboard.AsText := S.Text` — mas como `S` é reaproveitada em `btnImprimirClick` para montar 3 comandos `EXEC` sequenciais (Balanço, GPD Macho, GPD Fêmea) e não é limpa entre eles de forma persistente para esse fim, o conteúdo copiado reflete o **último** comando montado (`EXEC dbo.spAnalVendasPec ... @Sexo = 2 ...`), não necessariamente o comando mais relevante para depuração do Balanço em si — mesmo padrão de "painel/atalho de diagnóstico" visto em outras telas do módulo. |

---

## 2) Dicionário de campos da tela (`.dfm`)

| Controle | Classe | Rótulo/Caption | Vinculado a | Obrigatório | Observações |
|---|---|---|---|---|---|
| `cbFazendas` | `TcxLookupComboBox` | (grupo "Fazendas") | `dmConsulta.cdsUnidNeg` — `DetPessoas` filtrado por `Codigo=_iEmpresa AND Pecuaria='S'`, restrito por permissão `UN` se não supervisor | Pré-preenchido com `_iUnidNegoc` | Ao trocar, recarrega `cbRetiros`. |
| `cbRetiros` | `TcxLookupComboBox` | (grupo "Retiros") | `dmPecuaria.cdsRetiros` — `Retiros WHERE Fazenda=<cbFazendas>` | Auto-selecionado (1º registro) | Não permite "Todos os Retiros" — sempre 1 Retiro específico. |
| `deData` | `TcxDateEdit` | "Data" | — | Pré-preenchido com `Date` (hoje) | Data de corte do balanço — todos os movimentos considerados são `<= deData.Date`. |
| `btnImprimir` | `TcxButton` | "Imprimir" | — | — | Dispara todo o fluxo de cálculo + impressão. |
| `btnSair` | `TcxButton` | "Sair" | — | — | Fecha a tela (`Close`). |

---

## 5) Jornada do usuário + Especificação funcional

### SP-01 — Abrir a tela (`FormShow`)
Carrega Fazendas com Pecuária habilitada (`DetPessoas.Pecuaria='S'`, respeitando permissão `UN` se
usuário não é Supervisor); pré-seleciona `cbFazendas` com a Unidade de Negócio corrente
(`_iUnidNegoc`); `deData` inicia com a data de hoje.

### SP-02 — Trocar Fazenda (`cbFazendasPropertiesEditValueChanged`)
Recarrega `cbRetiros` filtrado pela Fazenda escolhida, selecionando o primeiro Retiro.

### SP-03 — Imprimir (`btnImprimirClick`)

**Pseudocódigo fiel:**
```
ao clicar "Imprimir":
  # 1. Balanço geral do retiro
  executar (cdsBalancoGeral.Open):
    EXEC dbo.spBalancoGeralPec
      <_iEmpresa>, '<_sEmpresa>', <_iSafra>, '<_sSafra>',
      '<cbFazendas.EditingText>', <cbRetiros.EditValue>, '<cbRetiros.EditingText>',
      '<deData.Date, formato mm/dd/yyyy>'
    // retorna 1 único registro agregado — ver [[spBalancoGeralPec]]

  # 2. GPD dos Machos
  executar (cdsAnalVendas.Open):
    EXEC dbo.spAnalVendasPec
      @Safra=<_iSafra>, @Fazenda=<cbFazendas.EditValue>, @Retiro=<cbRetiros.EditValue>, @Sexo=1,
      @DataIni='01/01/1950', @DataFim='<deData.Date>'
  vGPDM := cdsAnalVendas.FieldByName('GPD').AsFloat   // 1º registro = "Resumo Geral"

  # 3. GPD das Fêmeas
  executar (cdsAnalVendas.Open):
    EXEC dbo.spAnalVendasPec
      @Safra=<_iSafra>, @Fazenda=<cbFazendas.EditValue>, @Retiro=<cbRetiros.EditValue>, @Sexo=2,
      @DataIni='01/01/1950', @DataFim='<deData.Date>'
  vGPDF := cdsAnalVendas.FieldByName('GPD').AsFloat

  # 4. Injetar GPD por sexo no resultado do Balanço (edição local, não persiste no banco)
  cdsBalancoGeral.Edit
  cdsBalancoGeral.GPDM := vGPDM
  cdsBalancoGeral.GPDF := vGPDF
  cdsBalancoGeral.Post

  # 5. Imprimir via RTM
  dmReport.ppRReport.Template := 'BalancoGeralPec.rtm'
  dmReport.ppRReport.Print
```

### 5.3 Regras de negócio e validações

Nenhuma validação de campo obrigatório própria desta unit — `cbRetiros` é sempre preenchido
automaticamente (ver Conceito) e `deData` sempre tem um valor padrão; a única forma de falha é
indireta, se as procedures levantarem erro de SQL (não tratado explicitamente por `try/except`
específico nesta unit além do `finally cdsBalancoGeral.Close`).

**Arredondamento e sinal (negativo/positivo):** esta unit não contém nenhum campo numérico
editável pelo usuário (os únicos controles são 2 lookups — Fazenda/Retiro — e 1 data de corte) e
não faz **nenhum** cálculo aritmético em Object Pascal — não há `RoundTo`/`SimpleRoundTo`/`Round`/
`Trunc`/`FormatFloat` em `BalancoGeralPec.pas` (confirmado por leitura literal do arquivo
completo), nem `BeforePost`/`OnValidate`/`OnEditValueChanged` que trate valores negativos. Os
únicos campos numéricos manipulados aqui (`GPDM`/`GPDF`, gravados via `cdsBalancoGeral.Edit` +
`FieldByName(...).AsFloat := vGPD*` + `Post`) são apenas **transportados** — o valor já vem
arredondado (ou não) da procedure `spAnalVendasPec`/`spBalancoGeralPec`; ver regras de
arredondamento e sinal na fórmula do GPD documentadas em `[[spBalancoGeralPec]]` e
`[[spAnalVendasPec]]`.

---

## 6) Integrações e dados

### 6.1 Integrações (internas)

Nenhuma navegação para outras telas — relatório autocontido. **Chamador confirmado:**
`[[iniModuloPecuaria]]` mapeia `sReferencia = 'BalancoGeralPec'` diretamente para esta tela
(`Application.CreateForm(TfmBalancoGeralPec, ...)` + `ShowModal`), sem parâmetro de contexto —
acessível a partir do menu principal do módulo Pecuária.

### 6.2 Modelo de dados

Tela 100% somente-leitura — nenhuma tabela é gravada diretamente. Tabelas consultadas pelas
procedures (ver detalhamento completo em `[[spBalancoGeralPec]]`/`[[spAnalVendasPec]]`):
`vwMovAnimais`, `Tabelas` (`Tipo=172` Categoria, `Tipo=166` Raça), `SaldosPec`, `RegMortesPec`,
`SubGruposLotes`, `LotesBaias`, `BrincosMov`, `LancTratosLC`, `CustosRetiros`, `DespesasPec`,
`TabPrecosConfinamento`/`PrecosConfinamento`, `Pessoas`/`DetPessoas`, `dmConsulta.cdsUnidNeg`
(`DetPessoas`), `dmPecuaria.cdsRetiros` (`Retiros`).

### 6.3 Triggers e Procedures do banco

- **`[[spBalancoGeralPec]]`** — motor principal do balanço (receita, custo, GPD, animais
  expurgados/mortos). Texto literal e explicação completa na nota própria.
- **`[[spAnalVendasPec]]`** — chamada 2× (uma por Sexo) apenas para extrair `GPD` do Resumo Geral;
  texto literal e explicação completa (incluindo as 7 visualizações que esta tela **não** usa) na
  nota própria.

---

## 7) Suporte: FAQ, mensagens, erros e troubleshooting

### 7.2 Catálogo de mensagens e erros

| Mensagem exata | Causa |
|---|---|
| "Consulta enviada para a Área de Transferencia." | Atalho de depuração `Ctrl+F9` (ver Conceito). |

Nenhuma mensagem de validação de negócio própria — erros de SQL das procedures propagam como
exceção não tratada explicitamente por mensagem customizada nesta unit.

---

## 9) Notas de revisão

- **2026-09-02** (auditoria de profundidade — módulo Pecuária)
  - **O que foi verificado:** releitura 100% literal de `Pecuaria/BalancoGeralPec.pas` (213 linhas)
    e `.dfm` (455 linhas) nesta sessão, controle a controle. **Dicionário de campos (seção 2)
    confirmado exaustivo** — a tela é um diálogo simples sem abas/grades (apenas 2
    `TcxLookupComboBox`, 1 `TcxDateEdit`, 2 botões; os demais objetos do `.dfm`
    — `TClientDataSet`/`TDataSource`/`TSQLDataSet`/`TDataSetProvider` — são componentes de dados
    não-interativos, corretamente fora da tabela de controles de tela). Nenhum campo com
    `Visible=False` ou `Enabled=False` oculto encontrado.
  - **Gap real corrigido:** seção 6.1 dizia "acessado a partir do menu... `iniModuloPecuaria.pas`,
    ainda não lido nesta sessão" — desatualizado, pois `[[iniModuloPecuaria]]` já foi lido e
    documentado em sessão anterior (2026-08-28/09-01) e confirma `sReferencia = 'BalancoGeralPec'`
    → esta tela diretamente, sem parâmetro de contexto. Referência cruzada corrigida.
  - **Confirmação explícita adicionada (seção 5.3):** esta unit não possui nenhum campo numérico
    editável nem lógica de arredondamento/sinal própria — confirmado que não há
    `RoundTo`/`SimpleRoundTo`/`Round`/`Trunc`/`FormatFloat` em `BalancoGeralPec.pas`; os campos
    `GPDM`/`GPDF` são apenas transportados do resultado de `spAnalVendasPec` para
    `cdsBalancoGeral` antes da impressão, sem cálculo local. Regra de arredondamento/sinal do GPD
    em si já documentada nas notas das procedures satélites.
  - **Satélites:** `[[spBalancoGeralPec]]` e `[[spAnalVendasPec]]` já existiam e já estavam
    corretamente referenciadas nesta nota (seção 6.3) — nenhuma dúvida antiga pendente de
    resolver.
  - **Impacto:** nenhum no sistema (documentação apenas). Nota já estava estruturalmente completa;
    a auditoria corrigiu 1 referência cruzada desatualizada e tornou explícita a ausência de
    arredondamento/campos numéricos editáveis nesta tela.
  - **Referências:** código-fonte `Pecuaria/BalancoGeralPec.pas` + `.dfm` (releitura completa);
    `[[iniModuloPecuaria]]`; `[[spBalancoGeralPec]]`; `[[spAnalVendasPec]]`.

- **2026-08-27** (criação da nota — módulo Pecuária)
  - **O que mudou:** nota criada do zero, a partir de leitura 100% literal de
    `Pecuaria/BalancoGeralPec.pas` (213 linhas) + `.dfm` (título confirmado "Balanço Geral do
    Retiro"). Documentado o fluxo de 3 chamadas a procedure (Balanço + GPD Macho + GPD Fêmea) e o
    achado de uso redundante/caro de `spAnalVendasPec` apenas para extrair uma coluna. As 2
    procedures (`spBalancoGeralPec`, 452 linhas; `spAnalVendasPec`, 751 linhas) lidas
    integralmente e documentadas em notas próprias, conforme decisão de organização deste módulo.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/BalancoGeralPec.pas` + `.dfm`;
    `scripts/procedures/spBalancoGeralPec.sql`, `spAnalVendasPec.sql`; ver `[[spBalancoGeralPec]]`,
    `[[spAnalVendasPec]]`.
