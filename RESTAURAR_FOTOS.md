# Como voltar a exibir Fotos no site

As fotos não foram apagadas. A página `fotos.html`, os dados em
`assets/data/fotos.json` e as imagens em `assets/img/fotos/` continuam no
projeto. Somente os atalhos públicos foram retirados.

## 1. Restaurar Fotos na página inicial

Abra `index.html`. Dentro do array `categoriasHome`, adicione este bloco logo
depois da categoria Jogos (coloque uma vírgula entre os dois blocos):

```js
{
  "file": "fotos.json",
  "label": "Última Foto",
  "badge": "foto",
  "link": "fotos.html"
}
```

## 2. Restaurar Fotos no cabeçalho

Em cada arquivo HTML que tenha o menu principal, adicione o link abaixo no
`<nav>`, de preferência entre Tutoriais e Devaneio:

```html
<a href="fotos.html">Fotos</a>
```

Nas páginas dentro das pastas `tutoriais/` e `treinos/`, use o caminho relativo:

```html
<a href="../fotos.html">Fotos</a>
```

Na própria página `fotos.html`, use:

```html
<a href="fotos.html" class="active">Fotos</a>
```

Para localizar todos os cabeçalhos rapidamente no VS Code, pesquise por
`<nav>` em todos os arquivos. Depois de salvar, publique novamente o site para
que as fotos voltem a aparecer para todos.

