# Security policy

Nawa Guard is a security component, so reports are taken seriously.

## Reporting a vulnerability

Please **do not open a public issue**. Use GitHub's private reporting instead:
**Security → Report a vulnerability** on https://github.com/oriebalzyuot96/nawa-guard.

Include the affected package and version, a description, and steps or a proof of concept. You'll get an acknowledgement within 72 hours and a fix or mitigation plan as soon as the issue is confirmed.

## Scope

In scope: token sealing and signing, replay protection, verification logic (Node and ASP.NET Core), the widget leaking solution data, and bypasses that solve challenges without the intended work.

Known limits (documented, not vulnerabilities on their own): image puzzles can be solved by computer vision or paid human solvers, and recorded human pointer traces can pass the trajectory heuristics. Use rate limiting and adaptive difficulty alongside Nawa Guard.

## Supported versions

The latest minor release receives security fixes.
