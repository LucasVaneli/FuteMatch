# Sorteio de Duplas — Futevôlei

Aplicação web simples para sortear 4 duplas de futevôlei a partir de:

- 4 jogadores de esquerda;
- 4 jogadores de direita.

Cada dupla é obrigatoriamente formada por **1 jogador de esquerda + 1 jogador de direita**.

## Arquitetura

O projeto foi separado por responsabilidade:

```text
futevolei-sorteio/
├── index.html
├── package.json
├── README.md
├── src/
│   ├── css/
│   │   └── styles.css
│   └── js/
│       ├── app.js
│       ├── domain/
│       │   └── Player.js
│       ├── services/
│       │   └── DrawService.js
│       └── ui/
│           └── DrawView.js
└── tests/
    └── DrawService.test.js
```

### Responsabilidades

- `Player.js`: entidade e regras básicas do jogador.
- `DrawService.js`: regra de negócio do sorteio.
- `DrawView.js`: atualização da interface.
- `app.js`: orquestra eventos da tela e integra domínio, serviço e view.
- `styles.css`: identidade visual e responsividade.

## Como executar

Como o projeto usa JavaScript Modules, abra-o por um servidor HTTP local.

### Opção 1 — VS Code

Use a extensão **Live Server** e abra o `index.html`.

### Opção 2 — Python

Dentro da pasta do projeto:

```bash
python -m http.server 5500
```

Depois acesse:

```text
http://localhost:5500
```

## Testes

É necessário ter Node.js instalado.

```bash
npm test
```

Os testes usam o `node:test`, portanto não é necessário instalar bibliotecas adicionais.

## Regras já implementadas

1. Exatamente 4 jogadores de esquerda.
2. Exatamente 4 jogadores de direita.
3. Todos os campos são obrigatórios.
4. Não permite jogadores com nomes repetidos.
5. Cada dupla possui obrigatoriamente um jogador de cada lado.
6. É possível sortear novamente mantendo os mesmos jogadores.
7. É possível limpar a tela para iniciar um novo sorteio.

## Próximas evoluções

A estrutura foi deixada simples de expandir para recursos como:

- placar;
- cadastro permanente de jogadores;
- ranking;
- histórico de partidas;
- formação de grupos;
- campeonato;
- pontuação individual;
- sorteio com níveis técnicos;
- persistência em banco de dados;
- autenticação;
- versão mobile/PWA.
