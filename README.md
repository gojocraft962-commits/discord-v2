# Apex Hub

Apex Hub é um projeto de comunidade/chat com interface gamer para navegador, Android e Windows.

## Estado atual

- Interface responsiva com canais, lista de membros, pesquisa e chat.
- Prévia local que guarda mensagens no navegador.
- Backend inicial com cadastro/login, senhas protegidas com bcrypt, tokens JWT, histórico SQLite e mensagens em tempo real com Socket.IO.
- O frontend agora tem tela para configurar a URL da API, entrar e criar conta, e usa Socket.IO para sincronizar mensagens quando conectado.
- Sinalização WebRTC está preparada no backend, mas a interface de chamadas de voz/vídeo ainda não está pronta.

**Importante:** o backend ainda precisa ser publicado num servidor acessível pela internet. Sem isso, o chat continua em modo local no dispositivo. Não use dados reais até configurar HTTPS, segredo JWT forte e revisar a segurança.

## Executar localmente

Requer Node.js 20 ou superior.

1. Instale dependências: `npm install`.
2. Copie `.env.example` para `.env`.
3. Troque `JWT_SECRET` por uma chave aleatória forte (mínimo 32 caracteres).
4. Inicie o backend: `npm run dev:server`.
5. Abra `index.html` por um servidor local ou publique o frontend em HTTPS.
6. Na janela **Entrar**, informe a URL do backend (por exemplo, `http://localhost:3000` quando estiver no mesmo computador), crie uma conta e entre.

A API tem endpoint de verificação em `/health`. Para usar no celular, o backend precisa estar publicado ou acessível pela rede local; `localhost` no celular aponta para o próprio celular, não para o PC.

## Android e Windows

- Web: `npm run build:web`
- Windows EXE: `npm run build:desktop`
- Android: `npx cap add android` (uma vez), depois `npm run build:android`; finalize o APK com Gradle/Android Studio.

O workflow em `.github/workflows/build.yml` tenta gerar o instalador Windows e o APK Android de depuração em cada push na branch `main`. Os arquivos só estarão disponíveis em **Actions → execução → Artifacts** se a execução terminar com sucesso.

## Limitações conhecidas / próximas tarefas

1. Publicar o backend com armazenamento persistente e configurar a URL da API no app.
2. Completar criação de servidores, convites reais, canais e permissões por usuário.
3. Implementar chamadas de voz/vídeo e compartilhamento de tela com interface WebRTC.
4. Adicionar upload de imagens/arquivos, notificações e moderação.
5. Fazer testes de segurança, carga e builds em dispositivos reais antes de distribuir.

## Segurança

- Não coloque `.env`, tokens, senhas ou o banco SQLite no GitHub.
- Use HTTPS em produção e configure `CLIENT_ORIGIN` para as origens reais do frontend.
- Use um segredo JWT aleatório e mantenha backups do banco.
- A API ainda não implementa permissões completas por servidor/canal, recuperação de senha ou verificação de e-mail.
