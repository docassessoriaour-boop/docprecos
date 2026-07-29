# React + TypeScript + Vite

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
4. Escaneie o QR Code com o WhatsApp do número `14988359798`.

Tambem existem atalhos prontos na raiz do projeto:

- `INICIAR_APP_E_BOT.cmd`: abre o app, inicia o coletor automatico e abre o navegador.
- `GERAR_QR_CODE_WHATSAPP.cmd`: reinicia a sessao do WhatsApp e mostra um QR Code novo.
- `CRIAR_ATALHOS_AREA_DE_TRABALHO.ps1`: cria os dois atalhos acima na Area de Trabalho.

O coletor monitora automaticamente ofertas enviadas pelos contatos:

- AMIGAO: `14996230389` / `14920059637`
- SAGRADA FAMILIA: `14998290971` / `14996633969` / `14996311107`
- MAX: `14991297822` / `41920001902`
- SAO JUDAS: `11956397896` / `14996695703`
- ATACADAO: `14997445160`
- BOM JESUS: `14997782966`

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
