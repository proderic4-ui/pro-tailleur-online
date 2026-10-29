# Comptes Pro Tailleur Online

## Configuré
- Une seule connexion Lovable Cloud; email/mot de passe activé et confirmation email conservée.
- Inscription : six champs obligatoires, téléphone +228, confirmation du mot de passe et affichage/masquage.
- Création automatique du profil, atelier UUID unique et abonnement gratuit par déclencheur de base de données.
- Atelier propriétaire uniquement : lecture/modification protégées par RLS, lecture privée du tableau de bord par fonction serveur authentifiée.
- Abonnements lisibles par leur propriétaire mais non modifiables par les utilisateurs; aucune attribution de rôle admin depuis les métadonnées.
- Limites gratuites imposées à chaque insertion : 5 clients et 3 commandes. Verrou atelier pour sérialiser les insertions concurrentes.
- Connexion, déconnexion, récupération et page publique de nouveau mot de passe.
- Tarifs, couleurs et autres pages conservés. Tableau de bord personnel réel à la même adresse; maquette publique d'accueil conservée.
- Aucun paiement, WhatsApp ou transaction ajouté. Les tables clients/commandes préparent les limites; aucun écran de gestion ajouté.

## Tests effectués
- Tests de validation : champs obligatoires, +228, huit chiffres et confirmation identique.
- Deux comptes temporaires : profil et atelier créés, UUID différents, abonnement gratuit malgré métadonnées falsifiées.
- Accès inter-ateliers refusé en lecture, modification et insertion; upgrade abonnement impossible.
- Cinq clients et trois commandes acceptés; sixième client et quatrième commande refusés.
- Navigateur : visite privée redirigée, connexion email réelle, nom atelier chargé par serveur, compteurs réels, actualisation, déconnexion et nouvel accès privé bloqué.
- Téléphone 394 × 602 : formulaire, erreur de confirmation, visibilité du mot de passe et absence de débordement horizontal.
- Page récupération sans lien rejetée. Aucun problème signalé par l'analyseur de sécurité Cloud.
- Comptes/données temporaires supprimés.

## À vérifier avec une boîte mail réelle
1. Inscription depuis /inscription, réception du mail, ouverture du lien et première connexion.
2. Mot de passe oublié depuis /connexion, réception du mail, ouverture de /reset-password, enregistrement et connexion avec le nouveau mot de passe.
3. Après publication : liens de confirmation/récupération sur l'adresse publique. L'application n'a pas été publiée.

La livraison des emails, le parcours complet de récupération et les courses concurrentes de quota ne sont pas déclarés vérifiés.