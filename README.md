
# Scraper OpenLane

**Kratek opis:**  
Aplikacija za zajemanje in obdelavo podatkov iz platforme OpenLane. Zgrajena z uporabo **TypeScript**, **Selenium**, **Docker**.

## 📁 Arhitektura projekta  
- **/src:** Izvorna koda projekta.
## ⚙️ Navodila za uporabo  
**Namestitev dependencijev:**  
```bash
npm install
```

**Zagon aplikacije (lokalno):**  
```bash
npm run dev
```

**Gradnja Docker slike:**  
```bash
docker build -t scraper-openlane .
```

**Zagon aplikacije v Dockerju:**  
```bash
docker run -p 3000:3000 scraper-openlane
```

## 👥 Avtorji  
- **Gašper Pistotnik**  
- **Martin Korelič**  
- **Jakob Adam Šircelj**