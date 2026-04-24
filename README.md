# 🐛 Debug Playground

Uma aplicação simples com telas e botões que geram problemas controlados para o pessoal investigar no DevTools.

Criada para o workshop:
> **"Debug prático no navegador para não devs: Network, Console e evidências"**

---

## 🚀 Como rodar localmente

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) no navegador.

---

## 🧪 Cenários de debug disponíveis

| # | Desafio | Onde olhar | Status |
|---|---------|------------|--------|
| 1 | Cadastro não salva | Network → Response | 500 |
| 2 | Campo obrigatório ignorado | Network → Payload + Response | 422 |
| 3 | Usuário foi deslogado | Network → Headers | 401 |
| 4 | Ação bloqueada pelo sistema | Network → Response | 403 |
| 5 | Tela quebra ao clicar | Console (não Network!) | TypeError |
| 6 | Sistema muito lento | Network → coluna Time | ~8 000 ms |
| 7 | Sessão inválida (cookie) | Application → Cookies | 401 |
| 8 | Dados estranhos salvos | Application → Local Storage | — |
| 9 | Aviso no console (não quebra) | Console → filtro Warnings | warning |

---

## 🛠 Stack

- **Frontend**: HTML + CSS + Vanilla JavaScript
- **Backend**: Node.js + Express
- **Banco de dados**: nenhum (respostas em memória / mock)

---

## 📁 Estrutura do projeto

```
├── server.js        ← Backend Express com os endpoints de erro
├── package.json
└── public/
    ├── index.html   ← Interface com os cards de desafio
    ├── style.css    ← Estilos
    └── app.js       ← Lógica dos cenários de bug
```
