# How to push this to GitHub

This folder is a complete, ready-to-push Git repository. Here's how to get it onto GitHub in about 2 minutes.

## One-time setup (if you've never used Git from terminal before)

```bash
# Tell Git who you are (use your GitHub email)
git config --global user.name "Catherine Cho"
git config --global user.email "your-github-email@example.com"
```

## Step 1: Create the empty repo on GitHub

1. Go to [github.com/new](https://github.com/new)
2. Repository name: `calculus-knowledge-graph` (or whatever you want)
3. Description: *"A pedagogically structured knowledge graph of calculus concepts, powering a Socratic AI tutor."*
4. Set to **Public** (so your professor can see it)
5. **Do NOT** check "Add a README" / "Add .gitignore" / "Add license" — we have those already
6. Click **Create repository**

GitHub will show you a page with setup instructions. Copy the URL it shows (something like `https://github.com/yourusername/calculus-knowledge-graph.git`).

## Step 2: Initialize the local repo and push

Open a terminal, navigate to wherever this folder lives, and run:

```bash
cd calculus-knowledge-graph

git init
git add .
git commit -m "Initial commit: knowledge graph + tutor for OpenStax Calculus"

git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/calculus-knowledge-graph.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username.

You'll be prompted for a password — but GitHub doesn't accept passwords anymore. You need a **Personal Access Token**:

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Give it a name like "calculus-kg push"
4. Check the **repo** scope
5. Generate and copy the token (you only see it once!)
6. Paste the token when Git asks for a password

## Step 3: Verify

Go to `https://github.com/YOUR_USERNAME/calculus-knowledge-graph` — you should see the README rendered nicely, with the full file tree visible.

## Sending it to your professor

Once it's pushed, you can send the link in an email like:

> Hi Professor [Vosoughi/Mucha],
>
> I've put my knowledge graph work up on GitHub. The full repo is here: [link]
>
> The README walks through everything, but the highlights:
>
> - 882 concept nodes and 1,225 typed edges covering all three volumes of OpenStax Calculus
> - A Socratic tutoring interface that uses the graph to guide students via RAG (two LLM calls per question: one for routing, one for guidance)
> - Documented methodology for how the graph was constructed and the ontology I settled on
>
> Happy to walk you through it in person too. The next step I'm planning is [whatever's next].

## Making future changes

Whenever you update files locally:

```bash
git add .
git commit -m "describe what changed"
git push
```

## Troubleshooting

- **"Permission denied (publickey)"** — you're using SSH, not HTTPS. Either set up an SSH key, or change your remote: `git remote set-url origin https://github.com/YOUR_USERNAME/calculus-knowledge-graph.git`
- **"refusing to merge unrelated histories"** — you accidentally let GitHub add a README. Easiest fix: delete the GitHub repo and recreate it without any "Initialize this repository with" boxes checked.
- **The notebooks look broken on GitHub** — that's fine, GitHub sometimes struggles to render large notebooks. They'll still work when downloaded and opened in Jupyter/VSCode.
