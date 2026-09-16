# 📥 Guide d'import - Portail Scolaire 2024-2025

## 📦 Contenu du package

```
portail-scolaire-2024-2025-update/
├── data/                           # 115 fichiers JSON
│   ├── colleges.json              # 5 384 collèges
│   ├── lycees.json                # Lycées mis à jour
│   ├── contacts.json              # Coordonnées établissements
│   ├── sections-*.json            # Sections (sportives, ULIS, SEGPA, etc.)
│   └── secto-01.json à secto-98.json  # Zones Voronoi par département
│
├── *.html                          # 19 fichiers HTML (pages du portail)
│   ├── index.html                 # Accueil
│   ├── colleges.html              # Carte collèges
│   ├── lycees.html                # Carte lycées
│   └── ...
│
└── MISE-A-JOUR.md                # Documentation complète
```

---

## ✅ Étapes d'import dans GitHub

### 1️⃣ Télécharger et extraire

```bash
# Télécharger le ZIP depuis Claude
# Extraire le contenu
unzip portail-scolaire-2024-2025-update.zip
cd portail-update
```

### 2️⃣ Sauvegarder les anciennes données (optionnel mais recommandé)

```bash
cd /chemin/vers/votre/repo/portail-scolaire
git checkout -b backup-2024
cp -r data data_backup_2024
git add data_backup_2024
git commit -m "backup : données précédentes"
```

### 3️⃣ Copier les nouveaux fichiers

```bash
# Depuis le répertoire du package
cp -r portail-update/data /chemin/vers/votre/repo/portail-scolaire/
cp portail-update/*.html /chemin/vers/votre/repo/portail-scolaire/
```

### 4️⃣ Vérifier les fichiers

```bash
cd /chemin/vers/votre/repo/portail-scolaire

# Vérifier les données JSON
ls -lh data/ | wc -l    # Doit afficher ~116 (115 JSON + 1 répertoire)
du -sh data/            # Doit afficher ~8.9M

# Vérifier les fichiers HTML
ls -1 *.html            # Doit afficher les 19 pages
```

### 5️⃣ Commit et Push

```bash
git add data/ *.html
git commit -m "mise à jour 2024-2025 : collèges, lycées, contacts, sectorisation"
git push origin main
```

### 6️⃣ Vérifier le déploiement

Après quelques secondes, les pages GitHub Pages seront mises à jour :
- https://ygirardin.github.io/portail-scolaire/

**Valider :**
- ✅ Page d'accueil charge correctement
- ✅ Carte des collèges s'affiche
- ✅ Carte des lycées s'affiche
- ✅ Filtres par département fonctionnent
- ✅ Recherche par commune fonctionne

---

## 🔍 Validation rapide

### Vérifier la structure des données

```bash
# Vérifier colleges.json
head -20 data/colleges.json | python3 -m json.tool

# Devrait afficher :
# {
#   "uai": "0342572L",
#   "nom": "CLG CITE INTERNATIONALE JULES GUESDE",
#   "commune": "Montpellier",
#   "lat": 43.61082,
#   "lon": 3.84882,
#   "dept": "34"
# }
```

### Vérifier les fichiers secto

```bash
# Vérifier un fichier de sectorisation
python3 -c "import json; d = json.load(open('data/secto-95.json')); print(f\"Collèges en Île-de-France : {len(d['features'])}\")"
```

---

## ⚠️ Troubleshooting

### Les pages ne se chargent pas

**Symptôme** : Page blanche ou erreur 404

**Solutions** :
- [ ] Vérifier que les fichiers `.html` sont à la racine du repo
- [ ] Attendre 2-3 minutes pour le déploiement GitHub Pages
- [ ] Vider le cache du navigateur (Ctrl+Shift+R)
- [ ] Vérifier l'onglet "Settings > Pages" du repo

### Les cartes ne s'affichent pas

**Symptôme** : Page charge mais pas de carte

**Solutions** :
- [ ] Vérifier que le dossier `data/` avec les JSON est présent
- [ ] Vérifier les droits d'accès des fichiers JSON
- [ ] Ouvrir la console du navigateur (F12) pour les erreurs
- [ ] Vérifier que les fichiers `secto-*.json` sont valides JSON

### Erreurs JSON

**Symptôme** : "Invalid JSON" dans la console

**Solutions** :
```bash
# Valider les JSON
python3 -c "
import json
from pathlib import Path
for f in Path('data').glob('*.json'):
    try:
        json.load(open(f))
        print(f'✅ {f.name}')
    except Exception as e:
        print(f'❌ {f.name} : {e}')
"
```

---

## 📊 Statistiques de la mise à jour

| Élément | Valeur |
|---------|--------|
| **Collèges** | 5 384 |
| **Fichiers de sectorisation** | 115 |
| **Pages HTML** | 19 |
| **Taille totale** | ~30 MB (brut) |
| **Taille package** | 5.5 MB (ZIP) |

---

## 🔐 Sécurité

- ✅ Tous les fichiers proviennent de sources officielles (data.gouv.fr)
- ✅ Licence Ouverte v2.0 respectée
- ✅ Pas de données personnelles sensibles
- ✅ Données publiques et open data

---

## 📝 Notes

- Les fichiers HTML conservent leur structure actuelle
- Les données sont actualisées mais les fonctionnalités restent inchangées
- Pour une migration complète, cette phase 1 concerne uniquement les données

---

## 🚀 Prochaines étapes (Phase 2)

Après validation de cette mise à jour :
- [ ] Amélioration du rendering Voronoi
- [ ] Optimisation des performances
- [ ] Nouvelles fonctionnalités de filtrage
- [ ] Mise à jour des effectifs

---

**Support** : Si des problèmes surviennent, consultez le fichier `MISE-A-JOUR.md`

**Bonne chance avec le déploiement ! 🎉**
