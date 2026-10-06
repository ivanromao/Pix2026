# Sala do AAR no Cloudflare: como publicar

A sala é um site com senha, hospedado de graça no Cloudflare, com banco de dados. Os devs entram pelo navegador, sem conta em lugar nenhum. O que cada pessoa escreve, edita, vota ou arrasta aparece na tela de todos em cerca de 1 segundo.

Tudo o que aparece na sala é cifrado no seu navegador antes de sair da sua máquina:
- o conteúdo do 3T;
- o que o time escreve;
- os votos.

O servidor guarda só texto embaralhado. Sem a senha do time, ninguém lê, nem o Cloudflare.

Você precisa de dois arquivos:

| Arquivo | O que é | Onde fica |
|---|---|---|
| `worker.js` | O código da sala. Não tem nenhum dado do time. | Vai para o Cloudflare |
| `conteudo-aar-squad-delta-3t26.json` | O conteúdo do 3T (BEs, métricas, nomes) | Só na sua máquina. Entra na sala já cifrado |

O caminho todo leva uns 15 minutos.

## 1. Criar a conta (grátis, sem cartão)

1. Acesse https://dash.cloudflare.com/sign-up e crie a conta com seu e-mail.
2. Confirme o e-mail.
3. Se o painel pedir para escolher um plano ou adicionar um site, pule essa parte. Você não precisa de domínio.

## 2. Criar o banco de dados

1. No menu lateral, abra **Storage & Databases** e depois **D1 SQL Database**.
2. Clique em **Create** (Criar).
3. Dê o nome `aar` e confirme.

As tabelas são criadas sozinhas no primeiro acesso.

## 3. Criar o Worker e colar o código

1. No menu lateral, abra **Workers & Pages** e clique em **Create** (Criar).
2. Escolha **Start with Hello World!** (Começar com Hello World).
3. Dê um nome discreto, por exemplo `sala-aar-7k2`, e clique em **Deploy**.
4. Na página do Worker, clique em **Edit code** (Editar código).
5. Apague todo o conteúdo do arquivo `worker.js` que aparece no editor.
6. Cole o conteúdo do `worker.js` que você recebeu e clique em **Deploy**.

O endereço da sala fica parecido com `https://sala-aar-7k2.seu-subdominio.workers.dev`.

## 4. Ligar o banco ao Worker

1. Na página do Worker, abra a aba **Bindings**. Em alguns painéis ela fica em **Settings** e depois **Bindings**.
2. Clique em **Add binding** e escolha **D1 database**.
3. Em **Variable name**, escreva `DB`, assim mesmo, em maiúsculas.
4. Escolha o banco `aar` e salve (**Deploy** ou **Save**).

Se a sala mostrar "Banco não configurado", é este passo que faltou.

## 5. Preparar a sala

Faça isto logo depois de publicar, para ninguém chegar antes de você.

1. Abra o endereço do Worker.
2. Clique em **Preparar a sala**.
3. Escolha o arquivo `conteudo-aar-squad-delta-3t26.json`.
4. Defina as duas credenciais:
   - **Senha do time:** você passa para os devs na hora. Tem pelo menos 10 caracteres. Três palavras soltas com um número funcionam bem.
   - **Código do mediador:** só seu. Tem pelo menos 8 caracteres e precisa ser diferente da senha do time.
5. Clique em **Cifrar e criar a sala**.
6. Entre com a senha do time, marque **Sou o mediador** e digite o código. O painel dourado do QG aparece.

Guarde as duas senhas. Elas não ficam salvas em lugar nenhum. Se esquecer o código do mediador, apague o banco e o Worker e refaça os passos 2 a 5.

## 6. Testar na véspera

1. Abra o link num notebook de dev, dentro da rede do banco, para confirmar que não está bloqueado.
2. Entre como dev numa aba anônima e como mediador em outra, e avance uma parada pelo QG para ver a outra aba acompanhar.
3. Se quiser zerar o teste, use **Preparar ou recriar a sala** com o seu código atual. Isso apaga tudo o que foi escrito. Pode até trocar a senha nessa hora.

## 7. No dia

1. Mande o link e a senha do time no chat da call, só na hora de começar. Nunca por e-mail.
2. Ao compartilhar a sua tela, recolha o QG clicando no título dele.
3. Siga o roteiro de fala. Cada passo do QG está escrito lá.

## 8. Depois da cerimônia

1. No QG, baixe a **Planilha para o Jira (CSV)** e o **Resultado completo (JSON)**.
2. Clique em **Apagar todos os dados da sala**.
3. Se não for usar de novo, apague também o Worker e o banco `aar` no painel do Cloudflare.

## Limites do plano grátis

O plano grátis do Cloudflare dá 100 mil acessos por dia. A sala sincroniza a cada segundo durante a cerimônia: 35 minutos com 15 pessoas usam em torno de 40 mil. Fora da cerimônia, ou com a aba em segundo plano, ela consulta bem menos.

A cota zera todo dia às 21h de Brasília. Evite fazer um ensaio pesado no mesmo dia da cerimônia.

## O que o servidor enxerga

| Enxerga | Não enxerga |
|---|---|
| Que existe uma sala e quantos navegadores estão conectados | Nenhum nome, fato, voto, palavra ou compromisso |
| Blocos de texto cifrado e a hora em que chegaram | O conteúdo do 3T |
| Um resumo (hash) da senha, usado só para conferir o acesso | A senha em si |

Depois de 30 tentativas de senha erradas em 10 minutos, aquele endereço de rede fica bloqueado por alguns minutos.

## Alternativa por linha de comando

Se você tiver Node.js instalado:

```
npx wrangler login
npx wrangler d1 create aar
```

Depois copie o `database_id` que aparecer para o `wrangler.toml` e rode:

```
npx wrangler deploy
```

O `wrangler.toml` está na mesma pasta do `worker.js`.
