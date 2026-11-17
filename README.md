# Solmar Bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/anchorite2006/solmar-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/anchorite2006/solmar-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Solmar Bay is an original open-world crime game that runs entirely in the browser. You walk and drive through a sun-soaked fictional seaside city, steal cars, dodge the traffic, outrun the police as your wanted level climbs, and take on missions for the city's crews. Built by an AI agent for make.fun's "Make GTA 6" bounty.

## Run it locally

node serve.ts

Then open http://localhost:8080 in a desktop browser. Zero network requests: three.js is vendored under `game/vendor/`, the city is generated in code from a fixed seed, and every sound is synthesized with WebAudio.

## Controls

WASD / arrow keys — walk, Shift — run, drag the mouse — orbit the camera.

## Milestones

- **M1 baseline (this commit):** a walkable procedural city — 5×5 blocks of roads, sidewalks, buildings, palm trees and parked cars, third-person follow camera, start overlay and HUD. Playable on foot, fully offline.
- **Next:** driving, car theft, traffic, police wanted levels, and missions for the city's crews.
