// Passage d'une sauvegarde analysée (Analyseur) vers la Banque.
let pending = null;
export const setPendingSave = (save) => { pending = save; };
export const takePendingSave = () => { const p = pending; pending = null; return p; };
