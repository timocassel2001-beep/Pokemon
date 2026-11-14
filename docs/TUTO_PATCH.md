# Tutoriel : appliquer un patch xdelta

Un fichier `.xdelta` contient uniquement les **différences** entre le jeu d'origine et le jeu modifié.
Il faut donc l'appliquer sur **la ROM exacte** prévue (même langue, même révision).

## Étape 0 — Vérifier sa ROM
Calculez le MD5 de votre ROM et comparez-le à [CHECKSUMS.md](CHECKSUMS.md).
- **En ligne** : Rom Patcher JS affiche le MD5 dès que vous chargez la ROM.
- **Windows** : `certutil -hashfile "MaRom.nds" MD5`
- **Mac / Linux** : `md5 MaRom.nds` / `md5sum MaRom.nds`

Si le MD5 ne correspond pas, le patch échouera : chaque patch contient une somme de contrôle et refuse une mauvaise ROM.

## Méthode 1 — Rom Patcher JS (recommandée, tous appareils)
1. Ouvrez https://www.marcrobledo.com/RomPatcher.js/
2. **ROM file** : choisissez votre ROM d'origine.
3. **Patch file** : choisissez le `.xdelta` voulu.
4. Cliquez sur **Apply patch** : la ROM modifiée se télécharge.

## Méthode 2 — Windows : Delta Patcher ou xdelta UI
1. Téléchargez **Delta Patcher** (ou xdelta UI).
2. *Original file* : votre ROM. *xdelta patch* : le fichier `.xdelta`.
3. Cliquez sur **Apply patch**. Gardez toujours une copie de la ROM d'origine.

## Méthode 3 — Android : UniPatcher
Ouvrez UniPatcher, choisissez le patch, puis la ROM, puis **Apply**.

## Méthode 4 — Ligne de commande (Windows / Mac / Linux)
```
xdelta3 -d -s "Pokemon_Platine_FR.nds" "Pokemon_Platine_FR_2_Hardcore_6Pokemon_MultiExp.xdelta" "Platine_Hardcore.nds"
```

## Après le patch
- **Game Boy / Game Boy Color** : mGBA, SameBoy, Gambatte.
- **GBA** : mGBA (recommandé), VisualBoyAdvance-M.
- **DS** : melonDS ou DeSmuME. Pour les jeux de la Gen 5 « DSi Enhanced », utilisez le mode DS.
- **Sauvegardes** : une sauvegarde du jeu d'origine reste lisible par la version patchée, mais commencez de préférence une nouvelle partie pour profiter des dresseurs modifiés.

## Gen 1 / Gen 2 (Game Boy / Game Boy Color)
La même méthode fonctionne : xdelta s'applique à n'importe quel fichier, y compris `.gb` et `.gbc`.
Émulateurs conseillés : mGBA (Game Boy et Game Boy Color), SameBoy, Gambatte. Détails dans [GEN1_GEN2.md](GEN1_GEN2.md).
