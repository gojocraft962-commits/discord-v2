# Apex Hub

Aplicativo comunitário com interface gamer para Windows e Android.

## Desenvolvimento

Requer Node.js 20 ou superior.

- Instale dependências com npm install.
- Gere a web app com npm run build:web.
- Gere o instalador Windows com npm run build:desktop.
- Para Android, execute npx cap add android e npx cap sync android; depois abra android no Android Studio ou rode o Gradle assembleDebug.

## Estado desta primeira etapa

Esta versão inicial oferece interface responsiva, navegação de canais, mensagens locais salvas no dispositivo, filtro de canais e solicitação de permissão do microfone. As mensagens ainda não sincronizam entre usuários. Chat multiusuário, contas, chamadas de voz/vídeo e compartilhamento de tela exigem backend, autenticação, sinalização WebRTC e configuração HTTPS. Não há criptografia ponta a ponta implementada.

## Builds automáticos

O GitHub Actions tenta gerar um instalador Windows EXE e um APK Android de depuração a cada push em main. O APK de depuração não é assinado para publicação.
