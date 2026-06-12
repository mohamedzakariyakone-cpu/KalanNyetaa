# Guide d'implémentation PWA Offline

## Vue d'ensemble

Cette application est maintenant une PWA complète avec support offline. Voici comment utiliser les nouvelles fonctionnalités dans vos pages.

## Architecture

### 1. **Service Worker** (`app/sw.ts`)

Le Service Worker gère automatiquement :
- **Precaching** : Les assets statiques sont mis en cache au premier chargement
- **Runtime caching** : Les données API sont cachées selon des stratégies spécifiques
- **Offline fallback** : Une page offline est servie si la page demandée n'est pas en cache

Stratégies de cache :
- **Supabase API** : Cache first (7 jours)
- **Images externes** : Cache first (30 jours)
- **Assets statiques** : Cache first (30 jours)
- **Pages HTML** : Network first avec timeout (1 jour)

### 2. **Stockage offline** (`utils/offlineStorage.ts`)

Utilise IndexedDB pour stocker :
- **cache_store** : Données mises en cache
- **sync_queue** : Opérations en attente de synchronisation
- **metadata_store** : Métadonnées de cache (expiration, source)

### 3. **API offline** (`utils/offlineApi.ts`)

Deux fonctions principales :

#### `offlineFetch<T>(cacheKey, fetchFn, options?)`

Récupère les données avec fallback offline automatique.

```typescript
const { data, error, isFromCache, isOffline } = await offlineFetch<Student[]>(
  'students:2024',
  async () => {
    return await supabase
      .from('students')
      .select('*')
      .eq('academic_year_id', '2024');
  },
  { 
    cacheDuration: 3600, // Cache 1 heure
    forceRefresh: false   // Ignorer le cache
  }
);
```

**Options** :
- `cacheOnOnline` : Mettre en cache les résultats online (défaut: true)
- `cacheDuration` : Durée du cache en secondes (défaut: infini)
- `forceRefresh` : Ignorer le cache et forcer la récupération (défaut: false)

**Résultat** :
- `data` : Les données (du cache ou du serveur)
- `error` : L'erreur si elle existe
- `isFromCache` : Indique si les données viennent du cache
- `isOffline` : Indique si l'app est en mode offline

#### `offlineWrite<T>(params)`

Écrit les données avec queue offline automatique.

```typescript
const { data, error, offline } = await offlineWrite({
  table: 'students',
  action: 'INSERT',
  payload: { name: 'John', class_id: '123' },
  cacheKey: 'students:2024',
  optimisticUpdate: () => {
    // Mettre à jour l'UI immédiatement
    setStudents(prev => [...prev, newStudent]);
  }
});
```

**Actions** :
- `INSERT` : Insérer une nouvelle ligne
- `UPDATE` : Mettre à jour une ligne existante
- `DELETE` : Supprimer une ligne
- `UPSERT` : Insérer ou mettre à jour

**Options** :
- `keyColumn` : Colonne clé pour UPDATE/DELETE (défaut: 'id')
- `keyValue` : Valeur de la clé pour UPDATE/DELETE
- `returning` : Colonnes à retourner

**Résultat** :
- `data` : Les données retournées ou le payload
- `error` : L'erreur si elle existe
- `offline` : Indique si l'opération a été mise en queue

### 4. **Synchronisation** (`utils/syncManager.ts`)

Gère la synchronisation des données en attente.

```typescript
// Synchroniser manuellement
const result = await forceSyncNow();
console.log(`${result.synced} synchronisé(s), ${result.failed} échoué(s)`);

// Initialiser les listeners (appelé automatiquement dans OfflineSync)
initSyncListeners();

// Enregistrer la Background Sync API
await registerBackgroundSync();

// Configurer un callback de statut
setSyncStatusCallback((status, message) => {
  console.log(`Sync ${status}: ${message}`);
});
```

## Utilisation dans les pages

### Exemple 1 : Afficher une liste de données

```typescript
"use client"

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase'
import { offlineFetch } from '@/utils/offlineApi'

export default function StudentsList() {
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {
    const fetchStudents = async () => {
      const { data, error, isOffline: offline } = await offlineFetch<any[]>(
        'students:all',
        async () => {
          return await supabase
            .from('students')
            .select('*');
        },
        { cacheDuration: 3600 }
      );

      if (data) {
        setStudents(data);
        setIsOffline(offline || false);
      }
      setLoading(false);
    };

    fetchStudents();
  }, []);

  if (loading) return <div>Chargement...</div>;
  if (isOffline) return <div>Mode hors-ligne - Données en cache</div>;

  return (
    <div>
      {students.map(student => (
        <div key={student.id}>{student.name}</div>
      ))}
    </div>
  );
}
```

### Exemple 2 : Ajouter/Modifier une donnée

```typescript
"use client"

import { useState } from 'react'
import { offlineWrite } from '@/utils/offlineApi'

export default function AddStudent() {
  const [loading, setLoading] = useState(false)

  const handleAddStudent = async (name: string) => {
    setLoading(true);
    
    const { data, error, offline } = await offlineWrite({
      table: 'students',
      action: 'INSERT',
      payload: { name, class_id: '123' },
      cacheKey: 'students:all',
      optimisticUpdate: () => {
        // Mettre à jour l'UI immédiatement
        // Les données seront synchronisées automatiquement
      }
    });

    if (error) {
      console.error('Erreur:', error);
    } else if (offline) {
      console.log('Ajouté en mode offline, sera synchronisé');
    }
    
    setLoading(false);
  };

  return (
    <button onClick={() => handleAddStudent('Jean')}>
      Ajouter un élève
    </button>
  );
}
```

### Exemple 3 : Utiliser le hook de statut offline

```typescript
"use client"

import { useOfflineStatus } from '@/hooks/useOfflineStatus'

export default function MyPage() {
  const { isOnline, queuedItems, failedItems, manualSync } = useOfflineStatus()

  return (
    <div>
      {!isOnline && <p>Mode hors-ligne</p>}
      {queuedItems > 0 && <p>{queuedItems} éléments en attente</p>}
      {failedItems > 0 && (
        <button onClick={manualSync}>
          Réessayer ({failedItems} échoué(s))
        </button>
      )}
    </div>
  );
}
```

## Bonnes pratiques

### 1. **Utiliser des clés de cache significatives**

```typescript
// ✅ Bon
offlineFetch('students:2024:class-A', fetchFn)

// ❌ Mauvais
offlineFetch('data', fetchFn)
```

### 2. **Définir des durées de cache appropriées**

```typescript
// Données statiques : cache long
{ cacheDuration: 7 * 24 * 60 * 60 } // 7 jours

// Données fréquemment mises à jour : cache court
{ cacheDuration: 5 * 60 } // 5 minutes

// Données critiques : pas de cache
{ cacheDuration: 0 }
```

### 3. **Utiliser les mises à jour optimistes**

```typescript
offlineWrite({
  table: 'students',
  action: 'UPDATE',
  payload: { name: 'Jean' },
  options: { keyColumn: 'id', keyValue: '123' },
  optimisticUpdate: () => {
    // Mettre à jour l'état local immédiatement
    setStudent(prev => ({ ...prev, name: 'Jean' }));
  }
});
```

### 4. **Gérer les erreurs de synchronisation**

```typescript
const { data, error, offline } = await offlineWrite({...});

if (error && !offline) {
  // Erreur réseau - afficher un message
  showError('Erreur de synchronisation');
} else if (offline) {
  // Opération mise en queue - afficher une notification
  showInfo('Données sauvegardées localement');
}
```

### 5. **Précharger les données critiques**

```typescript
import { preloadCriticalData } from '@/utils/offlineApi'

useEffect(() => {
  preloadCriticalData([
    {
      key: 'students:2024',
      fetchFn: () => offlineFetch('students:2024', ...),
      cacheDuration: 3600
    },
    {
      key: 'classes:2024',
      fetchFn: () => offlineFetch('classes:2024', ...),
      cacheDuration: 3600
    }
  ]);
}, []);
```

## Indicateurs UI

### Composant ConnectionStatus

Affiche le statut de connectivité et de synchronisation :

```typescript
import ConnectionStatus from '@/components/ConnectionStatus'

export default function Layout() {
  return (
    <>
      <ConnectionStatus />
      {/* Contenu */}
    </>
  );
}
```

### Composant OfflineSync

Gère l'enregistrement du Service Worker et la synchronisation :

```typescript
import OfflineSync from '@/components/OfflineSync'

export default function Layout() {
  return (
    <>
      <OfflineSync />
      {/* Contenu */}
    </>
  );
}
```

## Dépannage

### Les données ne se synchronisent pas

1. Vérifier que le Service Worker est enregistré
2. Vérifier que la file de synchronisation n'est pas vide
3. Vérifier les logs du navigateur (DevTools > Console)
4. Forcer une synchronisation manuelle avec `forceSyncNow()`

### Le cache n'est pas mis à jour

1. Vérifier la durée du cache (`cacheDuration`)
2. Utiliser `forceRefresh: true` pour ignorer le cache
3. Utiliser `clearAllCache()` pour vider le cache

### Les opérations offline ne se synchronisent pas

1. Vérifier que `offlineWrite` est utilisé
2. Vérifier les options `keyColumn` et `keyValue`
3. Vérifier que la table existe dans Supabase
4. Vérifier les logs de synchronisation

## Performance

- **Taille du cache** : Limité à 500 entrées pour les API, 100 pour les images
- **Durée de vie** : 7 jours pour les API, 30 jours pour les images
- **Nettoyage** : Automatique lors de l'activation du Service Worker

## Sécurité

- Les données sensibles ne doivent pas être cachées
- Utiliser `cacheOnOnline: false` pour les données sensibles
- Vider le cache lors de la déconnexion
- Utiliser HTTPS en production

## Ressources

- [MDN - Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [MDN - IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Web.dev - Offline Cookbook](https://jakearchibald.com/2014/offline-cookbook/)
- [Serwist Documentation](https://serwist.pages.dev/)
