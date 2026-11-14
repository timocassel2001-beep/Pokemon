import { GAMES } from "../data/games.js";
import { isFilled } from "./store.js";

export function computeStats(dex, gameDex, totalSpecies) {
  const perGame = Object.fromEntries(GAMES.map((g) => [g.id, { caught: 0, shiny: 0, total: gameDex[g.id]?.ids.length ?? 0, quota: 0 }]));
  let nationalCaught = 0, nationalShiny = 0, totalCaptures = 0, totalTransfers = 0, eventCount = 0;
  for (const [sid, games] of Object.entries(dex)) {
    if (Number(sid) > totalSpecies) continue;
    let any = false, anyShiny = false;
    for (const [gid, e] of Object.entries(games)) {
      if (gid.startsWith("hack:")) continue; // les ROM hacks ne comptent pas dans le Master Living Dex officiel
      const pg = perGame[gid];
      const inDex = gameDex[gid]?.set.has(Number(sid));
      if (isFilled(e)) { any = true; if (pg && inDex) pg.caught++; }
      if (e.caught) totalCaptures++;
      if (e.shinyCaught) { anyShiny = true; totalCaptures++; if (pg && inDex) pg.shiny++; }
      const q = (e.transferQuota || 0) + (e.shinyQuota || 0);
      if (q) { totalTransfers += q; if (pg) pg.quota += q; }
      if (e.eventRequired) eventCount++;
    }
    if (any) nationalCaught++;
    if (anyShiny) nationalShiny++;
  }
  let masterCaught = 0, masterTotal = 0;
  for (const g of Object.values(perGame)) { masterCaught += g.caught; masterTotal += g.total; }
  return { perGame, nationalCaught, nationalShiny, totalCaptures, totalTransfers, eventCount, masterCaught, masterTotal };
}

export function aggregate(games) {
  let caughtGames = 0, normal = 0, shinyCopies = 0, shiny = false, event = false;
  if (games)
    for (const [gid, e] of Object.entries(games)) {
      if (gid.startsWith("hack:")) continue;
      if (isFilled(e)) caughtGames++;
      normal += (e.caught ? 1 : 0) + (e.transferQuota || 0);
      shinyCopies += (e.shinyCaught ? 1 : 0) + (e.shinyQuota || 0);
      if (e.shinyCaught || e.shinyQuota) shiny = true;
      if (e.eventRequired) event = true;
    }
  return { caughtGames, normal, shinyCopies, copies: normal + shinyCopies, shiny, event };
}

/** Nombre de jeux suivis où l'espèce est disponible. */
export const gamesFor = (sid, gameDex) => GAMES.reduce((n, g) => n + (gameDex[g.id].set.has(sid) ? 1 : 0), 0);

/**
 * Objectif d'une espèce :
 *  - normal : par défaut 1 exemplaire par jeu où elle existe (Living Dex dans chaque jeu)
 *  - shiny  : selon le réglage global (aucun / 1 par espèce / 1 par jeu), modifiable par espèce
 */
export function goalFor(sid, dex, targets, gameDex, shinyGoal) {
  const nGames = gamesFor(sid, gameDex);
  const t = targets[sid] ?? {};
  const autoShiny = shinyGoal === "games" ? nGames : shinyGoal === "species" ? 1 : 0;
  const a = aggregate(dex[sid]);
  const needNormal = t.normal ?? nGames;
  const needShiny = t.shiny ?? autoShiny;
  return {
    nGames,
    needNormal,
    needShiny,
    haveNormal: a.normal,
    haveShiny: a.shinyCopies,
    customNormal: t.normal != null,
    customShiny: t.shiny != null,
    missNormal: Math.max(0, needNormal - a.normal),
    missShiny: Math.max(0, needShiny - a.shinyCopies),
  };
}

export function goalsSummary(species, dex, targets, gameDex, shinyGoal) {
  let needN = 0, haveN = 0, needS = 0, haveS = 0, done = 0;
  for (const s of species) {
    const g = goalFor(s.id, dex, targets, gameDex, shinyGoal);
    needN += g.needNormal; haveN += Math.min(g.haveNormal, g.needNormal);
    needS += g.needShiny; haveS += Math.min(g.haveShiny, g.needShiny);
    if (!g.missNormal && !g.missShiny) done++;
  }
  return { needN, haveN, needS, haveS, done };
}
