---
title: Setting Up This Blog With Eleventy
description: Why I used Eleventy instead of Jekyll for GitHub Pages, plus the VS Code task setup, GitHub Actions deploy, and the idiot theme.
date: 2026-03-11
---

This is the first actual post on the blog, which felt like a reasonable place to explain how the blog exists at all.

The goal was fairly simple: I wanted to write posts in Markdown, keep them in the same repo as the tools, and have GitHub Pages serve the result without me having to hand-maintain a pile of HTML files like some kind of medieval peasant.

## Why Eleventy and not Jekyll?

[Jekyll](https://jekyllrb.com/) is the default thing people think of for GitHub Pages, and to be fair, it does make sense there. GitHub Pages knows how to build it natively, which means fewer moving parts if you are happy to stay inside its world.

I did not especially want to stay inside its world.

The main reasons I went with [Eleventy](https://www.11ty.dev/) (soon to be known as [Build Awesome](https://www.11ty.dev/blog/build-awesome/)) instead were:

- it is extremely simple to point at a folder of Markdown and say "please turn this into a site"
- it plays nicely with plain HTML, which matters because this repo already had static tool pages lying around
- it does not make me think in Jekyll-specific terms all the time
- Ruby's syntax scares me (but then again, I'm a python programmer, so anything that's not baby's first syntax is bound to scare me)
- it lets me keep the site structure fairly close to what I already had, which is useful when I am making this up as I go along
- possum on a balloon

The downside is that GitHub Pages will not build Eleventy for me automatically in the same convenient way it would with Jekyll. So instead of asking GitHub Pages to understand the source, I just have GitHub Actions build the site and deploy the generated output.

That tradeoff is fine. The build is tiny, and the repo stays cleaner because I don't have to commit the generated site every time I fix a typo.

## GitHub Pages and GitHub Actions

The important distinction is this:

- the repo contains the source files
- GitHub Pages serves the built site

In this setup, Eleventy writes the finished site to `_site/`, and GitHub Actions publishes that folder.

That means I can keep `_site/` out of git, which is nice because generated files are noisy and annoying in commits. The workflow just installs dependencies, runs the build, and uploads the result for Pages to serve.

So the rough deployment story is:

1. write Markdown
2. push to GitHub
3. GitHub Actions runs Eleventy
4. GitHub Pages serves the built output

Which is exactly the kind of mildly overengineered but still practical solution I was after.

## VS Code tasks

I also set up VS Code tasks for the two workflows I actually care about:

- `Eleventy: Dev Server`
- `Eleventy: Watch`

The dev server is the normal one. It rebuilds the site and serves it for previewing.

The watch task is there because sometimes I insist on using Live Server even when a tool already exists to solve the problem. In that case, Eleventy watches the source files and rebuilds `_site/`, while Live Server serves the built output.

This turned out to matter more than expected, because otherwise you can very easily end up clicking around the source folders and wondering why your "blog" is just a directory listing and a collection of bad decisions.

## What I wanted from the setup

Mostly, I wanted something that lets me dump thoughts into Markdown, build them into actual pages, and keep everything in one place without fighting the toolchain every five minutes.

At the moment, that seems to be working.

Which is kinda suspicious, but I'll take it.

## The Blog's CSS Theme

The theme is called `idiot`, which is not a serious name and was never meant to be one.

It is basically the reusable version of the visual language from my tools, which is a deliberately over-the-top 90s web design aesthetic that I find charming because I'm probably the last generation that grew up with dial-up internet and GeoCities. Its defining features being:

- loud colors
- chunky borders
- bevelled buttons
- Comic Neue on the headings (comic sans is proprietary from Microsoft, and this is close enough).
- a light/dark toggle that remembers your choice
- coming soon: an MC Hammer dancing GIF somewhere on the homepage (maybe?)

## Q&A

**Q: Why is it called the idiot theme?**  
A: I made it for myself, and I see a lot of myself in my work.

**Q: Can I use it for my own projects?**  
A: Of course! It's mostly spaghetti code held together with prompts and prayers, but if you want it, feel free to take it.

**Q: How'd you get this blog up and running so fast?**  
A: GitHub Copilot.

**Q: How did you troubleshoot issues?**  
A: GitHub Copilot.

**Q: What about configuring the GitHub Actions workflow?**  
A: Also GitHub Copilot.

**Q: If GitHub Copilot can do all that, what do we need you for?**  
A: I plead the fifth, your honor.

## Conclusion

I can't thank the Eleventy team enough for making a tool that is so simple to set up and use, and that just does what I need without getting in the way. I hope everything goes awesome with the [Build Awesome project](https://www.kickstarter.com/projects/fontawesome/build-awesome-pro) and once the kickstarter is up, I will definitely be giving you my lunch money.
