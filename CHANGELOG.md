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

### Removed

- A capinha do CD não balança mais sozinha; só o disco gira.

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
