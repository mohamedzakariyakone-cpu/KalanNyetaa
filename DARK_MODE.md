# Configuration du Mode Sombre

## 🌓 Mode Sombre Disponible

L'application KalanNyetaa supporte maintenant le **mode sombre** complet. Voici comment l'utiliser :

### Fonctionnalités

- **Détection Automatique** : Le mode sombre s'active automatiquement selon la préférence système
- **Toggle Manuel** : Vous pouvez forcer le mode clair ou sombre
- **Persistance** : Votre choix est sauvegardé localement
- **Transition Fluide** : Changement de thème sans rechargement de page

### Configuration du Thème

Le thème s'adapte en fonction de trois paramètres :

1. **Mode Système** (défaut) - Suit les paramètres du système d'exploitation
2. **Mode Clair** - Interface claire en toutes circonstances
3. **Mode Sombre** - Interface sombre en toutes circonstances

### Où Trouver le Sélecteur de Thème

- 📱 **Mobile** : Dans la barre latérale (hamburger menu)
- 💻 **Desktop** : Dans la navigation latérale des paramètres

### Utilisation

Le sélecteur de thème montre trois icônes :
- ☀️ **Sun** - Mode Clair
- ⚙️ **Monitor** - Paramètres Système
- 🌙 **Moon** - Mode Sombre

Cliquez sur l'icône souhaitée pour changer le thème instantanément.

### Personnalisation du Style

Pour les développeurs qui veulent ajouter du style spécifique au mode sombre :

```tsx
// Utiliser les classes Tailwind avec dark:
<div className="bg-white dark:bg-slate-800 text-black dark:text-white">
  Contenu
</div>
```

### Couleurs du Thème

**Mode Clair:**
- Fond : `#f8fafc` (slate-50)
- Texte : `#1e293b` (slate-900)
- Accent : `#1763FF` (blue)

**Mode Sombre:**
- Fond : `#0f172a` (slate-950)
- Texte : `#f1f5f9` (slate-50)
- Accent : `#22c55e` (green-500) sur certains éléments

### Stockage Local

La préférence de thème est stockée dans `localStorage` sous la clé `theme`.
Valeurs possibles :
- `'light'` - Mode clair forcé
- `'dark'` - Mode sombre forcé
- `'system'` - Suit les paramètres du système

### Compatibilité

Le mode sombre fonctionne sur :
- ✅ Tous les navigateurs modernes (Chrome, Firefox, Safari, Edge)
- ✅ iPhone/iPad avec iOS 12+
- ✅ Android 5+
- ✅ PWA mode
