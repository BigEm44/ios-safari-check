# Sprawdzenie strony w Safari z iOS

Symulator iPhone'a na maszynie macOS GitHuba (Xcode, Safari z iOS) prowadzony przez `safaridriver`: pierwszy ekran, menu,
lista, „Z budowy” z oknem powiększenia, dotknięcie domu na obrazie, strona domu z rzutami, formularz. Wynik: zrzuty PNG
i `report.json` w artefakcie `safari-results` przebiegu.

Repozytorium publiczne celowo: minuty macOS są w publicznych repozytoriach darmowe. Nie ma tu sekretów ani danych —
skrypt odwiedza tylko publiczną stronę podaną w `url`.

Uruchomienie: `gh workflow run safari.yml -f url=https://www.domy-lipowa-demo.pl`, wyniki: `gh run download <numer>`.

Ograniczenia: symulator to nie telefon (GPU, sieć komórkowa, gesty dwoma palcami); Turnstile może na maszynie w chmurze
zachowywać się inaczej niż u człowieka. Formularz wysyła jedną wiadomość testową na skrzynkę strony próbnej.
