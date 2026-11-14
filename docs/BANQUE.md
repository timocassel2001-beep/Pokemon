# Banque Pokémon : Master Living Dex

Un outil de suivi de **Living Dex** et une **banque de Pokémon** qui fonctionnent entièrement dans le navigateur, sans installation.
Les sources sont dans [outils/master-living-dex](../outils/master-living-dex).

## Démarrer
- **Sans rien installer** : ouvrez `outils/master-living-dex/master-living-dex.html` dans Chrome, Firefox ou Edge. Une connexion internet est nécessaire au premier lancement pour charger les données PokéAPI.
- **Pour les développeurs** : `npm install`, puis `npm run dev`. `npm run build` produit le dossier `dist/`.
- Toutes vos données restent sur votre machine (stockage du navigateur). Pensez à utiliser **Paramètres → Exporter** pour faire des sauvegardes.

## Fonctionnalités
- **Master Living Dex** sur 16 jeux officiels : Pokédex National, Pokédex par jeu, formes normales et shiny, objectifs de capture.
- **Banques illimitées** de boîtes de 30, en deux familles séparées : *Jeux officiels* et *ROM hacks*.
- **Ouverture directe des sauvegardes** (`.sav`, `.srm`, `.dsv`…) sans PKHeX, avec glisser-déposer entre la sauvegarde et la banque.
- **Écriture dans la sauvegarde** en Gen 1, 2, 3 et 4 : uniquement dans un emplacement libre, après vérification des sommes de contrôle et avec relecture. **Gen 5 : lecture seule.**
- **Import et export** de fichiers PKHeX, du `.pk1` au `.pk5`, plus lecture des formats `.pk6` à `.pk9`.
- **Transferts** respectant les règles officielles : Time Capsule, Pal Park, Poké Transfert, Poké Transporter, HOME.
- **Guide des jeux** : Pokémon à faire venir, méthodes d'évolution par jeu, fiche complète de chaque Pokémon.
- **Analyseur de sauvegarde** pour les hacks au format inconnu.

## Compatibilité avec les patchs de ce dépôt

Ces patchs **ne modifient ni le format de sauvegarde, ni la numérotation des espèces, ni la structure des Pokémon**.
Une sauvegarde d'un jeu patché se lit donc exactement comme celle du jeu d'origine.

| Jeux patchés | Plateforme à choisir dans la Banque | Taille du Dex | Lecture | Écriture |
|---|---|---|---|---|
| Rubis, Saphir, Émeraude, Rouge Feu, Vert Feuille | GBA · Gen 3 | 386 | ✅ | ✅ |
| Diamant, Perle, Platine, HeartGold, SoulSilver | NDS · Gen 4 | 493 | ✅ | ✅ |
| Noire, Blanche, Noire 2, Blanche 2 | NDS · Gen 5 | 649 | ✅ | ❌ (lecture seule) |
| Rouge, Bleu, Jaune / Or, Argent, Cristal | GB · Gen 1 / GBC · Gen 2 | 151 / 251 | ✅ | ✅ (boîte active en lecture seule) |

## Ajouter un jeu patché dans la Banque
1. Ouvrez l'onglet **Banque**, famille **ROM hacks**, puis **Nouveau hack**.
2. Donnez-lui un nom, par exemple « Platine Hardcore +23 % ».
3. Choisissez la plateforme et la taille du Dex selon le tableau ci-dessus.
4. **Ouvrir une sauvegarde** : choisissez le fichier `.sav` ou `.dsv` de votre émulateur.
5. Glissez les Pokémon vers la Banque, ou utilisez **Copier dans la Banque**.
6. Optionnel : **Synchroniser le Dex** coche dans le Pokédex du hack les espèces présentes dans la sauvegarde.

## Bon à savoir
- Les Pokémon obtenus dans une version patchée sont des Pokémon normaux. Un Alakazam évolué au niveau 37 a exactement la même structure qu'un Alakazam obtenu par échange.
- Les dresseurs modifiés n'ont aucune influence sur **vos** Pokémon.
- Les jeux patchés sont enregistrés comme **ROM hacks** et ne comptent pas dans le Master Living Dex officiel.
