# Changelog

O que mudou no perfil. Formato [Keep a Changelog 1.1.0](https://keepachangelog.com/pt-BR/1.1.0/) e [versão semântica](https://semver.org/lang/pt-BR/).

Como manter: anote em `Unreleased` o que muda para quem visita. Sem despejo de `git log`, sem jargão. Ao lançar, troque `Unreleased` pela versão com data e abra outra seção vazia no topo.

## [Unreleased]

### Changed

- O ícone do programa Tela é o do protetor de tela do GNOME.
- Cada bloco da janela Sobre tem um ícone próprio, e cada dica tem o seu, para dar pra achar a parte que interessa de relance.
- As dicas viraram rótulo em negrito mais o motivo, em vez de cinco frases que começavam igual.
- O bloco dos seus dados foi dividido em duas partes, e a do autor encolheu para uma linha.
- O link de reportar bug virou botão no fim do bloco, em vez de sumir no meio de uma frase.
- Botões que são link agora pulsam na cor do avatar, igual aos botões de verdade. O de reportar bug estava com o azul padrão do 7.css.

### Added

- Novo programa Sobre, agora o primeiro da lista. Abre uma janela com a data da última atualização, a do primeiro dia do site e a versão do build.
- A janela avisa que o site está em constante desenvolvimento e pode ganhar funcionalidade nova a qualquer momento.
- Explica o que acontece com os seus dados: nada é obtido nem compartilhado, e o contador de visitas guarda um código irreversível em vez do IP.
- Conta que o autor usa Arch, com o logo do Arch ao lado.
- Avisos de leitura: ver num desktop, animações ligadas, adblock desligado, Chrome ou Firefox, e Dark Reader ou modo noturno desligados.
- Passo a passo para reportar bug na aba Issues do repositório, escrito para quem nunca abriu o GitHub.
- Novo programa Tela: quem clica abre a tela do Rafael ao vivo, direto do computador dele, sem passar por servidor de vídeo no meio.
- A janela avisa quando não está ninguém transmitindo e acende sozinha assim que ele começa.
- Dá para transmitir o som do desktop junto com a imagem.
- O painel de transmissão mostra resolução, quadros por segundo, bitrate, perda e latência de cada espectador.
- O painel também diz de onde cada espectador está assistindo: navegador, sistema, se é celular ou computador, e o tamanho da janela, com o ícone do sistema. O detalhe técnico completo fica no hover.
- Até 5 pessoas assistindo ao mesmo tempo.

### Changed

- Fontes da interface seguem o guia do Windows 7: Segoe UI com reserva em Tahoma, Verdana e Arial.
- A janela do Guestbook agora usa os componentes nativos do 7.css.
- Os recados voando na tela usam a mesma fonte do resto do perfil.
- A barrinha de rolagem do Guestbook imita a do Vista, com o grip de três frisos.
- Nomes e horários dos recados em cinza escuro, como no Messenger da época.
- Scrollbar do Guestbook refeita em JS pra ficar igual nos dois browsers, com teclado e leitor de tela.
- A janela do Sobre tem a mesma barrinha de rolagem do Guestbook, com o grip de três frisos.
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

- A imagem da transmissão sai em 1080p e mais nítida, com teto de bitrate de 8 Mbps.
- Dá para escolher a qualidade ao iniciar a transmissão: leve (720p · 15fps), padrão (720p · 30fps) ou alta (1080p · 30fps).
- A transmissão agora conecta atrás de NAT restrito e firewall (caso comum no Windows): o servidor indica um relay TURN e o vídeo passa por ele quando a conexão direta é impossível.
- A tela do programa Tela não fica mais preta no Brave e em outros navegadores mais rigorosos com vídeo automático. A imagem começa sozinha; se o navegador insistir em segurar, um toque na tela começa.
- O tamanho da janela que o espectador manda para o painel é conferido antes de guardar.
- O programa Tela entra em tela cheia no primeiro clique, em vez de pedir isso e falhar no console.
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
