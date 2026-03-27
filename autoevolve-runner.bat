@echo off
title [AutoEvolve] Autonomous Cycle
cd /d "D:\workspace"
echo [%time%] === AutoEvolve Cycle Started ===

:: Run autoevolve via Claude CLI (headless, autonomous)
echo [%time%] Launching Claude with /autoevolve --auto...

claude --dangerously-skip-permissions --model sonnet --max-turns 30 --verbose -p "Run /autoevolve --auto --max 10. This is an autonomous run — no human in the loop. For code domain: only safe changes (tests, lint fixes). For prompts: optimize without losing quality. For behavior: analyze and propose guardrails. For flow: scan and report only. Commit each change with [autoevolve] prefix. Stop at plateau. Write summary to .autoevolve/reports/." 2>&1

echo [%time%] === AutoEvolve Cycle Complete ===

:: Auto-close window after 5 seconds
timeout /t 5 /nobreak >nul
taskkill /f /fi "windowtitle eq [AutoEvolve] Autonomous Cycle" >nul 2>&1
