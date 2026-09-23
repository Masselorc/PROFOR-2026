# Fontes das bandeiras das UFs

Bandeiras **oficiais** das 14 unidades federativas elegíveis pelo edital do
PROFOR/ONASP 2026, obtidas do Wikimedia Commons em **15/09/2026** e arquivadas
nesta pasta como SVG. O aplicativo usa essas mesmas bandeiras embutidas em
`bandeiras-uf.js` (PNG em 96x64 e 48x32), sem qualquer requisição em tempo de
execução.

## Procedência

Cada arquivo foi baixado de `https://commons.wikimedia.org/wiki/Special:FilePath/<arquivo>`
e teve removidos apenas metadados de editor (comentários, `<metadata>`,
`sodipodi:*`, `inkscape:*`) e a declaração XML. **Nenhum elemento de desenho foi
alterado.** Onde o original não trazia `viewBox`, foi acrescentado um derivado do
`width`/`height` intrínsecos, com `width`/`height` passando a `100%`, para que o
desenho escale ao tamanho de exibição — o traçado é o mesmo.

| UF | Arquivo no Commons | viewBox efetivo |
|---|---|---|
| AP | Bandeira do Amapá.svg | 0 0 1000 700 |
| AM | Bandeira do Amazonas.svg | 0 0 980 700 |
| BA | Bandeira da Bahia.svg | 0 0 1500 1000 |
| CE | Bandeira do Ceará.svg | -200 -140 400 280 |
| DF | Bandeira do Distrito Federal (Brasil).svg | 0 0 1453.8462 1050 |
| ES | Bandeira do Espírito Santo.svg | 0 0 1320 924 |
| GO | Flag of Goiás.svg | 0 0 560 392 |
| MG | Bandeira de Minas Gerais.svg | 0 0 600 420 |
| PA | Bandeira do Pará.svg | 0 0 900 600 |
| PE | Bandeira de Pernambuco.svg | 0 0 540 360 |
| RN | Bandeira do Rio Grande do Norte.svg | 0 0 900 600 |
| RS | Bandeira do Rio Grande do Sul.svg | -1000 -700 2000 1400 |
| RR | Bandeira de Roraima.svg | 0 0 2000 1400 |
| SE | Bandeira de Sergipe.svg | 0 0 1000 700 |

## Licenças

Os desenhos de bandeiras oficiais brasileiras são, em regra, **domínio público**
ou licenciados em Creative Commons pela comunidade do Commons. Cada arquivo traz
a sua licença na própria página do Commons. Antes de uso oficial externo, confira
a licença de cada título na página correspondente e registre a atribuição que ela
exigir.

## Como refazer

Os scripts usados ficaram em `tmp/bandeiras-oficiais/` (fora da pasta da
aplicação): `baixa.cjs` busca e limpa os SVG, `rasteriza.cjs` gera os PNG
embutidos em `bandeiras-uf.js` e `previa.cjs` monta a prévia de conferência.
Se uma bandeira precisar ser atualizada, basta rodar os dois primeiros de novo.

## Por que não usar emoji de bandeira

O par de indicadores regionais do Unicode (usado pelo emoji de bandeira) é
formado por **códigos de país**, não de estado: `PE` produz a bandeira do
**Peru** e `SE` a da **Suécia**. Por isso as bandeiras aqui são imagens do
desenho oficial, e não emoji.
