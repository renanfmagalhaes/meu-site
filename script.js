// Script de filtragem por hashtag, reutilizado em todas as páginas de categoria
function filtrarTag(tagSelecionada) {
    const cards = document.querySelectorAll('.media-card');

    cards.forEach(card => {
        const tagsDoCard = card.getAttribute('data-tags');

        if (tagSelecionada === 'todos' || tagsDoCard.includes(tagSelecionada)) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}
