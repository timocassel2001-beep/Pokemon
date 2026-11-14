# Master Living Dex — tracker local

Suivi d'un Living Dex complet sur 16 jeux officiels + Banque de Pokémon issus de ROM hacks GBA (Gen 3) et NDS (Gen 4).

## Lancer
- **Sans rien installer** : ouvrir `master-living-dex.html` dans Chrome / Firefox / Edge (connexion internet au premier lancement).
- **Développement** : `npm install` puis `npm run dev`. `npm run build` produit `dist/`.

## Organisation
- `src/data/games.js` : suivis des jeux et de leur Pokédex.
- `src/data/pokedata.js` : chargement PokéAPI (CSV officiels → noms FR + Pokédex régionaux ; repli API REST) avec cache.
- `src/lib/store.js` : sauvegarde localStorage (Living Dex + Banque), import/export JSON.
- `src/lib/pkm.js` : lecture des fichiers PKHeX `.pk3/.ek3` (80/100 o) et `.pk4/.ek4/.pkm` (136/236 o).
- `src/views/` : Dashboard, Pokédex National, Pokédex par jeu, Banque, Paramètres.

## Banque ROM hacks (Gen 1 à 5)
Plateformes : Game Boy (Gen 1), Game Boy Color (Gen 2), GBA (Gen 3), NDS Gen 4 (DP/Pt/HGSS), NDS Gen 5 (N/B, N2/B2).

- **Ouvrir une sauvegarde de hack** (`.sav`, `.srm`, `.dsv`…) directement, sans PKHeX. Les octets en trop
  (horloge mGBA, pied de page DeSmuME) sont tolérés et conservés à l'export.
- **Glisser-déposer** entre la sauvegarde et la Banque (ou bouton « Copier dans la Banque » au clic / mobile).
- **Écriture** dans la sauvegarde : Gen 1, 2, 3 et 4, uniquement dans un emplacement libre, uniquement si
  les sommes de contrôle d'origine ont été reconnues, et avec relecture de vérification. Gen 5 : lecture seule.
  En Gen 1/2 la boîte active du jeu est en lecture seule (le jeu l'écrase en changeant de boîte).
- Si la structure n'est pas standard : lecture seule ; en Gen 4, un mode récupération parcourt la sauvegarde.
- Import/export de fichiers `.pk1` à `.pk5` (format PKHeX), boîtes de 30 en nombre illimité.

## Formats officiels Gen 6 à 9
- Les fichiers de sauvegarde à partir de Épée et Bouclier ne sont pas encore lu suite à un chiffrement de la sauvegarde Switch.
- Les sauvegardes 3DS sont lues directement (X/Y, ROSA, Soleil/Lune, USUL), mais en lecture seule.

## Banques
- Deux familles séparées : **Jeux officiels** et **ROM hacks**, chacune avec autant de banques que voulu.
- Chaque Pokémon garde son origine (jeu officiel ou hack) et ses octets d'origine ; renvoyer un Pokémon dans
  un autre jeu que son jeu d'origine demande une confirmation (avertissement si la numérotation diffère).
- « Synchroniser le Dex » : coche dans le Pokédex du jeu (ou du hack) les espèces présentes dans la sauvegarde,
  shiny compris, avec option doublons → quota de transfert,
- Il n'est pas conseillé de transférer les Pokémon issues de ROM hacks entre eux ou vers un jeux officiel dû au changement de binarité de la ROM Hack concernée.

## Transferts entre jeux officiels
« Transférer vers un autre jeu… » ou « Transférer la boîte… » dans une banque Jeux officiels.
La règle des vrais jeux prime : prise en charge des échanges dans une même génération, la Capsule Temporelle (Gen 1 ⇄ Gen 2), le Parc des Amis (Gen 3 → 4, sans CS avec le Pokedex National), Poké Fret (Gen 4 → 5, sans CS avec Pokedex National), Poké Transfert + Banque Pokémon (Gen 5 → 6/7), Console Virtuelle (Gen 1/2 → 7), Pokémon HOME (vers et entre les jeux Switch ; Let's Go : origine Let's Go/GO) non prise en charge pour le moment.
- Jamais vers une génération plus ancienne (sauf avec la Capsule Temporelle) ; espèce absente du jeu cible = indisponible ; œufs refusés.
- Échange direct (même format) et Capsule Temporelle : les données sont réellement transférées avec l'écriture possible en sauvegarde.
- Autres chemins : enregistrés pour le suivi avec les données d'origine conservées.

## Guide des jeux (onglet dédié)
**Par jeu** : pour chaque jeu officiel, un résumé (capturables, par évolution/reproduction, à vérifier, à faire venir), puis :
- *À faire venir d'un autre jeu* : Pokémon du Pokédex du jeu introuvables sur place, regroupés par jeu source
  (même génération d'abord, puis la génération précédente la plus proche), avec le chemin officiel (Banque officielle ou quota de transfert).
- *À vérifier* : Certains Pokémon dans les Pokédex régionaux n'ont pas de lieu de capture connu (don, Pokémon fixe, exclusivité de l'autre version).
- *Méthodes d'évolution* : regroupées par type (niveau, objets, échanges, conditions, lieux, spéciales, impossibles + jeu où les faire).
**Par Pokémon** : fiche complète (sprites normal/shiny, types, catégorie, description, disponibilité dans chaque jeu, évolutions selon le jeu, nombre d'exemplaires dans les banques). Avec un lien « Fiche complète » depuis le Pokédex National.

Données PokéAPI : `pokemon_evolution.csv` rattache chaque méthode au groupe de versions où elle apparaît ; elle reste valable
ensuite sauf dans le cadre de mécaniques disparues (Beauté, Affection), aux lieux et régions, et méthode plus récente du même type. Les évolutions Gen 4 par lieu absentes de la PokéAPI (Mont Couronné, Rocher Mousse/Glace) sont complétées.

## Dex des ROM hacks
Chaque hack a son propre Pokédex (taille réglable : Emerald Platinum 493, Cœur d'Or Ultra 1025, Éclat Pourpre 1025…)
dans « Pokédex par jeu », avec suivi normal/shiny. Les hacks ne comptent pas dans le Master Living Dex officiel mais dispose de leur propre Pokédex.

## Analyseur de sauvegarde
Pour un nouveau hack : lecture de la base structurée + balayage de tous les octets (Gen 3 à 7), choix de la numérotation
par les surnoms, estimation de la règle shiny, création du hack avec ces réglages, ouverture du résultat dans la Banque.
La comparaison de deux sauvegardes (avant/après un dépôt au PC) montre les zones modifiées et les Pokémon
apparus/disparus, pour repérer un format inconnu.

## Objectifs de captures
Pour chaque espèce : objectif normal (par défaut = nombre de jeux suivis où elle existe) et objectif shiny
(réglage global : aucun / 1 par espèce / 1 par jeu), modifiables espèce par espèce.
Possédés = cases remplies (normal et shiny comptés séparément) + exemplaires « en plus » notés pour le transfert.
