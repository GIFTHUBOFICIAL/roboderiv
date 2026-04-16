# Deriv

Projeto estático de interface Bot R_75 para Deriv.

## O que já está pronto

- Estrutura estática baseada em `index.html`, `app.js`, `style.css` e `favicon.png`
- Depende apenas de `Chart.js` via CDN
- Pronto para deploy direto no Vercel como site estático

## Como publicar no GitHub

1. Crie o repositório no GitHub: `https://github.com/GIFTHUBOFICIAL/deriv`
2. No diretório do projeto:
   ```bash
   git add .
   git commit -m "Publicar projeto Deriv para deploy Vercel"
   git branch -M main
   git remote add origin https://github.com/GIFTHUBOFICIAL/deriv.git
   git push -u origin main
   ```
3. Confirme no GitHub que os arquivos foram enviados.

## Como conectar ao Vercel

1. Acesse seu dashboard Vercel em `https://vercel.com/`
2. Clique em **New Project** / **Import Project**
3. Conecte a conta GitHub se ainda não estiver conectada
4. Escolha o repositório `GIFTHUBOFICIAL/deriv`
5. Configure:
   - Framework Preset: `Other`
   - Build Command: deixe em branco
   - Output Directory: deixe em branco ou `/`
   - Root Directory: `/`
6. Clique em **Deploy**

## Configuração Vercel sugerida

Este projeto usa deploy estático. Um arquivo `vercel.json` já está incluído para garantir o uso de `@vercel/static`.

## Observações importantes

- O deploy é estático, então o app será servido diretamente pelo Vercel.
- Para usar na prática em contas reais, valide a conexão WebSocket e as credenciais da API Deriv.
- A garantia de resultados como "75% win" depende da lógica de trading e do ambiente de mercado. O deploy entrega a interface e o bot, mas não garante lucro automático.

## Deploy automático via GitHub Actions

O projeto agora inclui um workflow GitHub Actions em `.github/workflows/vercel-deploy.yml`.

Para ativar deploys automáticos, adicione estes secrets no repositório GitHub:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Depois de adicionar os secrets, cada push em `main` acionará deploy em produção no Vercel.
