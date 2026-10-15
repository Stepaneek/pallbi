# PallBi

Build a running journal web app called "RunCoach" with the following features:

## Core Features

### Authentication

- Email/password sign up and login

- Google OAuth login

- User profile with name, weekly km goal, and fitness level (beginner / intermediate / advanced)

### Run Logging

- Form to log a run manually: date, distance (km), duration (hh:mm:ss), average heart rate (optional), how I felt (1–5 scale with emoji), and free notes

- After saving a run, automatically call the Claude AI API (claude-sonnet-4-20250514) to generate a short personal coaching comment (3–5 sentences) that:

  - Acknowledges the specific run (distance, pace)

  - Compares it to the user's last 3 runs if available

  - Gives one concrete actionable tip for next training

  - Matches tone to how the user felt (encouraging if felt bad, celebratory if felt great)

### Dashboard

- Weekly summary: total km, total runs, average pace

- Streak counter (consecutive days with a run)

- Simple line chart showing km per run over last 30 days

- Last 5 runs listed with their AI coaching comment

### Run History

- Full list of all runs, newest first

- Filter by date range

- Each run card shows: date, distance, pace, feeling emoji, and AI comment

## Design

- Clean, modern mobile-first design

- Dark mode by default

- Primary color: orange (#F97316)

- Use Tailwind CSS and shadcn/ui components

## Tech Stack

- React frontend

- Supabase for database and authentication

- Claude API for AI coaching comments

- Store the Claude API key in Supabase Edge Functions (never expose it on frontend)

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://pallbi.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/99f21eb1-6969-4042-b6ac-9f19d860b65b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
