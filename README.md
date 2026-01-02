# BookZZ – Mini boutique de livres universitaires

## Plan (architecture & pages)
- **Architecture** : serveur Node HTTP minimal servant les fichiers statiques et l’API `POST /api/orders`. Front en HTML/CSS/JS vanilla (responsive) chargé depuis `public/`.
- **Pages/sections** :
  - Accueil / Catalogue : sélection par spécialité, cartes livres avec prix + bouton Ajouter.
  - Page catégorie : filtrage par onglet, même gabarit de carte.
  - Fiche livre : contenue dans la carte (titre, description courte, prix, CTA).
  - Panier : liste éditable (quantité + suppression), sous-total, livraison, total.
  - Checkout : formulaire (nom, prénom, tél, wilaya, mode de livraison).
  - Confirmation : message de succès après validation (front) + enregistrement dans Google Sheets côté backend.

## Modèle de données minimal
- **Book** : `{ id: string, title: string, price: number, description: string, category: string }`
- **CartItem** : `{ id: string, title: string, price: number, quantity: number, category: string }`
- **Order** : `{ firstName: string, lastName: string, phone: string, wilaya: string, deliveryMode: "Domicile"|"Bureau", items: CartItem[], total: number }`
- **Ligne Sheets** : `Nom | Prénom | Téléphone | Wilaya | Mode | Livres (titre x qty ; …) | Total | Date/Heure | Statut`

## UX (parcours utilisateur)
1) L’utilisateur parcourt une catégorie et clique sur **Ajouter au panier**.  
2) Dans le panier, il ajuste les quantités ou supprime un livre.  
3) Il remplit le formulaire : nom, prénom, N° de téléphone (obligatoire), wilaya (obligatoire), mode de livraison (obligatoire : domicile ou bureau).  
4) Le total se met à jour automatiquement : `somme(prix * quantité) + frais de livraison`.  
5) Sur validation, le front envoie la commande au backend (`POST /api/orders`). Le backend l’archive dans la feuille Google Sheets et renvoie une confirmation.

## Code (implémentation)
- **Backend** (`src/server.js`) :
  - Serveur HTTP Node natif (pas de dépendances externes) servant `public/`.
  - Endpoints :
    - `GET /api/config` : retourne le tarif livraison (pour le calcul front).
    - `POST /api/orders` : valide le payload, calcule le total, génère un JWT Google, obtient un access token, puis ajoute la ligne dans la feuille via l’API Sheets.
  - Sécurité clés : support du private key en clair ou encodé Base64 (`GOOGLE_SERVICE_ACCOUNT_KEY_BASE64`) pour éviter les problèmes de sauts de ligne.
- **Frontend** (`public/index.html`, `public/app.js`, `public/styles.css`) :
  - Catalogue par onglets, cartes avec prix.
  - Panier local (JS) avec incrément/décrément, suppression.
  - Calcul automatique des montants (sous-total + livraison).
  - Formulaire avec validations simples (champs requis) et feedback succès/erreur.

## Configuration & installation
1) **Prérequis** : Node.js >= 18. Pas de dépendances npm nécessaires.
2) **Variables d’environnement** : copiez `.env.example` en `.env` et complétez :
   - `PORT` : port HTTP (ex. 5173).
   - `DELIVERY_FEE` : tarif de livraison en DA (ex. 400).
   - `SHEET_ID` : identifiant du Google Sheet.
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL` : email du service account.
   - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` : clé privée multi-ligne (garder les `\n` ou utiliser la version Base64).
   - `GOOGLE_SERVICE_ACCOUNT_KEY_BASE64` : clé privée encodée Base64 (recommandé, remplace la précédente si présent).
3) **Google Sheets** :
   - Créez un **Service Account** dans Google Cloud (scope Sheets), récupérez l’email et la clé privée.
   - Partagez la feuille cible (`SHEET_ID`) avec l’email du service account en **Éditeur**.
   - Conservez l’onglet `Feuille1` ou adaptez le nom dans `src/server.js` (`sheetRange`).
4) **Lancer en local** :
   - `npm start`
   - Ouvrez `http://localhost:PORT`.

## Tests rapides
- Vérifiez l’API de config : `curl http://localhost:5173/api/config`.
- Validez un flux complet : ajoutez des livres, envoyez le formulaire, vérifiez l’insertion dans la feuille Google Sheets (statut “Nouveau”).
