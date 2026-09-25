# Changelog

O que mudou no perfil. Formato [Keep a Changelog 1.1.0](https://keepachangelog.com/pt-BR/1.1.0/) e [versão semântica](https://semver.org/lang/pt-BR/).

Como manter: anote em `Unreleased` o que muda para quem visita. Sem despejo de `git log`, sem jargão. Ao lançar, troque `Unreleased` pela versão com data e abra outra seção vazia no topo.

## [Unreleased]

### Changed

- Fontes da interface seguem o guia do Windows 7: Segoe UI com reserva em Tahoma, Verdana e Arial.
- A janela do Guestbook agora usa os componentes nativos do 7.css.
- Os recados voando na tela usam a mesma fonte do resto do perfil.
- A barrinha de rolagem do Guestbook imita a do Vista, com o grip de três frisos.
- Nomes e horários dos recados em cinza escuro, como no Messenger da época.
- Scrollbar do Guestbook refeita em JS pra ficar igual nos dois browsers, com teclado e leitor de tela.
- Horário dos recados com respiro da barrinha de rolagem.
- Guestbook e aviso de atualização seguem a cor que sai do avatar.
- Hover, foco e seleção dos botões trocam o azul pela cor do avatar.
- Botões `default` sem a borda azul pulsante do 7.css. A pulsação agora usa a cor do avatar e só aparece no hover.
- A janela do Windows Update agora usa a borda, a barra de título, o botão de fechar e o rodapé nativos do 7.css.
- O papel de parede troca a matiz azul pela cor do avatar, sem perder o brilho da imagem.
- Scrollbar do Guestbook acentua o hover e o clique com a cor do avatar.
- Clippy flutua no canto da tela em desktops, some no mobile.
- Clippy agora troca recados, faz animações, se reposiciona e pausa quando a aba fica em segundo plano.

### Fixed

- As setas da scrollbar não somem mais quando clicadas.

### Removed

- A capinha do CD não balança mais sozinha; só o disco gira.
- Escudo da barra de título do Windows Update. No lugar dele, o aviso mostra o triângulo amarelo.
- Botão de fechar do Windows Update: a atualização precisa ser concluída.
- Deslocamento do disco ao passar o mouse.

## [1.0.1] - 2026-09-16

### Fixed

- A caixinha "Tocando agora" aparece antes da "Programas".
- O botão de som fica junto do tempo da música.

## [1.0.0] - 2026-09-16

### Added

- Dá para ver quem está online, quantas visitas o perfil teve e quando foi a última.
- Guestbook: os recados aparecem voando na tela.
- A caixinha mostra a música que está tocando, com um trechinho de 30 segundos para ouvir.
- Capinha de CD que gira, como nos players antigos.
- Banners do Rio que trocam sozinhos e aviso de atualização.
- Foto de perfil com cores que combinam com a janela.

### Changed

- Recados do Guestbook aparecem maiores e passam mais devagar.
- Papel de parede novo.
- A última visita agora mostra um reloginho.
- A seção de fotos do Rio saiu para dar lugar ao Guestbook.

### Fixed

- O contador de visitas não tapa mais o título da janela.
- Botão de ajuda alinhado e página centralizada no celular.
- Sem animação para quem prefere menos movimento.
- O player não quebra quando a música não tem barra de progresso.

### Security

- Limite de recados por pessoa, para o Guestbook não virar spam.

[Unreleased]: https://github.com/sittiev/ppp/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/sittiev/ppp/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/sittiev/ppp/releases/tag/v1.0.0
