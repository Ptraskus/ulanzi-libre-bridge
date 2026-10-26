# Ulanzi Glucose Bridge

[English — documentação completa](README.md) · [Relatar problema](https://github.com/Ptraskus/ulanzi-glucose-bridge/issues) · [Releases](https://github.com/Ptraskus/ulanzi-glucose-bridge/releases)

O Ulanzi Glucose Bridge é um aplicativo para Windows que exibe a glicemia e a tendência do seu Nightscout em um Ulanzi TC001 com AWTRIX. Ele consulta seu site Nightscout e envia as atualizações ao relógio pela rede local.

![Ulanzi TC001 exibindo 113 em números grandes e uma seta horizontal à direita](assets/ulanzi-tc001-display.jpeg)

## Recursos

- **Números grandes e seta de tendência.** No AWTRIX NG, os dígitos ocupam as oito linhas do visor. O AWTRIX 3 também é compatível, usando texto e símbolos de tendência.
- **Cores por faixa de glicemia.** As leituras mudam de cor conforme os limites configurados. Leituras indisponíveis ou antigas mostram **SEM DADO**.
- **Assistente de configuração e painel no Windows.** Conecte o Nightscout, encontre o relógio, teste as conexões e confira a última leitura. Há opções em inglês e português do Brasil, com leituras em **mg/dL** ou **mmol/L**.
- **Alertas sonoros e mostrador flutuante opcionais.** Configure alertas no relógio ou mantenha a leitura visível em uma pequena janela no computador.

**O computador precisa ficar ligado, sem suspender, conectado e com o aplicativo em execução para continuar enviando leituras ao relógio.** Fechar o painel mantém o aplicativo na bandeja do Windows.

**Windows 10 1809+ / Windows 11 · Node.js 22+ · [Licença MIT](LICENSE)**

Instale pelo ZIP do código-fonte seguindo o [passo a passo no Windows](#passo-a-passo-no-windows). Se houver algum problema, consulte [Privacidade e suporte](#privacidade-e-suporte).

> Este é um visor complementar, não um dispositivo médico. Continue usando os aplicativos oficiais e seus alarmes; não use o relógio como única referência para decisões de tratamento. Os limites iniciais são padrões do software, não recomendações clínicas.

## Antes de começar

| Você precisa de | Em palavras simples |
| --- | --- |
| Um computador Windows | Windows 10 versão 1809 ou mais recente, ou Windows 11. |
| Um Ulanzi TC001 com AWTRIX | AWTRIX é o software instalado dentro do relógio, também chamado de firmware. O software original da Ulanzi não é compatível. O assistente orienta o preparo se necessário. |
| Computador e relógio na mesma rede local | O TC001 recebe os dados pelo Wi-Fi. O computador pode usar Wi-Fi ou cabo, desde que consiga se comunicar com o relógio. |
| Nightscout já recebendo suas leituras | É o site que reúne os dados do seu sensor. Tenha o endereço do site e, se exigido, um token de acesso ou `API_SECRET` — a credencial usada para permitir a leitura. |

O caminho dos dados é: **sensor → Nightscout → aplicativo no Windows → relógio**. A conexão do sensor ao Nightscout precisa estar funcionando antes; este aplicativo cuida do trecho entre a fonte e o relógio. Ele não se conecta diretamente ao sensor nem pede a senha da conta do fabricante.

Se ainda não tem Nightscout, consulte o [guia de integração](GUIA-NIGHTSCOUT.md), em inglês. O aplicativo não cria um servidor Nightscout nem configura o envio de dados do sensor.

## Passo a passo no Windows

Para configurar pelo assistente, você não precisa programar, usar Git, digitar comandos ou executar `npm install`.

### 1. Instale o Node.js uma vez

O Node.js é o programa que permite executar este aplicativo. Baixe o **instalador para Windows da versão LTS, 22 ou mais recente**, pelo [site oficial do Node.js](https://nodejs.org/en/download). Abra o instalador e mantenha as opções padrão, incluindo **Add to PATH**. Se já tiver uma versão compatível instalada, pule esta etapa.

### 2. Baixe e extraia o aplicativo

1. Abra a [página do projeto no GitHub](https://github.com/Ptraskus/ulanzi-glucose-bridge).
2. Acima da lista de arquivos, clique no botão **Code** e depois em **Download ZIP**.
3. Na pasta Downloads do Windows, clique com o botão direito no ZIP e escolha **Extrair Tudo**.
4. Escolha uma pasta sua, como **Documentos**, e conclua a extração. Abra a pasta extraída até encontrar o arquivo `Start.cmd`.

Extraia a pasta inteira; o aplicativo precisa dos demais arquivos. Não abra `Start.cmd` de dentro do ZIP nem guarde o projeto em `Program Files`.

### 3. Abra o painel

Dê dois cliques em **`Start.cmd`**. Se o Windows esconder as extensões, ele pode aparecer apenas como **Start**. O aplicativo verifica o Node.js e abre o painel.

Na primeira abertura, clique em **Set up now** (Configurar agora). Selecione **Português (Brasil)** quando aparecer a escolha de idioma.

Caso o Windows bloqueie um script baixado, confira a procedência e o aviso. Não desative a proteção do sistema globalmente. Computadores gerenciados podem exigir suporte do administrador.

### 4. Siga as telas do assistente

| Etapa | O que fazer |
| --- | --- |
| Preparar o relógio | Se ele já mostra AWTRIX e está conectado ao Wi-Fi, marque essa opção. Caso contrário, siga os botões do assistente para instalar o AWTRIX e configurar o Wi-Fi. A instalação do firmware pode apagar a configuração anterior: faça backup antes e use um cabo USB de dados. |
| Escolher a fonte | Selecione **Nightscout** se esse é o site que já recebe as leituras do seu sensor. A opção JSON é para quem já tem uma integração própria. |
| Conectar a fonte | Informe o endereço principal do seu Nightscout, começando com `https://`, sem `/api/...` nem `?token=...`. Escolha a autenticação usada no seu site e preencha a credencial no campo separado. Em **Access token**, cole só o valor do token. Clique em **Testar Nightscout** antes de avançar. |
| Encontrar o TC001 | Clique em **Procurar**. Se ele não for encontrado, digite o endereço IP do relógio, no formato `http://192.168.1.50`. Esse endereço é apenas um exemplo: use o IP do seu TC001. Preencha usuário e senha HTTP somente se estiverem configurados no AWTRIX, depois clique em **Testar TC001**. |
| Escolher preferências | Selecione **mg/dL** ou **mmol/L** e revise os limites de cor. Os alarmes automáticos começam desligados. A estimativa de término do sensor também é opcional e começa desligada; só ative com a duração correta do modelo e eventos confiáveis de início. |
| Concluir | Confira o resumo e clique em **Salvar e ativar**. O aplicativo salva a configuração e inicia o envio das leituras. |

Os links **Onde encontro esta URL?**, **Como escolher e preencher?** e **Onde encontro o endereço?**, dentro do assistente, explicam os campos. Para preparar o relógio, ele abre a [ferramenta oficial do AWTRIX NG](https://blueforcer.github.io/awtrix-ng/getting-started/flashing/); nenhuma gravação de firmware começa automaticamente.

### 5. Confira o resultado

Com uma leitura atual e conexões funcionando, o relógio deve exibir **o valor da glicemia e a tendência**. No painel, confira a leitura e os estados da fonte e do relógio. Compare também o horário da leitura com o Nightscout: conseguir conectar não garante que o site esteja recebendo dados novos.

Se aparecer `SEM DADO`, confira a conexão e o horário da última leitura na fonte. Se quiser alertas sonoros, ative-os na área **Alertas** e faça o teste de som em **Suporte**, verificando o som no próprio relógio.

## Como usar no dia a dia

- **Para abrir:** dê dois cliques em `Start.cmd`.
- **Para deixar funcionando:** mantenha o computador ligado, sem suspender, conectado à fonte e ao TC001. Os dados chegam ao relógio pela rede; o USB serve para alimentação e, no preparo inicial, instalação do firmware.
- **Para fechar só o painel:** use o X da janela. O aplicativo continua na bandeja do Windows, a área de ícones perto do relógio do computador; o ícone pode estar dentro da seta de ícones ocultos.
- **Para parar o aplicativo:** use **Encerrar** no menu do ícone da bandeja.
- **Para mudar ajustes:** use o painel e clique em **Salvar e aplicar**. Para refazer a conexão, use **Conexões** ou abra `Configure.cmd`.

Após uma queda de energia ou de rede, deixe o aplicativo aberto: ele continua tentando reconectar. No AWTRIX NG, use o endereço real `http://<nome-do-relogio>.local` para não depender do IP atribuído pelo roteador. Se a resolução desse nome falhar, o aplicativo procura o mesmo nome e porta pela descoberta AWTRIX na rede local, confirma a identidade do dispositivo e recalcula a validade da leitura antes de enviar. Um IP informado diretamente ainda precisa de reserva no roteador para permanecer estável. A descoberta depende da comunicação UDP local; redes de convidados e firewalls podem bloqueá-la. A inicialização automática do Windows, quando habilitada, começa depois que você entra na sua conta.

## Compatibilidade com sensores

A compatibilidade depende dos dados que chegam ao Nightscout. O aplicativo lê glicemia, horário e tendência pela API padrão, independentemente da marca do sensor. Seu uploader — o programa que envia as leituras — ou integração já precisa estar fornecendo dados atuais e válidos ao Nightscout. Nem todas as combinações de sensor e uploader foram testadas com este projeto.

Consulte o [guia de conexão](GUIA-NIGHTSCOUT.md) e a [documentação de uploaders do Nightscout](https://nightscout.github.io/uploader/setup/) para preparar essa integração. O aplicativo também aceita uma fonte JSON própria, no formato descrito no [README em inglês](README.md#sources-and-reading-states).

## Idioma, unidade e preferências

O idioma padrão é inglês. Você pode escolher **English** ou **Português (Brasil)** no assistente ou pelo botão **Language / Idioma**, na parte inferior do painel, que abre as preferências de tela. A unidade é independente do idioma: **mg/dL** ou **mmol/L**.

A leitura em mg/dL usa inteiros; mmol/L usa uma casa decimal. **Os limites visuais e de alarme continuam explicitamente em mg/dL**, mesmo com leituras em mmol/L. Trocar a unidade não converte nem arredonda seus limites. A entrada JSON `valueMgDl` e variáveis terminadas em `_MGDL` também permanecem em mg/dL.

| Padrão | Valor inicial |
| --- | --- |
| Idioma | Inglês. |
| Unidade da leitura | mg/dL. |
| Consulta da fonte | A cada 60 segundos. |
| Validade máxima da leitura | 15 minutos. |
| Limites visuais | 70 e 180 mg/dL, configuráveis. |
| Alarmes automáticos e avisos de contingência | Desligados. |
| Estimativa de fim do sensor | Desligada (`SENSOR_LIFETIME_DAYS=0`). Duração opcional conforme seu modelo, até 365 dias, aceitando frações de dia. |

O painel reúne Início, Alertas, Tela e sensor, Conexões e Suporte. **Salvar e aplicar** valida e grava as alterações; até três configurações válidas são preservadas para recuperação. Para mudar endereços ou credenciais, refaça a configuração por Conexões.

`SEM DADO` indica leitura indisponível ou vencida. A estimativa opcional `TROCAR` depende de um evento `Sensor Start`/`Sensor Change` no Nightscout e da duração que você configurar. Ela não representa um aviso de término enviado pelo próprio sensor. Sem esse evento, a glicemia continua funcionando, mas não há estimativa de término. Com a opção desligada, a ponte nem consulta esses eventos. Uma leitura baixa ou alta ainda válida tem prioridade sobre `TROCAR`, que não dispara o som de falta de dados. Os alarmes são opcionais, e os limites de som são independentes das cores. Confirme fisicamente os LEDs e o buzzer nos testes.

Veja a referência completa em [.env.example](.env.example) e no [README em inglês](README.md). Para uso normal, prefira o assistente em vez de editar os arquivos.

## Atualização do nome anterior

A versão 0.3.0 passa de Ulanzi Libre Bridge para **Ulanzi Glucose Bridge**. Configurações, credenciais protegidas, histórico e durações explicitamente configuradas continuam compatíveis. A chave antiga `LIBRE_SENSOR_LIFETIME_DAYS` é aceita como alternativa; `SENSOR_LIFETIME_DAYS` tem prioridade quando definida. Alterações na duração são gravadas na chave genérica; salvar sem alterações preserva o documento existente. Novas configurações começam com a estimativa de término desligada.

Instalações e preferências existentes podem manter a pasta anterior para preservar os dados. Não apague essas pastas por causa da mudança de nome. Encerre a cópia em execução antes de atualizar ou abrir de outra pasta.

## Privacidade e suporte

Não há telemetria, anúncios, conta própria ou servidor do projeto. Credenciais ficam protegidas pelo DPAPI do Windows; `.env`, `.secrets/`, `.runtime/`, `.config-history/` e `.updates/` são locais e não entram no pacote público. Não compartilhe esses arquivos. Ao mudar de computador ou de usuário Windows, refaça a configuração das credenciais.

O TC001 usa HTTP local; mantenha-o em uma rede confiável, sem expor sua API à internet. Veja [segurança do AWTRIX](GUIA-SEGURANCA-AWTRIX.md), [privacidade](PRIVACY.md) e [segurança do projeto](SECURITY.md), em inglês.

| Problema | O que conferir |
| --- | --- |
| Node.js ausente ou antigo | Instale a versão LTS 22+ e abra Start novamente. |
| Configuração pendente | Conclua o assistente; a ponte fica parada até a validação. |
| Start não abre outra cópia | Apenas uma cópia roda por usuário Windows. Use o ícone existente na bandeja e encerre antes de abrir de outra pasta. |
| TC001 sem resposta | Firmware AWTRIX, endereço, credenciais, firewall e rede local. |
| SEM DADO | Horário real da leitura na fonte, conexão e validade configurada. |
| Sem som | Controle geral dos alarmes, buzzer e teste físico em Suporte. |
| Atualizações indisponíveis | O canal assinado ainda precisa ser configurado pelo distribuidor. |

Revise relatórios exportados antes de anexá-los a uma issue. Vulnerabilidades devem ser relatadas pelo [canal privado](https://github.com/Ptraskus/ulanzi-glucose-bridge/security/advisories/new), sem publicar dados pessoais.

Para desenvolvimento, execute `npm.cmd run check` e `npm.cmd test` no Windows. Testes automatizados não substituem a validação física no TC001. As instruções de empacotamento e assinatura estão em [PUBLICACAO.md](PUBLICACAO.md), em inglês.

## Opções adicionais

<details>
<summary>Demonstração sem conta ou relógio (opcional, pelo PowerShell)</summary>

Abra o PowerShell na pasta extraída:

```powershell
npm.cmd run demo
```

O comando simula **112 mg/dL**, imprime o resultado e encerra. Não consulta fonte real, não envia ao relógio nem cria credenciais. A demonstração é no terminal; o assistente gráfico completo exige TC001 para os testes do dispositivo. Preferências existentes no `.env` podem afetar a apresentação, mas a fonte continua simulada e o envio fica desativado.

</details>

<details>
<summary>Instalador e pacotes futuros</summary>

Quando houver instalador assinado nos Releases, verifique o publicador e os checksums antes de instalar. Um ZIP com `portable-node` no nome inclui o Node.js; basta extraí-lo completamente e abrir `Start.cmd`. O ZIP do código-fonte do GitHub **não inclui** o Node.js. Os pacotes com Node.js incluído são para Windows x64.

O runtime do pacote inclui `node.exe` e sua licença, sem npm. Para a demonstração nesse pacote, use `.\runtime\node\node.exe .\src\index.mjs --source=mock --once --dry-run` no PowerShell.

O instalador oferece inglês ou português e atalhos opcionais na área de trabalho e na inicialização do Windows. Instala apenas para o usuário atual. A desinstalação preserva os dados locais por padrão. Um instalador gerado para testes internos não equivale a uma distribuição pública assinada.

</details>

<details>
<summary>Comandos antigos e configuração direta</summary>

`Configure.cmd` abre diretamente o assistente. Os comandos antigos `configurar.cmd` e `iniciar.cmd` continuam funcionando; `iniciar.cmd` executa a ponte em um terminal visível, sem abrir o painel. Para o uso normal com janelas, abra `Start.cmd`.

</details>
