> **Nota de método**: este documento descreve uma tela de um sistema LEGADO já em produção,
> reconstruída por engenharia reversa do código-fonte — não é uma especificação de feature nova
> obtida por entrevista com um PO. Por isso, toda seção que normalmente viria de uma conversa de
> negócio (motivação, métricas, objetivos) foi preenchida por **inferência a partir do
> comportamento do código**, e está marcada explicitamente como `(inferência)`. Onde nem o código
> nem o contexto do módulo permitem inferir nada com segurança, o campo está como `N/A`.
> Fonte: leitura 100% literal de `Pecuaria/AutomacaoTratos.pas` (831 linhas, unit
> `AutomacaoTratos`, classe `TfmAutomacaoTratos`) e do `.dfm` correspondente (título confirmado
> "Automação de Tratos"), nesta sessão — 73º arquivo `.pas` lido do módulo Pecuária. **Caminho de
> chamada confirmado (auditoria 2026-09-02):** não é item de menu principal — `AutomacaoTratos`
> não aparece no mapa `sReferencia→Tela` de `[[iniModuloPecuaria]]`. É aberta exclusivamente de
> dentro de `[[TratosLC]]` (tela "Lançamento de Tratos"), via popup menu `pmArquivo`
> (`TratosLC.pas`/`.dfm`, linhas ~2800-2818 e ~881-923): item "Arquivo de &Envio"
> (`miArqEnvClick`, `Tag:= (Sender as TMenuItem).Tag`), "Arquivo de &Recebimento"
> (`miArqRecClick`, `Tag:= 1` fixo) e "Arquivo &Teste" (também usa `miArqEnvClick`). **Achado:**
> nem `miArqEnv` nem `miArqTeste` têm a propriedade `Tag` definida no `.dfm`, e nenhum trecho de
> `TratosLC.pas` a atribui em tempo de execução — ambos herdam o padrão `Tag = 0` do
> `TMenuItem`. Como `AutomacaoTratos.ExportaDados`/`FormShow` distinguem o "modo Teste" pelo
> valor `Tag = -1` (arquivo `.agm` de teste com dado fictício de hora/data), o item de menu
> "Arquivo Teste" **na prática dispara o mesmo `Tag = 0` do "Arquivo de Envio"** — o ramo de
> código específico para `Tag = -1` (comentários "Inf. Arquivo Teste", flag `'S'` em vez de `'U'`,
> nome de arquivo `TS_Teste.agm`) parece hoje inalcançável pela UI, a menos que exista outro
> chamador não encontrado nesta sessão. **Integração com hardware físico**
> (porta serial `TComPort`, dispositivo "DataKey"/Docking Station — um pen-drive de contato
> elétrico usado por misturadores/vagões forrageiros de campo para armazenar a programação de
> tratos e trazer de volta o realizado) — único caso do módulo com comunicação serial direta.
> Chama `[[spImportaTratosProducoes]]` (101 linhas, lida integralmente nesta sessão). Ver nota de
> método completa (limitação de DDL/tipos de coluna) em `[[ExportaDietas]]`, válida para todo o
> módulo.

---

**Status da implementação:** Legado — em produção (documentado via engenharia reversa, sem item de trabalho associado)

**Owner (curadoria):** @jefferson.arantes
**Tags:** #Pecuaria #Trato #Hardware #DataKey #Integracao #ComPort

---

## 0) Resumo executivo

- **O que é:** tela de sincronização com um **DataKey** (dispositivo de armazenamento portátil
  conectado a um "Docking Station" via porta serial RS-232) — usado por vagões misturadores/
  distribuidores de ração para: **Enviar** (`Tag=0`) a programação diária de Tratos do sistema
  para o DataKey (que é então levado fisicamente ao equipamento de campo, que lê a programação e
  distribui a ração); e **Receber** (`Tag=1`) os dados de execução real (peso efetivamente
  distribuído por Baia/Trato) de volta do DataKey para o sistema, atualizando `TratosPec.Qtd`
  (realizado) e gerando registros de `ProducaoRacoes`/`ItProdRacoes` (produção agregada por
  fórmula/dia).
- **Protocolo binário/texto proprietário sobre porta serial**: comandos de 1 caractere após ESC
  (`#27`) — `'D'`=consultar status, `'V'`=gravar cabeçalho de status, `'K'`=limpar, `'R'`=ler
  registros; linhas de dados delimitadas por caracteres de controle ASCII (`#30` início de
  registro, `#2`/`#3` STX/ETX, `#4` EOT, `#6` ACK) com **checksum XOR+AND(63)+OR(64)** de 1
  caractere ao final de cada linha — protocolo de baixo nível clássico de dispositivos de campo
  dos anos 1990-2000.
- **3 modos de ação** (`cbAcao`): "Atualização Completa" (grava no arquivo local E transfere para
  o DataKey/lê do DataKey E atualiza o sistema), "Gravar/Ler Somente Arquivo" (só o arquivo
  `.agm` local, sem tocar o hardware — útil para depuração ou transferência manual), e um 3º modo
  específico por direção ("Atualizar DataKey" no envio / "Atualizar Sistema" no recebimento).
- **Impacto principal:** escrita em porta serial (efeito físico no DataKey); `INSERT
  AutomacaoTratos` (dados brutos recebidos); `UPDATE TratosPec.Qtd`/`Hora` (realizado);
  `INSERT ProducaoRacoes`/`ItProdRacoes` (via `[[spImportaTratosProducoes]]`).

---

## 1) Conceito

| Termo | Definição |
|-------|-----------|
| Formato de linha de exportação é posicional de largura fixa (não CSV real) | O arquivo `.agm` exportado tem colunas de largura fixa nomeadas por convenção (`N6`=Caminhão 6 díg., `U`=flag 1 char, `G`, `T`, `B4`=código do Trato 4 díg., `L6`=Ração 6 char, `R6`=Baia-Ordem 6 char, `P6`=Qtd Programada 6 díg., `A6`=Qtd Ajuste(teste) 6 díg., `I8`=Total Previsto 8 díg., `C5`=Hora, `F`, `D8`=Data, `H6`=Sequencial do Trato, `E6`, `Z`, `M6`, `W6`, `m3`, `t3`) — o cabeçalho de nomes de coluna é escrito manualmente após a exportação (`S[0]:= 'N6     U G T B4 ...'`), sobrescrevendo a 1ª linha gerada pelo `ExportGrid4ToText`. |
| Quantidade Programada (`P6`) é recalculada no momento da exportação, não lida de `TratosPec.QtdProg` diretamente | A fórmula reaplica `%MS do Produto`/`fnCalcMSDieta` para converter a % da fórmula em peso a distribuir — mesma lógica de conversão MS↔MO já vista em `[[FormulasDietas]]`, recalculada aqui em vez de reaproveitar um valor já persistido (achado: risco de divergência se os parâmetros de %MS mudarem entre o momento da geração de `TratosPec` — via `[[spGeraLancTratosLCDiario]]` — e o momento desta exportação). |
| Recebimento filtra registros já "Atualizados pela Balança" (`'U'`) | `ReceivaDataKey`: ao ler o DataKey, ignora linhas cujo 8º caractere seja `'U'` — provável flag de registro que já foi processado/confirmado por outro sistema (balança), evitando reprocessamento. |
| Importação em 2 fases: staging (`AutomacaoTratos`) → consolidação (`[[spImportaTratosProducoes]]`) | `ImportarDados` primeiro grava cada linha recebida como um registro bruto em `AutomacaoTratos` (1 `CodAtualiz` por lote de importação, via `LoadSequencia`), depois aciona a procedure que agrupa por Fórmula/Data em `ProducaoRacoes` e atualiza o `Qtd` realizado de cada `TratosPec` — separação clássica de staging/ETL antes de consolidar no modelo definitivo. |

### 1.1 Arredondamento e sinal (auditoria 2026-09-02)

- **Exportação (`P6`/`A6`/`I8`) — arredondamento é feito no SQL, não no Delphi.** `ExportaDados`
  monta a consulta com `STR(<expressão>, 6, 0)` para `P6` (Qtd Programada recalculada por
  %MS), `STR(<expressão> + 1, 6, 0)` para `A6` no modo Teste, e `STR(T.QtdProg, 8, 0)` para
  `I8` (Total Previsto). A função T-SQL `STR(float_expression, length, decimal)` **arredonda**
  (não trunca) para o número de casas decimais pedido — aqui sempre `0` casas, i.e. arredonda
  para o inteiro mais próximo. Não há `RoundTo`/`SimpleRoundTo`/`Round`/`Trunc` do Delphi em
  nenhum ponto do fluxo de exportação; todo o arredondamento é delegado ao `STR()` do banco.
- **Sem tratamento de sinal/negativo.** Nenhum dos campos numéricos exportados
  (`T.QtdProg`, `P.Porcentagem`, resultado de `fnGetMSProdDietaFormula`/`fnCalcMSDieta`) passa
  por validação de valor negativo nesta tela — não há `BeforePost`/`OnValidate`/
  `OnEditValueChanged` aqui porque **a tela não tem nenhum campo numérico editável pelo
  usuário**: os valores vêm prontos de uma consulta SQL sobre dados já lançados em
  `[[TratosLC]]`/`TratosPec` (onde a validação de sinal, se existir, teria que ser auditada
  separadamente). `STR()` no SQL Server aceita e formata valores negativos normalmente (ex.:
  `STR(-5, 6, 0)` = `'    -5'`), então um `QtdProg` negativo — se existisse — seria exportado
  sem erro nem aviso.
- **Importação (`QtdProd`/`QtdRealizProd`) — sem arredondamento explícito, só truncamento
  implícito de precisão de campo.** `ImportarDados` faz `StrToFloat` direto do texto de largura
  fixa (colunas `P6`/`A6` do arquivo) para os campos `cdsAutomacaoTratos.QtdProd`/
  `QtdRealizProd`, que são `TFMTBCDField` com `Precision=18, Size=2` (2 casas decimais). Não há
  chamada explícita de arredondamento no código Delphi nesse trecho — qualquer perda de
  precisão é apenas o efeito colateral do `Size=2` do campo BCD ao gravar. Também não há
  validação de sinal aqui: `StrToFloat` aceita `-` se presente no texto de origem, e nada no
  código rejeita valor negativo.

---

## 2) Dicionário de campos da tela (`.dfm`)

### 2.1 Controles de comando (grupo "Porta Serial" / "Caminho" / "Ação" / topo)

| Controle | Classe | Rótulo/Caption | Vinculado a | Obrigatório | Observações |
|---|---|---|---|---|---|
| `cxGroupBox1` | `TcxGroupBox` | " Porta Serial " | — | — | Moldura/agrupador visual, sem lógica própria. |
| `cbPortas` | `TcxComboBox` | — | porta serial disponível (lida do Registro do Windows, `HKLM\HARDWARE\DEVICEMAP\SERIALCOMM`, `Properties.Sorted=True`) | Sim (implícito — sem porta selecionada não há conexão) | `ItemIndex:= 0` ao abrir a tela (1ª porta listada pré-selecionada); fica `Enabled:= False` enquanto a conexão está aberta (`cpComOpen`). |
| `cxGroupBox3` | `TcxGroupBox` | " Caminho " | — | — | Moldura/agrupador visual. |
| `beCaminho` | `TcxButtonEdit` | — | caminho do arquivo `.agm` | Sim (BR-002) | Botão de reticências (`bkEllipsis`, `Default=True`) e atalho `F2` (`ClickKey=113`) abrem `AbreSaveOpen`; nome padrão por `Tag` (`TS_Send.agm`/`TS_Rec.agm`/`TS_Teste.agm`). |
| `cxGroupBox6` | `TcxGroupBox` | " Ação " | — | — | Moldura/agrupador visual. |
| `cbAcao` | `TcxComboBox` | — | modo de operação | Sim (`ItemIndex:= 0` default) | `Properties.DropDownListStyle = lsFixedList` (não editável) — 3 opções montadas em tempo de execução por `FormShow` (ver seção 1), **sobrescrevendo** os 3 itens hard-coded no `.dfm` (`'ATUALIZAÇÃO COMPLETA'`, `'ATUALIZAR DATAKEY/SISTEMA'`, `'GRAVAR ARQUIVO'` — nunca chegam a ser exibidos ao usuário, pois `FormShow` faz `Clear` antes de recriar a lista). |
| `cxGroupBox2` | `TcxGroupBox` | (sem caption) | — | — | Agrupador dos botões de conexão/operação. |
| `btnAbrirFechar` | `TcxButton` | "Abrir"/"Fechar" (alterna) | — | — | Abre/fecha a conexão serial; ao abrir, consulta o status do DataKey automaticamente (`GetStatus`). Hint: "Abrir a Conexão com o Docking Station (DataKey)". |
| `btnOperacao` | `TcxButton` | "Enviar"/"Receber" (conforme `Tag`, setado em `FormShow`; caption `.dfm` "Enviar/Receber" é só placeholder de design) | — | — | Dispara `ExportaDados`/`ImportarDados` via `btnOperacaoClick`. |
| `btnLimpar` | `TcxButton` | "Limpar" | — | — | Limpa o DataKey (`ClearDataKey`). Hint: "Limpar todos os Dados do DataKey". |
| `cxGroupBox5` | `TcxGroupBox` | (sem caption) | — | — | Agrupador do LED. |
| `alLed` | `ThhALed` | — | indicador visual (vermelho=processando, verde=ocioso, apagado=fechado) | — | `LEDStyle = LEDLarge`, `Bordered = False`. Hint: "Atividade da Conexão". |
| `lblAguarde` | `TcxLabel` | "Aguarde..." | — | — | **`Visible = False` no `.dfm`** — só é tornado visível (`.Visible:= true`) durante o processamento em `btnOperacaoClick`/`btnLimparClick`/`cpComOpen`, junto com o LED vermelho, como indicador de progresso; fonte grande (`Height=-27`, `fsBold`), posicionado sobre o log. |

### 2.2 Log e debug

| Controle | Classe | Rótulo/Caption | Vinculado a | Obrigatório | Observações |
|---|---|---|---|---|---|
| `cxGroupBox13` | `TcxGroupBox` | " Log " | — | — | Moldura/agrupador visual, ocupa a maior parte da tela. |
| `mmLog` | `TcxMemo` | — | — | — | Log de toda a comunicação serial e das operações; `Properties.ReadOnly` alterna entre `True`/`False` conforme está ou não em processamento (fica gravável programaticamente só durante a operação). |
| `mmQuery` | `TcxMemo` | — | — | — | **`Visible = False` no `.dfm`** — painel de debug SQL, alternado por `F9` (`FormKeyDown`); mostra o texto da última consulta/`EXEC` disparada (`ExportaDados`/`ImportarDados`). |

### 2.3 Grid `gdExportar` (staging da exportação — grid oculto, nunca exibido ao usuário)

| Controle | Classe | Rótulo/Caption | Vinculado a | Obrigatório | Observações |
|---|---|---|---|---|---|
| `gdExportar` | `TcxGrid` | — | `dmConsulta.dsAux2`/`cdsAux2` (atribuído em `ExportaDados`) | — | **`Visible = False` no `.dfm`**, nunca é mostrado — existe só como fonte de dados intermediária para `ExportGrid4ToText` gravar o arquivo posicional `.agm`. Após a exportação, `dmConsulta.cdsAux2` é fechado e `DataSource` desvinculado (`ExportaDados`/`finally`). |
| `gdExportarLevel1` | `TcxGridLevel` | — | `gdExportarTabela` | — | Nível único do grid. |
| `gdExportarTabela` | `TcxGridDBTableView` | — | (colunas abaixo) | — | `OptionsView.ColumnAutoWidth = True`, `OptionsCustomize.ColumnFiltering = False`. |
| `gdExportarTabelaN6` | `TcxGridDBColumn` | "N6" | campo `N6` — `dbo.StrZero(LT.Caminhao, 6)` | — | Caminhão, 6 díg. zero-padded. |
| `gdExportarTabelaU` | `TcxGridDBColumn` | (sem caption própria) | campo `U` — literal `'U'` (ou `'S'` no modo Teste, `Tag=-1`) | — | Flag fixa de 1 caractere. |
| `gdExportarTabelaG` | `TcxGridDBColumn` | (sem caption) | campo `G` — literal `'I'` | — | Constante fixa. |
| `gdExportarTabelaT` | `TcxGridDBColumn` | (sem caption) | campo `T` — literal `'T'` | — | Constante fixa. |
| `gdExportarTabelaB4` | `TcxGridDBColumn` | "B4" | campo `B4` — `dbo.StrZero(RIGHT(T.Sequencial, 4), 4)` | — | Código do Trato, 4 díg. — comentário no código ("Albervan - [08/10/2011]") indica ajuste histórico; fórmula anterior (comentada) concatenava `T.Racao` + parte de `T.Sequencial`. |
| `gdExportarTabelaL6` | `TcxGridDBColumn` | "L6" | campo `L6` — `SUBSTRING(dbo.ElChar0(M.Mascara), 1, 6)` | — | Máscara/código do Produto/Ração, 6 char. |
| `gdExportarTabelaR6` | `TcxGridDBColumn` | "R6" | campo `R6` — `dbo.ElChar0(U.Codigo) + '-' + T.Ordem` | — | Baia-Ordem. |
| `gdExportarTabelaP6` | `TcxGridDBColumn` | "P6" | campo `P6` — `STR(<qtd recalculada por %MS>, 6, 0)` | — | Qtd Programada — ver seção 1.1 (arredondamento via `STR`, recalculada na exportação). |
| `gdExportarTabelaA6` | `TcxGridDBColumn` | "A6" | campo `A6` — `STR(<mesma fórmula de P6> + 1, 6, 0)` no modo Teste (`Tag=-1`), ou string vazia nos demais modos | — | Qtd de Ajuste/teste — só populada com valor real quando é o arquivo de Teste. |
| `gdExportarTabelaI8` | `TcxGridDBColumn` | "I8" | campo `I8` — `STR(T.QtdProg, 8, 0)` | — | Total Previsto (quantidade programada original, sem o recálculo de %MS aplicado a `P6`). |
| `gdExportarTabelaC5` | `TcxGridDBColumn` | "C5" | campo `C5` — hora atual formatada (`hh:MM`) no modo Teste, vazio nos demais | — | Hora. |
| `gdExportarTabelaF` | `TcxGridDBColumn` | (sem caption) | campo `F` — literal `'2'` | — | Constante fixa. |
| `gdExportarTabelaD8` | `TcxGridDBColumn` | "D8" | campo `D8` — data `dData` formatada (`dd-mm-yy`) no modo Teste, vazio nos demais | — | Data. |
| `gdExportarTabelaH6` | `TcxGridDBColumn` | "H6" | campo `H6` — `STR(T.Sequencial, 6, 0)` | — | Sequencial do Trato (`TratosPec.Sequencial`) — é este campo que a importação lê de volta como `SeqTrato` (ver 6.2). |
| `gdExportarTabelaE6` | `TcxGridDBColumn` | "E6" | campo `E6` — literal `STR(0, 6, 0)` | — | Sempre zero — campo reservado/não utilizado nesta versão. |
| `gdExportarTabelaZ` | `TcxGridDBColumn` | (sem caption) | campo `Z` — literal `'0'` | — | Constante fixa. |
| `gdExportarTabelaM6` | `TcxGridDBColumn` | "M6" | campo `M6` — literal vazio | — | Reservado, sempre vazio nesta versão. |
| `gdExportarTabelaW6` | `TcxGridDBColumn` | "W6" | campo `W6` — literal vazio | — | Reservado, sempre vazio. |
| `gdExportarTabelam3` | `TcxGridDBColumn` | "m3" | campo `m3` — literal `'000'` | — | Constante fixa. |
| `gdExportarTabelat3` | `TcxGridDBColumn` | "t3" | campo `t3` — literal `'000'` | — | Constante fixa. |

### 2.4 Componente de comunicação serial `cpCom` (`TComPort`, não visual)

| Propriedade | Valor | Observações |
|---|---|---|
| `BaudRate` | `br9600` | Fixo no `.dfm`, não configurável pela UI. |
| `Port` | `COM1` (default de design) | Sobrescrito em `btnAbrirFecharClick` pela porta escolhida em `cbPortas`. |
| `Parity` | Nenhuma (`prNone`) | — |
| `StopBits` | `sbTwoStopBits` (2 stop bits) | — |
| `DataBits` | `dbEight` | — |
| `FlowControl` | `OutCTSFlow=True`, `ControlRTS=rtsHandshake`, demais desabilitados | Handshake por hardware (CTS/RTS). |
| `Timeouts` | `WriteTotalMultiplier=100`, `WriteTotalConstant=1000`, leitura sem timeout fixo (`ReadTotalMultiplier=0`, `ReadTotalConstant=0`) | A leitura depende do laço manual em `ReadStrAll` (2 iterações de buffer vazio + `Sleep(2000)` cada, para considerar fim de transmissão) em vez de timeout do componente. |
| `SyncMethod` | `smThreadSync` | Eventos do componente sincronizados com a thread principal da UI. |
| `OnOpen`/`OnClose` | `cpComOpen`/`cpComClose` | Atualizam LED, caption do botão e habilitação de `cbPortas`. |

### 2.5 Datasets de staging (não visuais em tela, mas gravam `AutomacaoTratos`)

`cdsAutomacaoTratos` (`TClientDataSet`, via `dspAutomacaoTratos`/`sqlAutomacaoTratos`) é o dataset
usado por `ImportarDados` para gravar cada linha do arquivo `.agm` recebido como um registro de
staging. Campos do `FieldDefs` (todos usados no `Append`/`Post` de `ImportarDados`, exceto os
marcados): `CodAtualiz` (Integer, populado com `iCodAtualiz`/`LoadSequencia`), `Caminhao` (Integer —
**definido no `FieldDefs` do `.dfm` mas não populado em nenhum ponto do código**, `ImportarDados`
nunca atribui `FieldByName('Caminhao')`), `SeqLanc` (Integer — mesma situação, **definido mas não
populado**), `DescProd` (String, 10, `faFixed`, populado a partir da coluna `L6` do arquivo —
apesar do nome sugerir "descrição do produto", na prática recebe o mesmo código/máscara de 6
caracteres exportado em `L6`, não uma descrição textual), `BaiaTrato` (String, 10, `faFixed`,
populado a partir de `R6`), `QtdProd` (FMTBcd 18,2, de `P6`), `QtdRealizProd` (FMTBcd 18,2, de
`A6`), `TotalPrevisto` (Integer, de `I8`), `Hora` (String, 5, `faFixed`, de `C5`), `Data`
(TimeStamp, de `D8`), `SeqTrato` (Integer, de `H6`). **Achado:** `Caminhao` e `SeqLanc` existem
como campos do dataset/tabela mas `ImportarDados` não os grava — ficam com o valor default
(nulo/zero) em todo registro importado; `[[spImportaTratosProducoes]]` deve ser consultada para
saber se depende desses campos.

---

## 5) Jornada do usuário + Especificação funcional

### SP-01 — Abrir a tela (`FormShow`)
Lista portas seriais disponíveis (via Registro do Windows); monta opções de `cbAcao` conforme
`Tag` (Envio/Recebimento).

### SP-02 — Abrir/Fechar conexão serial (`btnAbrirFecharClick`) → `GetStatus`
Ao abrir, envia comando de status (`ESC D`) e decodifica a resposta (Estado/Versão/Registros/
Bytes livres); fecha automaticamente a conexão se nenhum DataKey for detectado.

### SP-03 — Operação principal (`btnOperacaoClick`)
Valida conexão aberta (quando necessário pelo modo) e DataKey presente; valida caminho do
arquivo; despacha para `ExportaDados` (envio) ou `ImportarDados` (recebimento), com indicador
visual de progresso (LED vermelho + "Aguarde").

### SP-04 — Exportar (`ExportaDados`)
Monta a consulta de Tratos do dia (formato posicional); exporta para `.agm`; se o modo inclui
transferência ao DataKey, envia linha a linha (`SendDataKey`) e verifica confirmação (`#6`);
atualiza o cabeçalho de status do DataKey (`SetStatus`).

### SP-05 — Receber (`ImportarDados`)
Se o modo inclui leitura do DataKey, chama `ReceivaDataKey` (lê e salva em arquivo); grava cada
linha do arquivo em `AutomacaoTratos` (staging); aciona `[[spImportaTratosProducoes]]` para
consolidar.

### SP-06 — Limpar DataKey (`btnLimparClick`/`ClearDataKey`)
Confirma se o estado não indica que os dados já foram processados; envia comando de limpeza
(`ESC K`) e reseta o cabeçalho de status.

### 5.3 Regras de negócio e validações

- **BR-001 — Conexão/DataKey obrigatórios conforme o modo escolhido.**
- **BR-002 — Caminho do arquivo obrigatório.**
- **BR-003 — Aviso ao tentar reimportar dados já processados** ("As Informações do DataKey já
  foram Atualizadas no Sistema... Deseja continuar assim mesmo?").
- **BR-004 — Aviso ao limpar DataKey com dados não confirmados como processados.**

---

## 6) Integrações e dados

### 6.1 Integrações (internas/externas)

- **`[[TratosLC]]`** ("Lançamento de Tratos") — **único chamador confirmado** desta tela; abre
  `AutomacaoTratos` via `Application.CreateForm`/`ShowModal` a partir do popup `pmArquivo`
  (itens "Arquivo de Envio", "Arquivo de Recebimento", "Arquivo Teste"), repassando `Retiro`,
  `Data`, `Lote`, `Funcionário`, `Caminhão` e `Dieta` como filtros da consulta de exportação. Ver
  nota de método no topo desta nota sobre o achado do `Tag` de "Arquivo Teste" nunca ser `-1`.
- **Hardware serial (DataKey/Docking Station)** — via `TComPort` (componente de 3ª parte).
- **`[[spImportaTratosProducoes]]`** (101 linhas, lida integralmente) — consolidação da
  produção.
- **`ExportGrid4ToText`** — exportação genérica de grid para texto posicional.

### 6.2 Modelo de dados

**Tabela `AutomacaoTratos`** (staging, campos confirmados via dataset `cdsAutomacaoTratos`/
`sqlAutomacaoTratos`): `CodAtualiz` (lote de importação, via `LoadSequencia`), `SeqTrato` (FK
`TratosPec.Sequencial`), `DescProd`, `BaiaTrato`, `QtdProd`, `QtdRealizProd`, `TotalPrevisto`,
`Hora`, `Data` — todos efetivamente gravados por `ImportarDados`. O `FieldDefs` do
`cdsAutomacaoTratos` também declara `Caminhao` e `SeqLanc` (Integer), mas nenhum dos dois é
populado pelo código Delphi (ver seção 2.5) — permanecem nulos/zero em todo registro gravado por
esta tela.

**Tabelas `ProducaoRacoes`/`ItProdRacoes`** (gravadas por `[[spImportaTratosProducoes]]`, PK via
`MAX(Sequencial)+1` — mesmo padrão de risco já visto em outras procedures do módulo).

### 6.3 Triggers e Procedures do banco

- **`[[spImportaTratosProducoes]]`**.

---

## 7) Suporte: FAQ, mensagens, erros e troubleshooting

### 7.2 Catálogo de mensagens e erros

| Mensagem exata | Causa |
|---|---|
| "Abra a conexão com o Docking Station (DataKey) primeiro." | Operação sem conexão serial aberta |
| "Conecte o DataKey no Docking Station." | Conexão aberta mas DataKey não detectado |
| "Selecione o Caminho do Arquivo de Transição." | Caminho não informado |
| "Deseja Limpar o DataKey primeiro?" | Confirmação antes de envio (se já houver registros) |
| "As Informações do DataKey já foram Atualizadas no Sistema. Deseja continuar assim mesmo?" | Reimportação |
| "As Informações do DataKey não foram Atualizadas Corretamente no Sistema. Deseja continuar assim mesmo?" | Limpeza sem confirmação de processamento |
| "Operação Concluída." / "Erro na Exportação dos Lançamentos." / "Erro na Importação dos Lançamentos." | Resultado das operações |
| "- Erro na Gravação dos Dados. Nem todos os Registros foram Gravados." / "- Erro na Linha N do Arquivo." | Falhas de transferência linha a linha |

---

## 9) Notas de revisão

- **2026-09-02** (auditoria de profundidade campo-a-campo, pós-achados do módulo Algodoeira)
  - **O que mudou:**
    - **Caminho de menu resolvido:** confirmado que `AutomacaoTratos` não é item de menu
      principal — é aberta exclusivamente por `[[TratosLC]]` (popup `pmArquivo`, itens Envio/
      Recebimento/Teste). Achado colateral: nem `miArqEnv` nem `miArqTeste`
      (`TratosLC.pas`/`.dfm`) têm `Tag` explícito — ambos usam o padrão `Tag=0`, então o item de
      menu "Arquivo Teste" hoje dispara o mesmo fluxo de "Arquivo de Envio" (`Tag=0`), e o ramo
      de código de `Tag=-1` ("modo Teste" — flag `'S'`, `TS_Teste.agm`, hora/data fictícias)
      parece inalcançável pela UI atual.
    - **Dicionário de campos (seção 2) refeito com granularidade total:** antes resumia o grid
      `gdExportar` em 1 linha ("colunas do formato posicional, ver Conceito"); agora lista as 20
      colunas (`N6`...`t3`) individualmente com a expressão SQL de origem de cada uma. Também
      passaram a constar: os agrupadores (`TcxGroupBox`) e seus captions, o campo oculto
      `lblAguarde` (`Visible=False`, indicador de progresso), o `mmQuery` oculto (debug SQL,
      toggle F9), a configuração completa do componente serial `cpCom` (baud rate, paridade,
      stop bits, flow control, timeouts) e os campos do `FieldDefs` de `cdsAutomacaoTratos` não
      documentados antes (`Caminhao`, `SeqLanc` — declarados mas nunca populados pelo código).
    - **Arredondamento e sinal (nova seção 1.1):** confirmado que a exportação usa `STR(expr, N,
      0)` do T-SQL (que arredonda, não trunca) para `P6`/`A6`/`I8` — não há `RoundTo`/`Round`/
      `Trunc` do Delphi nesse fluxo. Confirmado que não há validação de sinal/negativo em
      nenhum ponto (nem exportação nem importação), porque a tela não tem campo numérico
      editável pelo usuário — os valores vêm prontos de consulta SQL ou de texto de largura
      fixa lido do DataKey/arquivo.
    - Cross-references corrigidas: `[[TratosLC]]` e `[[spImportaTratosProducoes]]` já existem no
      vault — passaram a ser citadas como confirmadas (antes a nota só linkava
      `spImportaTratosProducoes` sem mencionar `TratosLC` como chamador).
  - **Impacto:** nenhum no sistema (documentação apenas). Nenhum achado desta auditoria é uma
    regressão nova — todos descrevem comportamento já existente no legado.
  - **Referências:** releitura completa de `Pecuaria/AutomacaoTratos.pas` (831 linhas) e `.dfm`
    (914 linhas) nesta sessão; `Pecuaria/TratosLC.pas` (trechos `miArqEnvClick`/`miArqRecClick`)
    e `TratosLC.dfm` (`pmArquivo`) para confirmar o chamador; `[[iniModuloPecuaria]]` para
    confirmar a ausência de item de menu direto.

- **2026-08-28** (criação da nota — módulo Pecuária)
  - **O que mudou:** nota criada do zero, a partir de leitura 100% literal de
    `Pecuaria/AutomacaoTratos.pas` (831 linhas) + `.dfm` (título confirmado "Automação de
    Tratos") + `[[spImportaTratosProducoes]]` (101 linhas, lida integralmente). Documentado o
    protocolo serial proprietário do DataKey (comandos ESC, checksum XOR+AND+OR), o formato de
    arquivo posicional, e o fluxo staging→consolidação da importação. Achado: `QtdProg`
    recalculada na exportação em vez de reaproveitar o valor persistido (risco de divergência).
  - **Impacto:** nenhum no sistema (documentação apenas).
  - **Referências:** código-fonte `Pecuaria/AutomacaoTratos.pas` + `.dfm`;
    `scripts/procedures/spImportaTratosProducoes.sql`; ver `[[spGeraLancTratosLCDiario]]`,
    `[[FormulasDietas]]`. Dúvida: item de menu não confirmado em `[[iniModuloPecuaria]]`.
