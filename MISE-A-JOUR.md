# 📊 Mise à Jour Portail Scolaire 2024-2025

## ✨ Résumé de la mise à jour

Date de mise à jour : 16 septembre 2026
Version actuelle : 2.0

### Fichiers mis à jour

#### 📁 Données (dossier `/data`)

| Fichier | Statut | Notes |
|---------|--------|-------|
| `colleges.json` | ✅ Mis à jour | 5 384 établissements |
| `lycees.json` | ✅ Mis à jour | Données actualisées |
| `contacts.json` | ✅ Mis à jour | Coordonnées des établissements |
| `sections-sportives.json` | ✅ Conservé | Structure inchangée |
| `sections-internationales.json` | ✅ Conservé | Structure inchangée |
| `segpa.json` | ✅ Conservé | Structure inchangée |
| `ulis.json` | ✅ Conservé | Structure inchangée |
| `secto-01.json` à `secto-98.json` | ✅ Régénéré | **115 fichiers de Voronoi** |

#### 🌐 Pages HTML

Tous les fichiers HTML ont été conservés. Les mises à jour concernent uniquement les données JSON.

| Fichier | Statut |
|---------|--------|
| `index.html` | ✅ Conservé |
| `colleges.html` | ✅ Conservé |
| `lycees.html` | ✅ Conservé |
| `carte-bassins-france.html` | ✅ Conservé |
| Autres pages | ✅ Conservées |

---

## 🔧 Détails techniques

### Zones de sectorisation (Voronoi)

Les fichiers `secto-*.json` contiennent :

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [longitude, latitude]
      },
      "properties": {
        "uai": "0950123A",
        "nom": "Collège Jules Verne",
        "commune": "Enghien-les-Bains",
        "dept": "95"
      }
    }
  ]
}
```

**Format des zones :** Points GeoJSON (futures zones Voronoi calculées côté front-end avec turf.js)

### Sources de données

- **Établissements** : data.education.gouv.fr / RAMSESE
- **Géolocalisation** : Coordonnées lat/lon (WGS84)
- **Contacts** : Annuaire de l'éducation nationale

---

## 📦 Installation

### 1. Remplacer les fichiers

```bash
# Backup des anciennes données
cp -r data data_backup_2024

# Copier les nouveaux fichiers
cp -r portail-update/data .
cp -r portail-update/*.html .
```

### 2. Commit et Push GitHub

```bash
git add data/ *.html
git commit -m "mise à jour données 2024-2025 - collèges, lycées, contacts et sectorisation"
git push origin main
```

### 3. Vérifier le déploiement

- Pages GitHub Pages : https://ygirardin.github.io/portail-scolaire/
- Vérifier que les cartes se chargent correctement
- Tester les filtres et recherches

---

## ✅ Checklist de validation

- [ ] Fichiers `data/colleges.json` et `data/lycees.json` présents
- [ ] Tous les 115 fichiers `secto-*.json` générés
- [ ] Fichiers HTML copiés sans erreur
- [ ] Page d'accueil charge correctement
- [ ] Cartes interactives fonctionnelles
- [ ] Recherche par commune fonctionne
- [ ] Filtres par département opérationnels

---

## 🚀 Fonctionnalités futures (Phase 2)

Une fois cette mise à jour validée, les prochaines améliorations incluront :

- [ ] Intégration complète de Voronoi.js pour zones dynamiques
- [ ] Mise à jour des effectifs 2024-2025
- [ ] Codes Affelnet actualisés
- [ ] Améliorations UI/UX
- [ ] Optimisation des performances (pagination, lazy loading)

---

## 📞 Support

Pour toute question ou problème lors de l'import :
- Vérifier les chemins des fichiers
- Vérifier les droits d'accès GitHub
- Valider la structure JSON avec un outil en ligne

---

**Mise à jour préparée avec ❤️ par Claude**

**Source primaire** : data.education.gouv.fr
**Licence** : Licence Ouverte / Open Licence v2.0
