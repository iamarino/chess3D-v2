# Deploy na VPS (infraestrutura compartilhada Juno)

Este app segue o mesmo padrão de infraestrutura compartilhada descrito em
`JUNO_INFRASTRUCTURE.md` do repositório `psicologia` (rede `juno-network`,
Nginx compartilhado, uma stack Compose por app, sem portas publicadas no
host). Este documento cobre só o que é específico do `chess3D-v2`.

Diferente do `psicologia`, este app não tem frontend/backend separados nem
banco de dados: é um único processo Node (`server.js`) que serve o Next.js
*e* o relay de WebSocket do multiplayer (rota `/ws`) na mesma porta.

---

## 1. Primeira vez subindo este app na VPS

```bash
git clone <repo> /opt/juno/apps/chess3d
cd /opt/juno/apps/chess3d
cp .env.example .env   # ajuste APP_NAME/PORT se necessário, valores padrão já servem
docker network inspect juno-network --format '{{range .Containers}}{{.Name}} {{end}}'  # confirma que juno-nginx está na rede
docker compose up -d --build
docker logs chess3d-app --tail=50   # deve mostrar "> Ready on http://localhost:3000 (WebSocket relay on /ws)"
```

## 2. Rotear no Nginx compartilhado

Adicione em `conf.d/default.conf` (sem domínio próprio ainda) ou em
`conf.d/apps/chess3d.conf` (quando houver domínio). O `/ws` precisa dos
cabeçalhos de upgrade — sem eles o multiplayer online não conecta:

```nginx
location /ws {
    proxy_pass http://chess3d-app:3000/ws;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location / {
    proxy_pass http://chess3d-app:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Depois de editar:

```bash
docker exec juno-nginx nginx -t
docker exec juno-nginx nginx -s reload
```

Testar de fora: `curl http://<ip-ou-dominio>/` (deve retornar o HTML da
página) e conferir no navegador que uma partida online consegue criar/entrar
em sala (usa o WebSocket em `/ws`).

## 3. Atualizar para uma nova versão

```bash
cd /opt/juno/apps/chess3d
git pull
docker compose up -d --build
docker logs chess3d-app --tail=50
```

## 4. Notas

- O cliente resolve a URL do WebSocket a partir de `window.location.host`
  (`src/network/NetworkManager.ts`), então nenhuma variável de ambiente
  aponta para um domínio/porta fixos — o roteamento do Nginx acima é
  suficiente.
- Sem banco de dados: não é preciso criar usuário/schema no `juno-mysql`
  para este app.
- O build do Next.js usa modo custom server (`server.js`), não o modo
  `standalone` — por isso a imagem final roda `npm ci --omit=dev` em vez de
  copiar um bundle standalone (ver comentário no topo do `Dockerfile`).

## Nginx: resolver por requisição (alteração de 15/10/2026)

Motivo: o `nginx -s reload` testa todos os `.conf` juntos. Com `proxy_pass http://<container>:porta` fixo, basta **um** app
parado (container inexistente na rede) para o reload falhar com `host not found in upstream` e todos os outros apps
darem 502 (IP antigo do container). Foi o que aconteceu no deploy do marcenariacnc.

Ao (re)criar o `.conf` deste app na VPS, usar este formato. Dentro do `server { listen 443 ssl; ... }`:

```nginx
    # DNS interno do Docker: o nome é resolvido a cada requisição; app parado só dá 502 nele mesmo.
    resolver 127.0.0.11 valid=10s ipv6=off;

```nginx
    location /ws { set $up_app http://chess3d-app:3000; proxy_pass $up_app; ... }   # /ws chega igual
    location /   { set $up_app http://chess3d-app:3000; proxy_pass $up_app; ... }
```
(No servidor o container se chama `xadrez-app` e o `.conf` está em `conf.d/xadrez.conf`, fora de `apps/`.)
Com variável no `proxy_pass` o Nginx **não troca mais o prefixo da URL** sozinho: a URL original vai inteira ao backend
(o `rewrite` abaixo é só para o caso em que o prefixo precisa ser tirado). Testar com `nginx -t` antes do reload.
Cópia pronta dos `.conf` e script de aplicação: ver o histórico do projeto cnc (commit "Nginx: resolver por requisição").
