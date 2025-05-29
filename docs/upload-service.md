# Service d'Upload

Ce service d'upload utilise Cloudinary pour stocker et gérer les fichiers de manière sécurisée et évolutive.

## Configuration

Pour utiliser le service d'upload, vous devez configurer les variables d'environnement suivantes dans votre fichier `.env` :

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

Ces informations peuvent être obtenues à partir de votre dashboard Cloudinary.

## Utilisation de l'API

### Upload de fichier

```http
POST /api/v1/upload
Content-Type: multipart/form-data

Parameters:
- file: Le fichier à uploader
- folder: (optionnel) Le dossier de destination dans Cloudinary
```

Exemple de réponse :
```json
{
  "success": true,
  "data": {
    "url": "https://res.cloudinary.com/your-cloud/image/upload/v1/folder/filename",
    "public_id": "folder/filename",
    "resource_type": "image"
  }
}
```

### Suppression de fichier

```http
DELETE /api/v1/upload/{publicId}
```

Exemple de réponse :
```json
{
  "success": true
}
```

## Sécurité

- L'API nécessite une authentification (JWT token)
- Les types de fichiers sont validés côté serveur
- Les fichiers sont scannés automatiquement par Cloudinary
- Les URLs générés sont sécurisés et optimisés pour le CDN
