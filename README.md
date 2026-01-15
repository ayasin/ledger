# Spending Ledger

This is a spending ledger designed to work with multiple currencies and make tax reporting easier.

# Getting started

- Downlaod and install node if you don't already have it
- Clone this repo into a folder of your choice
- Copy .env.example to .env
- Edit the JWT_SECRET to be something that's not the default value
- Open a terminal in the directory you cloned the repo (if you haven't already)
- Run `npm i`
- Run `npm db:migrate`
- Run `./scripts/user-cli.ts` and add your first user
- Run `npm run dev` to start the server

Optionally (**highly recommended**) you can also run the backup daemon to backup changes. to do so, in a separate terminal window run `./scripts/backup-daemon.ts`. This will backup the database every hour if there are changes, and keep 12 versions.