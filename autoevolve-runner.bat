@echo off
title [AutoEvolve] Autonomous Cycle
cd /d "D:\workspace"
echo [%time%] === AutoEvolve Cycle Started ===

:: Run autoevolve via Claude CLI (headless, autonomous)
echo [%time%] Launching Claude with /autoevolve --auto...

claude --dangerously-skip-permissions --model sonnet --verbose -p "Run /autoevolve --auto. This is an autonomous run — no human in the loop. IMPORTANT: Create a branch autoevolve/cycle-{date} before making any changes. Run the tight loop on that branch. After the loop, push the branch and open a PR with gh pr create summarizing all changes. NEVER commit directly to master/main. For code domain: only safe changes (tests, lint fixes). For prompts: optimize without losing quality. For behavior: analyze and propose guardrails. For flow: scan and report only. Stop at plateau (3 consecutive no-improvement iterations). No max iterations — trust plateau detection to stop. Write summary to .autoevolve/reports/." 2>&1

echo [%time%] === AutoEvolve Cycle Complete ===

:: Auto-close window after 5 seconds
timeout /t 5 /nobreak >nul
taskkill /f /fi "windowtitle eq [AutoEvolve] Autonomous Cycle" >nul 2>&1
