# Notifications push EJ Prono

## 1. Base de donnees

Executer le fichier SQL suivant dans Supabase SQL Editor :

```text
supabase/push_notifications.sql
```

Il cree :

- `push_subscriptions` pour stocker les telephones/navigateurs abonnes.
- `push_reminder_logs` pour eviter d'envoyer plusieurs fois le meme rappel.

## 2. Cles VAPID

Generer les cles :

```bash
npm run vapid:generate
```

Ajouter ensuite ces variables dans Vercel :

```text
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:votre-email@example.com
```

Optionnel, pour proteger les routes cron :

```text
CRON_SECRET=une-valeur-longue-et-aleatoire
```

Optionnel, pour changer la fenetre de rappel :

```text
PUSH_REMINDER_WINDOW_HOURS=24
```

## 3. Cron Vercel Hobby

Sur Vercel Hobby, les cron jobs ne peuvent tourner qu'une fois par jour.
Le cron inclus dans `vercel.json` lance donc les rappels tous les jours a
08:00 UTC et cherche les matchs des prochaines 24h.

Pour des rappels exactement quelques heures avant chaque match, utiliser
Vercel Pro ou un scheduler externe appele toutes les heures sur :

```text
/api/push/send-reminders
```

## 4. Mobile

Android : Chrome/Edge peuvent recevoir les notifications apres autorisation.

iPhone : les notifications web fonctionnent quand EJ Prono est ajoute a
l'ecran d'accueil, puis que l'utilisateur active les rappels depuis l'app.
