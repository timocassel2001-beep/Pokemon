# Gen 1 et Gen 2 (Game Boy / Game Boy Color)

Les 8 versions existent pour Rouge, Bleu, Jaune, Or, Argent et Cristal, au même format **xdelta** que les autres jeux.
Le tutoriel est le même : [TUTO_PATCH.md](TUTO_PATCH.md).

## Contenu

| Fonction | Gen 1 (Rouge, Bleu, Jaune) | Gen 2 (Or, Argent, Cristal) |
|---|---|---|
| Texte instantané | ✅ | ✅ |
| Barres de PV accélérées | ❌ | ❌ |
| Multi Exp automatique | ✅ Exp. All toujours actif (EXP partagée entre toute l'équipe) | ✅ tous les Pokémon comptent comme porteurs du Multi Exp |
| Évolutions par échange supprimées | ✅ Kadabra, Machopeur, Gravalanch, Spectrum au niveau 37 | ✅ les 10 évolutions concernées au niveau 37 ; Roigada par l'amitié |
| Méthode d'évolution dans le Pokédex | ✅ (70 fiches) | ✅ (110 à 112 fiches ; Snubbull non modifié dans Cristal, texte trop long) |
| Hardcore : Pokémon ajoutés | 6 Pokémon (5 pour les dresseurs les plus faibles) | Selon la place : surtout 4 dans Or et Argent, 3 dans Cristal |
| Hardcore : IV des dresseurs | 15 partout (le maximum en Gen 1) | inchangés |
| Hardcore : objets et IA | — (pas d'objets tenus en Gen 1) | inchangés |
| Premier combat contre le rival | d'origine | d'origine |
| +23 % / +30 % de niveau, avec ou sans Multi Exp | ✅ | ✅ |

## Pourquoi ces limites ?

Les données des dresseurs doivent rester dans une seule « banque » de 16 Ko de la cartouche, déjà presque pleine.
Les déplacer obligerait à réécrire les routines du jeu qui les lisent. Sans tests en jeu, le risque de planter la partie est réel.
La Gen 1 tient presque à 6 Pokémon. La Gen 2 stocke aussi le nom de chaque dresseur et les attaques des Champions, ce qui laisse beaucoup moins de place.
