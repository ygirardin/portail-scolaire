"""Récupère les collèges ouverts déclarant un dispositif dans l'annuaire MEN.
Tout l'import est validé avant remplacement des quatre fichiers. Licence ouverte.
"""
import datetime
import json
import math
import pathlib
import re
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
API = "https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-annuaire-education/exports/json"
KINDS = {
    "ulis": ("ulis", 500),
    "segpa": ("segpa", 500),
    "sections-sportives": ("section_sport", 800),
    "sections-internationales": ("section_internationale", 60),
}
FIELDS = "identifiant_de_l_etablissement,nom_etablissement,adresse_1,adresse_2,adresse_3,code_postal,nom_commune,code_departement,latitude,longitude,position,telephone,mail,web,statut_public_prive,libelle_academie,libelle_bassin_formation,date_maj_ligne,type_etablissement,etat"

def s(v):
    return "" if v is None else str(v).strip()

def coord(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return float("nan")

def convert(row):
    uai = s(row.get("identifiant_de_l_etablissement")).upper()
    cp = s(row.get("code_postal")).zfill(5)
    dept = s(row.get("code_departement"))
    if len(dept) == 3 and dept.startswith("0"):
        dept = dept[1:]
    pos = row.get("position") or {}
    if not isinstance(pos, dict):
        pos = {}
    lat = coord(row.get("latitude") if row.get("latitude") is not None else pos.get("lat"))
    lng = coord(row.get("longitude") if row.get("longitude") is not None else pos.get("lon"))
    name = s(row.get("nom_etablissement"))
    if not (re.fullmatch(r"\d{7}[A-Z]", uai) and name and math.isfinite(lat) and math.isfinite(lng) and abs(lat) <= 90 and abs(lng) <= 180 and (lat or lng)):
        return None
    return {"uai": uai, "nom": name, "adr": ", ".join(s(row.get(k)) for k in ("adresse_1","adresse_2","adresse_3") if s(row.get(k))), "cp": cp, "ville": s(row.get("nom_commune")), "dept": dept or cp[:2], "lat": lat, "lng": lng, "tel": s(row.get("telephone")), "mail": s(row.get("mail")), "web": s(row.get("web")), "statut": s(row.get("statut_public_prive")), "academie": s(row.get("libelle_academie")), "bassin": s(row.get("libelle_bassin_formation")), "dateSource": s(row.get("date_maj_ligne"))}

def download(flag):
    query = urllib.parse.urlencode({"where": f'type_etablissement = "Collège" AND etat = "OUVERT" AND {flag} = 1', "select": FIELDS + "," + flag})
    req = urllib.request.Request(API + "?" + query, headers={"User-Agent": "portail-scolaire/controle-dispositifs", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=90) as response:
        raw = json.load(response)
    if not isinstance(raw, list) or not raw:
        raise ValueError(f"Réponse inattendue pour {flag}")
    if any(s(r.get(flag)).lower() not in ("1","true","oui") or s(r.get("type_etablissement")).lower() != "collège" or s(r.get("etat")).upper() != "OUVERT" for r in raw):
        raise ValueError(f"Filtrage ou schéma inattendu pour {flag}")
    return raw

def main():
    # Aucun fichier n'est remplacé tant que les quatre imports ne sont pas validés.
    snapshots = {}
    meta = {"source": "Annuaire de l’éducation nationale", "date": datetime.date.today().isoformat(), "cartes": {}}
    for kind, (flag, minimum) in KINDS.items():
        previous = json.loads((DATA / (kind + ".json")).read_text())
        old = {r["uai"] for r in previous if r.get("uai")}
        raw = download(flag)
        rows = {}
        invalid = 0
        for r in raw:
            converted = convert(r)
            if converted:
                rows[converted["uai"]] = converted
            else:
                invalid += 1
        if len(rows) < minimum or len(rows) < len(raw) * .95 or len(rows) < len(old) * .7:
            raise ValueError(f"Import incomplet {kind}: {len(rows)} UAI (ancien {len(old)}, source {len(raw)})")
        if len(old - rows.keys()) > len(old) * .30:
            raise ValueError(f"Trop d'anciennes implantations absentes : {kind}")
        snapshots[kind] = sorted(rows.values(), key=lambda r: r["uai"])
        info = {"etablissements": len(rows), "val_d_oise": sum(r["dept"] == "95" for r in rows.values()), "source": len(raw), "coordonnees_invalides": invalid, "doublons": len(raw)-invalid-len(rows), "ajouts": len(rows.keys()-old), "absents_de_la_source": len(old-rows.keys())}
        meta["cartes"][kind] = info
        print(kind, json.dumps(info, ensure_ascii=False))
    for kind, rows in snapshots.items():
        (DATA / (kind + ".json")).write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    (DATA / "dispositifs-metadata.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

if __name__ == "__main__":
    main()
