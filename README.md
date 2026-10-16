# ETW GTM Templates

Source unique des modèles Google Tag Manager génériques utilisés par les extensions ETW WordPress/WooCommerce et PrestaShop.

- `gtm/etw-ga4-base-v1.0.json` : socle GA4 vitrine et leads.
- `gtm/etw-ga4-ecommerce-v1.0.json` : socle GA4 et événements ecommerce.
- Contrat dataLayer ETW : version 1.0.

Importer le JSON en mode Fusion dans GTM, puis remplacer `G-XXXXXXXXXX` dans `CFG - GA4 Measurement ID`. Valider la CMP et Consent Mode v2 séparément avant publication.

## Développement

Node.js requis, sans dépendances externes :

```sh
node scripts/build-gtm-templates.js
node tests/gtm.templates.test.js
```

Créer un nouveau tag de version après validation. Ne pas déplacer les tags existants : les extensions utilisent une version précise pour préserver leur compatibilité.

Première version : `v1.0.0`. Les JSON sont accessibles sous `https://raw.githubusercontent.com/Ethicweb/etw-gtm-templates/v1.0.0/gtm/`.

Licence MIT, voir LICENSE.
