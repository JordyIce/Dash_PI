# 📊 Dashboard Operação Piauí — Contrato LPT

Dashboard que puxa dados ao vivo da planilha Google Sheets e atualiza automaticamente a cada 5 minutos.

---

## 🚀 PASSO A PASSO PARA SUBIR NO VERCEL

### PASSO 1 — Configurar a Planilha Google

A planilha precisa estar compartilhada publicamente (somente leitura):
1. Abra sua planilha no Google Sheets
2. Clique em **Compartilhar** (canto superior direito)
3. Em "Acesso geral", mude para **"Qualquer pessoa com o link"**
4. Deixe como **"Leitor"**
5. Clique em **Concluído**

> ⚠️ Sem esse passo, o dashboard não consegue ler os dados!

---

### PASSO 2 — Criar conta no GitHub (se não tiver)

1. Acesse [github.com](https://github.com) e crie uma conta gratuita

---

### PASSO 3 — Subir o código pro GitHub

**Opção A — Pelo site (mais fácil):**
1. No GitHub, clique em **"+"** → **"New repository"**
2. Nome: `dashboard-operacao-piaui`
3. Deixe **Public**, clique **Create repository**
4. Clique em **"uploading an existing file"**
5. Arraste TODOS os arquivos desta pasta (descompactada) para lá
6. Clique **Commit changes**

**Opção B — Pelo terminal (se souber usar Git):**
```bash
cd dashboard-operacao-piaui
git init
git add .
git commit -m "Dashboard inicial"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/dashboard-operacao-piaui.git
git push -u origin main
```

---

### PASSO 4 — Deploy no Vercel

1. Acesse [vercel.com](https://vercel.com) e faça login com sua conta GitHub
2. Clique em **"Add New..."** → **"Project"**
3. Encontre o repositório `dashboard-operacao-piaui` e clique **"Import"**
4. NÃO precisa mexer em nada nas configurações — o Vercel detecta tudo sozinho
5. Clique em **"Deploy"**
6. Aguarde ~1 minuto... PRONTO! 🎉

O Vercel vai te dar um link tipo: `https://dashboard-operacao-piaui.vercel.app`

---

## 🔄 COMO FUNCIONA A ATUALIZAÇÃO AUTOMÁTICA

- O dashboard busca dados da planilha Google Sheets a cada **5 minutos**
- Quando você atualiza a planilha, o dashboard reflete em até 5 minutos
- A API do Vercel tem cache de 5 minutos (configurável no arquivo `api/data.js`)
- Também tem o botão 🔄 no dashboard para forçar atualização manual

### Para mudar o intervalo de atualização:

No arquivo `api/data.js`, linha 6:
```js
res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
//                                        ^^^ 300 = 5 minutos. Mude para 60 = 1 minuto
```

No arquivo `src/App.jsx`, procure por:
```js
const iv = setInterval(load, 5 * 60 * 1000);
//                           ^ mude o 5 para quantos minutos quiser
```

---

## 📁 ESTRUTURA DO PROJETO

```
dashboard-operacao-piaui/
├── api/
│   └── data.js          ← Serverless function (busca dados do Google Sheets)
├── src/
│   ├── main.jsx         ← Entrada do React
│   └── App.jsx          ← Dashboard completo
├── index.html           ← HTML base
├── package.json         ← Dependências
├── vite.config.js       ← Config do Vite
├── vercel.json          ← Config do Vercel
└── README.md            ← Este arquivo
```

---

## ⚙️ SE QUISER MUDAR A PLANILHA

No arquivo `api/data.js`, linhas 8-9, altere:
```js
const SHEET_ID = '15ng_u54tlEbOeMda59QQX3KEMCrYxqudXJqyYvFhGGE';  // ← ID da planilha
const GID = '1423777639';  // ← ID da aba (gid na URL)
```

O ID da planilha fica na URL:
`https://docs.google.com/spreadsheets/d/ESSE_AQUI_É_O_ID/edit?gid=ESSE_É_O_GID`

---

## 🧪 TESTAR LOCALMENTE (opcional)

```bash
npm install
npm run dev
```
> Nota: A rota `/api/data` só funciona no Vercel. Para testar local,
> use `vercel dev` (instale com `npm i -g vercel`).
