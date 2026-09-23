> **Nota de método**: este documento descreve uma tela de um sistema LEGADO já em produção,
> reconstruída por engenharia reversa do código-fonte — não é uma especificação de feature nova
> obtida por entrevista com um PO. Por isso, toda seção que normalmente viria de uma conversa de
> negócio (motivação, métricas, objetivos) foi preenchida por **inferência a partir do
> comportamento do código**, e está marcada explicitamente como `(inferência)`. Onde nem o código
> nem o contexto do módulo permitem inferir nada com segurança, o campo está como `N/A`.
> Fonte: leitura 100% literal de `Pecuaria/ExportaDietas.pas` (89 linhas de código + linha final,
> unit `ExportaDietas`, classe `TfmExportaDietas`) e do `.dfm` correspondente (154 linhas, título
> confirmado "Exportando Dietas "), nesta sessão — 1º arquivo `.pas` lido do módulo Pecuária.
> (Contagem de linhas corrigida em auditoria de 2026-09-02 — a versão anterior citava "108 linhas"
> para ambos os arquivos por engano; o conteúdo documentado já estava correto e completo.)
> **Modo de profundidade deste módulo**: a pedido do usuário, esta nota (e as demais deste módulo)
> segue um padrão de detalhamento **acima** do usado nos módulos anteriores (Adm/Fin, Algodoeira,
> Armazenagem, Sementes) — inclui dicionário de campos do `.dfm` e pseudocódigo fiel de cada
> procedure, com o objetivo de servir de insumo para uma ferramenta que tentará reconstruir o
> módulo a partir desta documentação. **Limitação importante e permanente, válida para todo o
> módulo**: o pacote de código-fonte disponível **não inclui scripts de `CREATE TABLE`/DDL**
> (as pastas em `scripts/` são apenas `triggers`, `procedures`, `functions`, `views`, `builds`,
> `suporte`) — portanto o **tipo exato de coluna SQL** (ex. `varchar(30)` vs `varchar(50)`,
> `int` vs `smallint`) não pode ser confirmado a partir do pacote; quando um campo tem componente
> `TField` persistente declarado no `.dfm`/`.pas` (ex. `TIntegerField`), o tipo Delphi é reportado
> como forte indício do tipo SQL; quando não há campo persistente, o tipo é inferido do uso no
> código (`QuotedStr`→string, `FormatFloatSQL`/`IntToStr`→numérico) e marcado `(inferência)`.
> Trigger de INSERT (`TI_TABELAS`) verificada nas 3 pastas de scripts: **não existe** — apenas
> `TD_TABELAS.sql`/`TU_TABELAS.sql` (DELETE/UPDATE); portanto o `INSERT INTO Tabelas` desta tela
> não dispara nenhuma trigger.

---

**Status da implementação:** Legado — em produção (documentado via engenharia reversa, sem item de trabalho associado)

**Owner (curadoria):** @jefferson.arantes
**Tags:** #Pecuaria #Dieta #Safra #Utilitario #CopiaDados

---

## 0) Resumo executivo

- **O que é:** utilitário de tela única "Exportando Dietas" — copia todos os registros de
  Classificação de Dieta (`Tabelas.Tipo=183`) de uma Safra de origem para uma Safra de destino,
  duplicando cada registro com um novo código sequencial na safra de destino.
- **Quando usar (inferência):** ao iniciar uma nova Safra, para replicar o cadastro de
  Classificações de Dieta já configurado em uma safra anterior, evitando recadastro manual.
- **Impacto principal:** `INSERT INTO Tabelas` (1 novo registro por Classificação de Dieta
  existente na Safra de origem) — nenhuma outra tabela é tocada, nenhuma trigger é disparada.

---

## 1) Conceito

| Termo | Definição |
|-------|-----------|
| "Classificação de Dieta" é um registro genérico na tabela `Tabelas`, discriminado por `Tipo=183` | Não existe tabela dedicada `ClassificacaoDieta` — é mais uma das dezenas de domínios cadastrados na tabela `Tabelas` do ERP (mesmo padrão genérico já visto em outros módulos: Safra=Tipo 1, Cultura=Tipo 2 etc., aqui Tipo 183 = Classificação de Dieta). |
| A cópia gera um novo `Codigo` por `SELECT MAX(Codigo)+1`, calculado **dentro** do próprio `INSERT` | `(SELECT max(codigo)+1 FROM Tabelas Where Tipo = 183)` — subquery escalar embutida diretamente no `VALUES` implícito do `INSERT...SELECT`; **achado de risco de concorrência**: como o `MAX+1` é calculado a cada iteração do laço (uma execução SQL por registro copiado, não em lote), duas execuções simultâneas desta tela poderiam colidir no mesmo `Codigo` (condição de corrida clássica de "max+1" sem `SEQUENCE`/lock), embora o volume de uso concorrente desta tela específica seja provavelmente baixo (inferência). |
| Cópia é linha-a-linha via cursor client-side, não um único `INSERT...SELECT` em lote | O código itera `cdsClassifDieta` (resultado do `SELECT Codigo FROM Tabelas WHERE Tipo=183 AND Safra=<origem>`) registro a registro, disparando **um `INSERT` completo por item** (`dmConsulta.cdsAux.Execute`) — não há transação explícita nem tratamento de erro por item (se um `INSERT` falhar no meio do laço, os anteriores já foram persistidos e não são revertidos). |

---

## 2) Dicionário de campos da tela (`.dfm`)

| Controle | Classe | Rótulo/Caption | Vinculado a | Obrigatório | Observações |
|---|---|---|---|---|---|
| `cbSafraOrig` | `TcxLookupComboBox` | (grupo "Safra Origem") | `dmConsulta.dsSafra` (`Tabelas.Tipo=1`), `KeyFieldNames='Codigo'`, coluna exibida `Descricao` | Implícito (pré-preenchido) | `DropDownListStyle=lsFixedList` (não permite digitar, só escolher da lista); `ImmediatePost=True`; pré-carregado com `_iSafra` (safra corrente do sistema) no `FormShow`. |
| `cbSafraDest` | `TcxLookupComboBox` | (grupo "Safra Destino") | mesma fonte `dmConsulta.dsSafra` | Sim (validado em `cxButton1Click`) | Mesma configuração de `cbSafraOrig`; **não** é pré-preenchido — inicia vazio/0. |
| `cxButton1` | `TcxButton` | "Copiar" (Hint: "Salvar como planilha" — **hint desatualizado/copiado de outra tela**, não reflete a ação real do botão) | — | — | Único botão de ação da tela; dispara toda a lógica de cópia. |

**Achado:** o `Hint` do botão ("Salvar como planilha") não corresponde à ação real (copiar Dietas entre Safras) — resíduo de copiar/colar de outra tela do módulo, não corrigido.

---

## 5) Jornada do usuário + Especificação funcional

### SP-01 — Abrir a tela (`FormShow`)
Carrega a lista de Safras (`Tabelas.Tipo=1`) em `dmConsulta.cdsSafra`; pré-seleciona
`cbSafraOrig` com a Safra corrente do sistema (`_iSafra`); `cbSafraDest` inicia vazio.

**Pseudocódigo fiel:**
```
ao mostrar a tela:
  criar StringList S
  abrir dmConsulta.cdsSafra com "SELECT Codigo, RTRIM(Descricao) Descricao FROM Tabelas WHERE Tipo = 1"
  cbSafraOrig.EditValue := _iSafra   // safra corrente global do sistema
```

### SP-02 — Copiar (`cxButton1Click`)

**Pseudocódigo fiel:**
```
ao clicar "Copiar":
  se cbSafraDest.EditValue <= 0:
    exibir aviso "Escolha uma Safra Destino Para Exportar os Dados"
    abortar (Abort — sem rollback pois nenhuma escrita ocorreu ainda)

  abrir cdsClassifDieta com:
    "SELECT Codigo FROM Tabelas WHERE Tipo = 183 AND Safra = <cbSafraOrig.EditValue>"

  para cada registro em cdsClassifDieta (do primeiro ao último):
    executar via dmConsulta.cdsAux (SQL dinâmico, EXECUTE direto — não passa por ClientDataSet.Post):
      INSERT INTO Tabelas (Codigo, Tipo, Descricao, Dias, ClassifDieta,
                            FinalidadeDieta, Mascara, UnidNegocio, Produto, Safra)
      (SELECT (SELECT MAX(Codigo)+1 FROM Tabelas WHERE Tipo = 183),
              Tipo, RTRIM(Descricao), Dias, ClassifDieta,
              FinalidadeDieta, RTRIM(Mascara), UnidNegocio, Produto,
              <cbSafraDest.EditValue>
         FROM Tabelas WHERE Tipo = 183 AND Codigo = <CodigoDoRegistroAtual>)
    // nota: o novo Codigo é GLOBAL (MAX+1 sobre TODOS os Tipo=183, não filtrado por Safra) —
    // ou seja, os códigos de Classificação de Dieta são únicos no domínio inteiro, não por Safra.

  se cbSafraDest.EditValue > 0:
    exibir mensagem de sucesso "Dados Copiados com Sucesso"
    // nota: esta condição é sempre verdadeira neste ponto, pois a validação em SP-02 já
    // garantiu isso antes do laço — a mensagem de sucesso é exibida incondicionalmente na prática.
```

### 5.3 Regras de negócio e validações

#### BR-001 — Safra de destino é obrigatória
- **Regra:** `if cbSafraDest.EditValue <= 0 then Abort` com aviso.
- **Mensagem:** "Escolha uma Safra Destino Para Exportar os Dados".

#### BR-002 — Nenhuma validação de duplicidade entre origem e destino
- **Achado:** a tela **não valida** se `cbSafraOrig = cbSafraDest`, nem se já existem
  Classificações de Dieta cadastradas na Safra de destino — reexecutar a operação para o mesmo
  par Origem/Destino duplica os registros (não há chave única/`WHERE NOT EXISTS` de proteção).

#### BR-003 — Nenhuma validação de que a Safra de origem possua Classificações de Dieta
- **Achado:** se `cbSafraOrig` não tiver nenhum registro `Tipo=183`, o laço simplesmente não
  executa nenhum `INSERT` e a mensagem de sucesso é exibida mesmo assim (nenhum feedback de
  "0 registros copiados").

---

## 6) Integrações e dados

### 6.1 Integrações (internas)

Nenhuma navegação para outras telas — utilitário autocontido, acessado a partir do menu do módulo
Pecuária (via `iniModuloPecuaria.pas`, ainda não lido nesta sessão).

### 6.2 Modelo de dados

**Tabela `Tabelas`** (genérica, compartilhada por todo o ERP — aqui usada apenas com
`Tipo=1` para Safra e `Tipo=183` para Classificação de Dieta):

| Coluna | Tipo (Delphi/inferido) | Papel nesta tela |
|---|---|---|
| `Codigo` | `TIntegerField` (persistente em `cdsClassifDietaCodigo`/`sqlClassifDietaCodigo`, `Required=True`) — `int` (alta confiança) | Chave do registro; gerado por `MAX(Codigo)+1` global (todo o domínio Tipo=183, não por Safra) no destino. |
| `Tipo` | inferência: `int`/`smallint` (usado sempre como literal numérico: `1`, `183`) | Discriminador de domínio — não editado, apenas copiado (`Tipo` do registro de origem, sempre 183 neste fluxo). |
| `Descricao` | inferência: `varchar` (usado com `RTRIM`) | Copiado literalmente (com `RTRIM`) da origem para o destino. |
| `Dias` | inferência: numérico (sem `QuotedStr`/`RTRIM` no SQL) | Copiado literalmente. |
| `ClassifDieta` | inferência: numérico ou código de domínio | Copiado literalmente. |
| `FinalidadeDieta` | inferência: numérico ou código de domínio | Copiado literalmente. |
| `Mascara` | inferência: `varchar` (usado com `RTRIM`) | Copiado literalmente (com `RTRIM`). |
| `UnidNegocio` | inferência: numérico (FK para `DetPessoas`/Unidade de Negócio, padrão do ERP) | Copiado literalmente. |
| `Produto` | inferência: numérico (FK para `Materiais`, padrão do ERP) | Copiado literalmente. |
| `Safra` | inferência: numérico (FK para `Tabelas.Tipo=1`) | **Não copiado da origem** — substituído explicitamente pelo valor de `cbSafraDest.EditValue`. |

**Achado de escopo (válido para todo o módulo, registrado aqui uma única vez)**: o pacote de
código-fonte não contém DDL/`CREATE TABLE`; os tipos acima são inferência a partir do uso no
código e dos componentes `TField` persistentes declarados no `.dfm`, não confirmação de schema.

### 6.3 Triggers e Procedures do banco

**Nenhuma.** `TI_TABELAS` (trigger de `INSERT` em `Tabelas`) **não existe** no pacote de scripts
(`scripts/triggers/`) — apenas `TD_TABELAS.sql` (`DELETE`) e `TU_TABELAS.sql` (`UPDATE`), nenhuma
das quais é exercida por esta tela (que só executa `INSERT`). Nenhuma stored procedure/function é
chamada.

---

## 7) Suporte: FAQ, mensagens, erros e troubleshooting

### 7.2 Catálogo de mensagens e erros

| Mensagem exata | Causa |
|---|---|
| "Escolha uma Safra Destino Para Exportar os Dados" | BR-001 — `cbSafraDest` não preenchido |
| "Dados Copiados com Sucesso" | Confirmação ao final do laço (exibida mesmo se 0 registros foram copiados — ver BR-003) |

---

## 9) Notas de revisão

- **2026-09-02** (auditoria de profundidade — lote de 6 telas)
  - **O que foi verificado:** releitura completa e literal de `ExportaDietas.pas` (89 linhas) e
    `.dfm` (154 linhas) linha a linha, incluindo os componentes não-visuais (`dsClassifDieta`,
    `cdsClassifDieta`, `dspClassifDieta`, `sqlClassifDieta` e seus `TIntegerField` persistentes).
    Conclusão: o dicionário de campos da Seção 2 já estava exaustivo — os 3 controles editáveis/
    acionáveis do `.dfm` (`cbSafraOrig`, `cbSafraDest`, `cxButton1`) estavam todos cobertos; os
    `TcxGroupBox` são apenas contêineres visuais sem vínculo a dado, corretamente omitidos da
    tabela. Não há grid, aba, nem campo `Visible=False`/`Enabled=False` nesta tela (tela de
    utilitário de 2 campos). Não há fórmula de cálculo (apenas cópia literal de campos) — logo,
    não se aplica a checagem de `RoundTo`/sinal negativo. Caminho de menu e satélites: esta tela
    não chama nem é chamada por nenhuma outra tela do módulo (confirmado nesta releitura).
  - **Único gap encontrado:** o cabeçalho da nota citava "108 linhas" tanto para o `.pas` quanto
    para o `.dfm` — contagem real é 89 e 154 linhas respectivamente. Corrigido no bloco de
    metodologia no topo do arquivo. Não havia gap de conteúdo/regra de negócio.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/ExportaDietas.pas` + `.dfm` (releitura integral).

- **2026-08-27** (criação da nota — módulo Pecuária, 1º arquivo)
  - **O que mudou:** nota criada do zero, a partir de leitura 100% literal de
    `Pecuaria/ExportaDietas.pas` (108 linhas) + `.dfm` (108 linhas, título confirmado
    "Exportando Dietas "). Primeira nota do módulo Pecuária, já no modo de profundidade elevado
    (dicionário de campos + pseudocódigo fiel) definido para este módulo. Achados: hint do botão
    desatualizado, condição de corrida em potencial no `MAX(Codigo)+1`, ausência de validação de
    duplicidade/origem=destino, `Codigo` de Classificação de Dieta é global (não por Safra).
    Confirmado que `Tabelas` não tem trigger de `INSERT` — cópia não dispara efeitos colaterais.
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/ExportaDietas.pas` + `.dfm`.
