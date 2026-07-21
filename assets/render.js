/* ============================================================
   Renan Magalhães - Renderização a partir dos arquivos JSON
   Reutilizado em todas as páginas (categorias + home)
   ============================================================ */

/**
 * Converte uma data em texto para um objeto Date, aceitando tanto o formato
 * esperado (AAAA-MM-DD) quanto o formato brasileiro (DD/MM/AAAA), caso
 * alguém digite errado no JSON sem querer.
 */
function parseData(dateStr) {
    if (!dateStr) return new Date(0);

    const br = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (br) {
        const [, dd, mm, yyyy] = br;
        return new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
    }

    const iso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
        return new Date(`${dateStr}T00:00:00`);
    }

    // Formato desconhecido: tenta do jeito padrão e avisa no console
    console.warn(`Data em formato inesperado: "${dateStr}". Use AAAA-MM-DD.`);
    return new Date(dateStr);
}

/**
 * Busca um arquivo JSON de dados e devolve os itens já ordenados
 * do mais recente para o mais antigo (usando o campo "date").
 */
async function loadItems(jsonPath) {
    const res = await fetch(jsonPath);
    if (!res.ok) {
        throw new Error(`Não foi possível carregar ${jsonPath} (status ${res.status})`);
    }
    const items = await res.json();
    items.sort((a, b) => parseData(b.date) - parseData(a.date));
    return items;
}

/** Gera o HTML de um único card. Se o item tiver "link" (ou uma "category" for passada), o card inteiro vira um link clicável. */
function cardHTML(item, options = {}) {
    const { showBadge = false, badgeLabel = "", category = null } = options;
    const badge = showBadge ? `<span class="card-category">${badgeLabel}</span>` : "";
    const platformBadge = item.platform
        ? `<span class="card-platform">🎮 ${item.platform}</span>`
        : "";
    const platformAttr = item.platform ? ` data-platform="${item.platform}"` : "";
    const tagsData = item.tags.join(" ");
    const tagSpans = item.tags
        .map(t => `<span class="tag" data-tag="${t}">${t}</span>`)
        .join("");

    const cardInner = `
        <div class="media-card" data-tags="${tagsData}"${platformAttr}>
            <div class="card-image">
                <img src="${item.img}" alt="${item.title}" loading="lazy">
                ${badge}
                ${platformBadge}
                <span class="card-rating">⭐ ${item.rating}</span>
            </div>
            <div class="card-content">
                <h3>${item.title}</h3>
                <p class="sinopse">${item.sinopse}</p>
                <div class="card-tags">${tagSpans}</div>
            </div>
        </div>`;

    // Prioridade: link customizado do item (ex: tutoriais) > página de detalhe genérica (ex: filmes, séries...)
    const detailLink =
        item.link || (category && item.id ? `detalhe.html?cat=${category}&id=${item.id}` : null);

    return detailLink ? `<a class="card-link" href="${detailLink}">${cardInner}</a>` : cardInner;
}

/** Mostra/esconde os cards do grid conforme a tag ou plataforma selecionada. */
function filtrarTag(valorSelecionado, gridEl, filtersEl) {
    gridEl.querySelectorAll(".media-card").forEach(card => {
        let visivel;
        if (valorSelecionado === "todos") {
            visivel = true;
        } else if (valorSelecionado.startsWith("plat:")) {
            const plataforma = valorSelecionado.slice(5);
            visivel = card.getAttribute("data-platform") === plataforma;
        } else {
            const tagsDoCard = card.getAttribute("data-tags") || "";
            visivel = tagsDoCard.includes(valorSelecionado);
        }
        card.style.display = visivel ? "block" : "none";
    });

    if (filtersEl) {
        filtersEl.querySelectorAll(".tag-btn").forEach(btn => {
            btn.classList.toggle("active", btn.dataset.tag === valorSelecionado);
        });
    }
}

/**
 * Monta uma página de categoria completa:
 * - busca o JSON
 * - desenha os botões de filtro (com base nas tags realmente usadas)
 * - desenha os cards, do mais recente para o mais antigo
 */
async function initCategoryPage(jsonPath, gridSelector, filtersSelector, categorySlug = null) {
    const gridEl = document.querySelector(gridSelector);
    const filtersEl = document.querySelector(filtersSelector);
    gridEl.innerHTML = '<p class="loading-state">Carregando...</p>';

    try {
        const items = await loadItems(jsonPath);

        if (items.length === 0) {
            gridEl.innerHTML = '<p class="empty-state">Nenhum item cadastrado ainda.</p>';
            return;
        }

        // Botões de filtro dinâmicos, a partir das tags e plataformas presentes nos itens
        const tagsUnicas = [...new Set(items.flatMap(i => i.tags))];
        const plataformasUnicas = [...new Set(items.filter(i => i.platform).map(i => i.platform))];

        let filtrosHTML =
            '<button class="tag-btn active" data-tag="todos">#Todos</button>' +
            tagsUnicas
                .map(t => `<button class="tag-btn" data-tag="${t}">${t}</button>`)
                .join("");

        if (plataformasUnicas.length > 0) {
            filtrosHTML += plataformasUnicas
                .map(p => `<button class="tag-btn platform-btn" data-tag="plat:${p}">🎮 ${p}</button>`)
                .join("");
        }

        filtersEl.innerHTML = filtrosHTML;

        filtersEl.addEventListener("click", e => {
            if (e.target.matches(".tag-btn")) {
                filtrarTag(e.target.dataset.tag, gridEl, filtersEl);
            }
        });

        // Renderiza os cards
        gridEl.innerHTML = items.map(item => cardHTML(item, { category: categorySlug })).join("");

        // Clicar numa tag dentro de um card também filtra (e não deve navegar, se o card for um link)
        gridEl.addEventListener("click", e => {
            if (e.target.matches(".tag")) {
                e.preventDefault();
                e.stopPropagation();
                filtrarTag(e.target.dataset.tag, gridEl, filtersEl);
            }
        });
    } catch (err) {
        console.error(err);
        gridEl.innerHTML = '<p class="empty-state">Erro ao carregar os itens. Verifique o arquivo JSON.</p>';
    }
}

/**
 * Monta a home: para cada categoria, busca o JSON e mostra
 * apenas o item mais recente (items[0], já que loadItems ordena por data).
 */
async function initHomePage(categorias, containerSelector) {
    const container = document.querySelector(containerSelector);
    container.innerHTML = '<p class="loading-state">Carregando...</p>';
    const blocos = [];

    for (const cat of categorias) {
        try {
            const items = await loadItems(`assets/data/${cat.file}`);
            if (items.length === 0) continue;

            const maisRecente = items[0];
            blocos.push(`
                <div class="home-item">
                    <h2>${cat.label}</h2>
                    <a class="home-card-link" href="${cat.link}" aria-label="Ver todos os itens em ${cat.label}">
                        ${cardHTML(maisRecente, { showBadge: true, badgeLabel: cat.badge })}
                    </a>
                </div>`);
        } catch (err) {
            console.error(`Erro ao carregar ${cat.file}:`, err);
        }
    }

    container.innerHTML = blocos.length
        ? `<div class="home-grid">${blocos.join("")}</div>`
        : '<p class="empty-state">Nenhum item cadastrado ainda.</p>';
}

/**
 * Metadados de cada categoria, usados pela página de detalhe genérica
 * (detalhe.html) para saber qual JSON buscar e para onde voltar.
 */
const CATEGORY_META = {
    filmes: { label: "Filmes", file: "filmes.json", page: "filmes.html" },
    series: { label: "Séries", file: "series.json", page: "series.html" },
    livros: { label: "Livros", file: "livros.json", page: "livros.html" },
    musicas: { label: "Músicas", file: "musicas.json", page: "musicas.html" },
    jogos: { label: "Jogos", file: "jogos.json", page: "jogos.html" },
    fotos: { label: "Fotos", file: "fotos.json", page: "fotos.html" },
};

/** Formata a data (AAAA-MM-DD ou DD/MM/AAAA) como "18/07/2026". */
function formatarData(dateStr) {
    return parseData(dateStr).toLocaleDateString("pt-BR");
}

/**
 * Monta a página de detalhe genérica (detalhe.html?cat=filmes&id=a-origem):
 * busca o item certo no JSON da categoria e mostra tudo, sem cortar a sinopse.
 */
async function initDetailPage(containerSelector) {
    const container = document.querySelector(containerSelector);
    const params = new URLSearchParams(window.location.search);
    const cat = params.get("cat");
    const id = params.get("id");
    const meta = CATEGORY_META[cat];

    if (!meta || !id) {
        container.innerHTML = '<p class="empty-state">Item não encontrado.</p>';
        return;
    }

    // Destaca o item de menu correspondente à categoria
    document.querySelectorAll("header nav a").forEach(a => {
        if (a.getAttribute("href") === meta.page) a.classList.add("active");
    });

    try {
        const items = await loadItems(`assets/data/${meta.file}`);
        const item = items.find(i => i.id === id);

        if (!item) {
            container.innerHTML = '<p class="empty-state">Item não encontrado.</p>';
            return;
        }

        document.title = `${item.title} - Renan Magalhães`;

        const platformInfo = item.platform ? ` · 🎮 ${item.platform}` : "";
        const tagsHTML = item.tags.map(t => `<span class="tag">${t}</span>`).join("");
        const analiseHTML = item.analise
            ? `<h2>Minha análise</h2><p>${item.analise}</p>`
            : "";

        container.innerHTML = `
            <article class="article">
                <a class="voltar" href="${meta.page}">&larr; Voltar para ${meta.label}</a>
                <img class="article-cover" src="${item.img}" alt="${item.title}">
                <h1>${item.title}</h1>
                <p class="article-meta">⭐ ${item.rating}${platformInfo} · ${formatarData(item.date)}</p>
                <div class="card-tags article-tags">${tagsHTML}</div>
                <p>${item.sinopse}</p>
                ${analiseHTML}
            </article>`;
    } catch (err) {
        console.error(err);
        container.innerHTML = '<p class="empty-state">Erro ao carregar o item. Verifique o arquivo JSON.</p>';
    }
}
