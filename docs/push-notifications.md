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
PUSH_REMINDER_WINDOW_HOURS=6
```

La valeur doit etre un nombre seul, par exemple `6`, sans `h`.

## 3. Cron

Sur Vercel Hobby, on garde seulement le cron quotidien du recalcul FIFA dans
`vercel.json`. Il tourne a 10:00 UTC, soit 12:00 a Paris pendant l'heure
d'ete.

Pour les rappels de pronostics, utiliser cron-job.org en GET vers :

```text
https://ej-prono.vercel.app/api/push/send-reminders
```

Reglage conseille avec cron-job.org :

```text
0 */3 * * *
```

Avec `PUSH_REMINDER_WINDOW_HOURS=6`, le job cherche les matchs des 6 prochaines
heures. Le journal `push_reminder_logs` evite d'envoyer plusieurs fois le meme
rappel pour le meme match.

Si `CRON_SECRET` est configure dans Vercel, ajouter l'en-tete HTTP :

```text
Authorization: Bearer votre_CRON_SECRET
```

## 4. Mobile

Android : Chrome/Edge peuvent recevoir les notifications apres autorisation.

iPhone : les notifications web fonctionnent quand EJ Prono est ajoute a
l'ecran d'accueil, puis que l'utilisateur active les rappels depuis l'app.
