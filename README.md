# Apex Hub

Aplicativo comunitário com interface gamer para Windows, Android e navegador.

## App desktop e Android

Requer Node.js 20 ou superior.

- Instale dependências: `npm install`.
- Gere a versão web: `npm run build:web`.
- Gere o instalador Windows: `npm run build:desktop`.
- Para Android: `npx cap add android`, depois `npm run build:android`; finalize o APK com Gradle/Android Studio.

## Backend (nova etapa)

O backend inicial usa Express, Socket.IO e SQLite:

- Cadastro e login com senha protegida por bcrypt e token JWT.
- Histórico de mensagens persistido no SQLite.
- Mensagens em tempo real por canal via Socket.IO.
- Eventos de sinalização WebRTC para preparar chamadas e compartilhamento de tela ponto a ponto.
- Helmet, CORS configurável e limite de tentativas de autenticação.

### Executar localmente

1. Copie `.env.example` para `.env` e defina um `JWT_SECRET` aleatório com pelo menos 32 caracteres.
2. Instale dependências com `npm install`.
3. Inicie com `npm run dev:server` ou `npm run start:server`.
4. Verifique `http://localhost:3000/health`.

**Importante:** esta etapa adiciona a infraestrutura do servidor, mas a interface do app ainda não está ligada ao login/socket. As chamadas e o compartilhamento de tela ainda precisam da interface WebRTC, HTTPS, servidor de sinalização publicado e testes entre dispositivos. O backend inicial não inclui autorização completa de servidores/canais, upload de arquivos nem criptografia ponta a ponta. Não use em produção sem revisão de segurança, backups e configuração de origem/domínio.

## Builds automáticos

O GitHub Actions está configurado para tentar gerar instalador Windows EXE e APK Android de depuração. Não considere esses arquivos prontos até uma execução terminar com sucesso e publicar os artefatos.
