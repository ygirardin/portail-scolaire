import csv, io, json, re, unicodedata, urllib.request, pathlib, datetime
ROOT=pathlib.Path(__file__).resolve().parents[1]
URL="https://data.onisep.fr/api/v1/downloads/60867458bb600/60867458bb600.csv"
def norm(s):
    return re.sub(r"[^a-z0-9]+"," ", "".join(c for c in unicodedata.normalize("NFKD",str(s).lower()) if not unicodedata.combining(c))).strip()
def fields(s):
    out=[]
    for code, pattern in {"HAS":r"\bhas\b|hygiene alimentation services?","ERE":r"\bere\b|espace[s]? rur(?:al|aux) et environnement","Habitat":r"\bhabitat\b","VDL":r"\bvdl\b|vente distribution (?:et )?logistique","PI":r"\bpi\b|production industrielle"}.items():
        if re.search(pattern,s):out.append(code)
    return out
def types(s):
    result=[]
    for code, pattern in {"TFC":r"\btfc\b|troubles? des fonctions? cognitives?","TSA":r"\btsa\b|troubles? du spectre autis|troubles? envahissants? du developpement","TSLA":r"\btsla\b|troubles? specifiques? du langage et des apprentissages","TFM":r"\btfm\b|troubles? des fonctions? motrices?","TFA":r"\btfa\b|troubles? de[s]? (?:la |des )?fonctions? auditives?","TFV":r"\btfv\b|troubles? de[s]? (?:la |des )?fonctions? visuelles?","TMA":r"\btma\b|troubles? multiples? associes?"}.items():
        if re.search(pattern,s):result.append(code)
    return result
def main():
    with urllib.request.urlopen(urllib.request.Request(URL,headers={"User-Agent":"portail-scolaire"}),timeout=120) as r:
        data=r.read().decode("utf-8-sig")
    reader=csv.DictReader(io.StringIO(data),dialect=csv.Sniffer().sniff(data[:30000],delimiters=";,\t"))
    headers={k:norm(k) for k in reader.fieldnames}
    print("Colonnes:",headers)
    uai=[k for k,v in headers.items() if re.search(r"\buai\b",v) and "ens" in v]
    typ=[k for k,v in headers.items() if "typdisp" in v and ("libelle" in v or "nom" in v)]
    detail=[k for k,v in headers.items() if re.search(r"element[s]? d enseignement|champ[s]? professionnel[s]?|enseignement[s]? connu[s]?",v) and "ens " not in v]
    if len(uai)!=1 or not typ or not detail:raise ValueError("Schéma Onisep non reconnu: "+str((uai,typ,detail)))
    # Ne jamais chercher les types dans une description générique de l'ULIS.
    # Seuls les intitulés explicites du dispositif et champs d'enseignement sont admis.
    out={"date":datetime.date.today().isoformat(),"source":URL,"licence":"ODbL","ulis":{"rows":{}},"segpa":{"rows":{}}}
    for r in reader:
        code=(r[uai[0]] or "").strip().upper()
        if not re.fullmatch(r"\d{7}[A-Z]",code):continue
        title=norm(" ".join(r.get(k) or "" for k in typ))
        spec=norm(" ".join(r.get(k) or "" for k in detail))
        if "segpa" in title or "enseignement general et professionnel adapte" in title:
            kind="segpa";values=fields(spec)
        elif "ulis" in title or "unite localisee pour l inclusion scolaire" in title:
            kind="ulis";values=types(title+" "+spec)
        else:continue
        if not values:continue
        rows=out[kind]["rows"]
        rows[code]=sorted(set(rows.get(code,[])+values))
    # Contrôle des correspondances avec le catalogue MEN des collèges.
    for kind in ("ulis","segpa"):
        ids={r["uai"] for r in json.loads((ROOT/"data"/(kind+".json")).read_text())}
        rows=out[kind]["rows"]
        out[kind]["rows"]={k:v for k,v in rows.items() if k in ids}
        print(kind,len(out[kind]["rows"]),"dont 95",sum(k.startswith("095") for k in out[kind]["rows"]))
    if len(out["segpa"]["rows"])<100:raise ValueError("Catalogue SEGPA trop incomplet")
    target=ROOT/"data/inclusion-details-onisep.json"
    if target.exists():
        previous=json.loads(target.read_text())
        for kind in ("ulis","segpa"):
            if len(out[kind]["rows"])<len(previous[kind]["rows"])*.7:raise ValueError("Perte excessive de détails "+kind)
    target.write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
if __name__=="__main__":main()
