## changes

[Novidades](./CHANGELOG.md).

## transmitir a tela

O programa **Tela** mostra a tela ao vivo para quem abrir `/stream`. A
transmissão só existe enquanto o Rafael está transmitindo — não fica gravada.

Para começar:

1. Abrir `https://<dominio>/broadcast` e colar a `BROADCAST_KEY`.
2. Escolher **uma janela** no seletor (não a tela inteira, para não expor o
   que estiver aberto).
3. Clicar em **Iniciar transmissão**.

A chave fica guardada no navegador, então nas próximas vezes basta ir direto
em `/broadcast`. A partir daí aparece um item **transmitir** na barra de
status da página inicial, que só aparece para quem já tem a chave neste
navegador.

### Áudio do desktop

No Chromium do Linux o seletor de tela esconde o som do sistema por padrão.
Ele só oferece quando o Chrome sobe com a flag que habilita o loopback do
PulseAudio:

```bash
google-chrome --enable-features=PulseaudioLoopbackForScreenShare \
              --disable-features=WebRtcAllowInputVolumeAdjustment
```

Sem a flag o seletor não tem a opção, e o painel avisa *"o seletor não
devolveu áudio do sistema"*. Com a flag aparece um botão **Compartilhar com
áudio do sistema**, desligado por padrão. O áudio vem na própria captura de tela
(o Chrome rotula a track de `System Audio`) — não é um device separado para
escolher.

1. Ligar **Transmitir o som do desktop** no painel.
2. Na janela do Chrome, **ligar o botão "Compartilhar com áudio do sistema"** e
   só então clicar em Compartilhar. Ele aparece desligado por padrão, então
   compartilhar sem ligar isso entrega vídeo mudo sem aviso.
3. O visitante vê um botão **Ativar som** sobre o vídeo. O navegador exige um
   clique para tocar áudio, então o som começa mudo por regra dele, não por
   escolha nossa.

Se o áudio do sistema for interrompido no meio (mudo no volume, saída
trocada), o vídeo continua e o painel avisa.

Para parar, clicar em **Encerrar** (ou em "Deixar de compartilhar" na barra do
Chrome). Fechar a aba também encerra em 20 segundos.

Variáveis: `BROADCAST_KEY` (obrigatória) e `STREAM_VIEWER_CAP` (padrão 5).

## todo

- [x] Métricas de visitantes com Neon/PostgreSQL: online agora, último acesso ("há x min") e views totais.
- [x] Testar vídeo/wallpaper frutiger aero no background em vez do gradiente.
- [x] Player de música em tempo real.
- [ ] Controles de volume inspirado no Windows Media Player.
- [x] Quebrar texto do título da música para evitar overflow na box.
- [x] Sincronizar cor de seleção e focus do botão com a paleta extraída (vibrant) e a cor da janela.
- [ ] Otimizar tempo de carregamento usando cache para a página e imagens e remover chamadas externas.
- [x] Utilizar scss (Sass) para máxima compatibilidade no css gerado.
- [x] Integrar Biome e Husky para padronização do código JavaScript.
- [x] Corrigir clippyjs: balão estoura a viewport em telas estreitas e textos não quebram.
