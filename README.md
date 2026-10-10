# React + TypeScript + Vite

## Acesso com Supabase

1. Crie um projeto no Supabase e habilite o provedor **Email** em Authentication.
2. Copie `.env.example` para `.env`.
3. Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com os valores de Project Settings > API.
4. No Vercel, cadastre as mesmas variáveis em Project Settings > Environment Variables.

O aplicativo oferece cadastro, login persistente e encerramento de sessão. Se a confirmação de e-mail estiver habilitada no Supabase, o usuário precisará confirmar o cadastro antes do primeiro acesso.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Coletor automático de ofertas pelo WhatsApp

O projeto inclui um coletor local para baixar e importar promoções recebidas pelo WhatsApp.

1. Crie o arquivo `.env` com `GEMINI_API_KEY=sua_chave`.
2. Inicie o app com `npm run dev`.
3. Em outro terminal, inicie o coletor com `npm run bot`.
4. Configure `OWNER_WHATSAPP_NUMBER` no arquivo privado `.env.local`, somente com
   os números incluindo DDD, e escaneie o QR Code do WhatsApp correspondente.

No Windows, execute uma vez `CRIAR_ATALHO_WHATSAPP.ps1` para criar na Area de Trabalho o atalho **Radar de Precos - Iniciar WhatsApp**. Ele inicia o coletor local e abre o app publicado em `https://docprecos.vercel.app/`.

No Linux, execute uma vez `./CRIAR_ATALHO_WHATSAPP_LINUX.sh` na pasta do projeto. O atalho **Radar de Preços - Iniciar WhatsApp** será criado na Área de Trabalho. Em algumas distribuições, é preciso clicar com o botão direito no atalho e escolher **Permitir iniciar** na primeira vez.

Tambem existem comandos auxiliares na raiz do projeto:

- `INICIAR_APP_E_BOT.cmd`: abre o app, inicia o coletor automatico e abre o navegador.
- `GERAR_QR_CODE_WHATSAPP.cmd`: reinicia a sessao do WhatsApp e mostra um QR Code novo.
- `CRIAR_ATALHO_WHATSAPP.ps1`: cria o atalho principal na Area de Trabalho.
- `CRIAR_ATALHO_WHATSAPP_LINUX.sh`: cria o atalho principal na Área de Trabalho no Linux.

O coletor monitora automaticamente ofertas enviadas pelos contatos:

- AMIGAO: `14996230389` / `14920059637`
- SAGRADA FAMILIA: `14998290971` / `14996633969` / `14996311107`
- MAX: `14991297822` / `41920001902`
- SAO JUDAS: `11956397896` / `14996695703`
- ATACADAO: `14997445160`
- BOM JESUS: `14997782966`

### Relatórios automáticos

Enquanto o coletor estiver ligado e conectado ao WhatsApp, ele gera o relatório
**Melhores preços por mercado** usando a lista de compras salva e envia o PDF
para o número privado configurado em `OWNER_WHATSAPP_NUMBER` diariamente às
**09:00**, **15:00** e **18:00**, no fuso
`America/Sao_Paulo`.

Para testar imediatamente, com o coletor em execução, envie uma requisição
`POST` para `http://localhost:3001/api/reports/send-now`. Os PDFs gerados e o
histórico que impede envios duplicados ficam em `outputs/relatorios-automaticos`.

Quando algum desses contatos enviar PDF ou imagem de promoção, o coletor salva o arquivo em `ENTRADA_OFERTAS\WhatsApp`, extrai os produtos com IA e envia as ofertas para a tela "Importar Ofertas" do Radar de Preços.

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
